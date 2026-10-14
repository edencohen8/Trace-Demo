// Live acceptance uses fictional evidence only. Labels and expectations never enter runChat.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { runChat } from '../src/server/chat.ts';
import { createRuntime, providerStatus, readConfig, safeError } from '../src/server/config.ts';
import type { CaseSession, ProgressEvent } from '../src/demo/types.ts';
import { writeRadarPackage, type Variant } from './generate-radar-demo.ts';

const openings = [
  'למה T015I לא התגלתה?',
  'בדוק את האירוע שמתואר בתיק והסבר מה השתבש.',
  'המפעיל טוען שהאזור היה פתוח. למה לא התקבל גילוי?',
  'האם המכ״ם חיפש במקום הנכון בזמן האירוע?',
  'חקור את היעדר הגילוי באזור ובזמן שמופיעים בתיק.',
];
const followups = [
  ['האם המפעיל באמת ביטל את החסימה?', 'איך אתה יודע שהחסימה הייתה פעילה בפועל?', 'למה הממשק הציג שאין חסימה?'],
  ['מה בדיוק לא התאים בין גרסאות התוכנה?', 'מה השתנה לפני שהמטרה כן התגלתה?', 'האם פקודות נוספות נפגעו?'],
  ['הצג לי את הראיות המרכזיות.', 'תן לי סיכום קצר למפעיל.'],
];
const group = process.argv[2] ?? 'smoke';
const output = resolve(process.argv[3] ?? 'artifacts/radar-live');
await mkdir(output, { recursive: true });
const config = await readConfig();
console.log(providerStatus(config));
const tasks: { id: string; questions: string[]; variant?: Variant }[] = [];
if (group === 'smoke') tasks.push({ id: 'smoke', questions: [openings[0]!] });
if (group === 'baseline' || group === 'all') for (let q = 0; q < 5; q++) for (let repeat = 0; repeat < 3; repeat++) tasks.push({ id: `baseline-${q + 1}-${repeat + 1}`, questions: q === 3 ? [openings[q]!, 'כעת חקור את שורש התקלה והסבר למה לא התקבל גילוי.'] : [openings[q]!] });
if (group === 'followup' || group === 'all') for (let n = 0; n < 3; n++) tasks.push({ id: `followup-${n + 1}`, questions: [openings[0]!, ...followups[n]!] });
if (group === 'variants' || group === 'all') for (const variant of ['missing-state', 'partial-detections', 'outside-sector', 'cancel-applied'] as Variant[]) tasks.push({ id: `variant-${variant}`, variant, questions: [openings[0]!] });
if (!tasks.length) throw new Error('Unknown live QA group');

async function runTask(task: typeof tasks[number]) {
  let store = new EvidenceStore();
  if (task.variant) {
    const root = await mkdtemp(join(tmpdir(), 'trace-live-'));
    await writeRadarPackage(join(root, 'fixtures/case_005'), task.variant);
    store = new EvidenceStore(root, ['case_005']);
  }
  const session: CaseSession = { caseId: 'case_005', messages: [], lessons: [] };
  for (const [turn, text] of task.questions.entries()) {
    const start = performance.now();
    const events: { elapsedMs: number; event: ProgressEvent }[] = [];
    const calls = { model: 0, tools: 0 };
    const requests = new Map<string, { name: string; arguments: unknown }>();
    const reviews: string[] = [];
    const toolErrors = new Map<string, { tool: string; error: string }>();
    let firstUsefulMs: number | undefined;
    try {
      const answer = await runChat({ caseId: 'case_005', text, evidence: [] }, session, store, config, AbortSignal.timeout(480_000), (event) => {
        const elapsedMs = performance.now() - start;
        events.push({ elapsedMs, event });
        if (event.type === 'tool_call') calls.tools++;
        if (event.type === 'tool_result' && event.step?.citations?.length && firstUsefulMs === undefined) firstUsefulMs = elapsedMs;
        if (event.type === 'tool_result') console.log(`${task.id}/${turn} ${(elapsedMs / 1000).toFixed(1)}s ${event.tool}: ${event.text}`);
      }, (settings, signal) => {
        const runtime = createRuntime(settings, signal);
        return { ...runtime, complete: async (prompt, reasoning) => { calls.model++; const result = await runtime.complete(prompt, reasoning); if (prompt.startsWith('Review whether')) { reviews.push(result); console.log(`${task.id}/${turn} claim review: ${result}`); } return result; }, streamFn: (model, context, options) => {
          calls.model++;
          for (const message of context.messages) if (message.role === 'toolResult' && message.isError && !toolErrors.has(message.toolCallId)) {
            const error = safeError(message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'), config);
            toolErrors.set(message.toolCallId, { tool: message.toolName, error });
            console.log(`${task.id}/${turn} tool error ${message.toolName}: ${error}`);
          }
          for (const message of context.messages) if (message.role === 'assistant') for (const block of message.content) if (block.type === 'toolCall') requests.set(block.id, { name: block.name, arguments: block.arguments });
          return runtime.streamFn(model, context, options);
        } };
      });
      const sources = await Promise.all(answer.citations.map((badge) => store.resolve('case_005', badge)));
      const report = { id: task.id, turn, question: text, provider: providerStatus(config), elapsedMs: performance.now() - start, firstUsefulMs, calls, requests: [...requests.values()], toolErrors: [...toolErrors.values()], reviews, answer, sources, events };
      await writeFile(join(output, `${task.id}-${turn}.json`), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ id: task.id, turn, elapsedMs: report.elapsedMs, firstUsefulMs, calls, answer: answer.text }));
      session.messages.push({ id: `user-${turn}`, role: 'user', text, createdAt: new Date().toISOString(), citations: [] }, answer);
    } catch (error) {
      await writeFile(join(output, `${task.id}-${turn}.json`), JSON.stringify({ id: task.id, turn, question: text, provider: providerStatus(config), elapsedMs: performance.now() - start, firstUsefulMs, calls, requests: [...requests.values()], toolErrors: [...toolErrors.values()], reviews, events, error: safeError(error, config) }, null, 2));
      console.error(`${task.id}/${turn}: ${safeError(error, config)}`); process.exitCode = 1; break;
    }
  }
}
const concurrency = Math.max(1, Math.min(3, Number(process.env.TRACE_QA_CONCURRENCY ?? 1)));
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < tasks.length) { const task = tasks[next++]!; await runTask(task); }
}));
