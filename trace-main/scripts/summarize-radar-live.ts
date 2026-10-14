// Summarize measured live QA. A completed response is not an independent proof of correctness.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ChatMessage, ProviderStatus } from '../src/demo/types.ts';

interface Report {
  id: string; turn: number; question: string; provider: ProviderStatus;
  elapsedMs: number; firstUsefulMs?: number; calls: { model: number; tools: number };
  answer?: ChatMessage; error?: string; reviews?: string[];
}
const root = resolve(process.argv[2] ?? '/tmp/trace-radar-qa');
const reports: Report[] = [];
for (const file of (await readdir(root)).filter((file) => /-\d+\.json$/.test(file)).sort()) {
  reports.push(JSON.parse(await readFile(join(root, file), 'utf8')) as Report);
}
const seconds = (value?: number) => value === undefined ? '—' : (value / 1000).toFixed(1);
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) } : null;
};
const base = reports.filter((r) => r.id.startsWith('baseline-') && r.turn === 0);
const complete = reports.filter((r) => r.answer && !r.error);
const summary = {
  provider: reports[0]?.provider, reports: reports.length, completed: complete.length, failed: reports.filter((r) => r.error).length,
  baseline: { runs: base.length, completed: base.filter((r) => r.answer && !r.error).length },
  firstUsefulMs: stats(complete.flatMap((r) => r.firstUsefulMs === undefined ? [] : [r.firstUsefulMs])),
  conclusionMs: stats(complete.map((r) => r.elapsedMs)),
  fullInvestigationMs: stats(complete.filter((r) => r.answer?.mode === 'cause').map((r) => r.elapsedMs)),
  modelCalls: stats(complete.map((r) => r.calls.model)), toolCalls: stats(complete.map((r) => r.calls.tools)),
};
const rows = reports.map((r) => {
  const words = r.answer?.text.replace(/\[[^\]]+\]/g, '').trim().split(/\s+/).length;
  return `| ${r.id} | ${r.turn + 1} | ${r.error ? 'FAILED' : r.answer?.validation ?? 'incomplete'} | ${seconds(r.firstUsefulMs)} | ${seconds(r.elapsedMs)} | ${r.calls.model} | ${r.calls.tools} | ${r.answer?.citations.length ?? 0} | ${words ?? '—'} |`;
});
const markdown = [
  '# T015I measured live QA', '',
  `Provider/model: ${summary.provider?.provider}/${summary.provider?.model}.`,
  `Completed ${summary.completed}/${summary.reports} turns. Baseline openings: ${summary.baseline.completed}/${summary.baseline.runs}.`, '',
  'The runtime validates source existence and reviews claim support. These are automatic signals. Read the answers and sources for the final acceptance verdict.', '',
  '| Run | Turn | Runtime result | First useful (s) | Total (s) | Model calls | Tools | Citations | Words |',
  '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |', ...rows, '',
  '## Failures', '', ...reports.filter((r) => r.error).map((r) => `- ${r.id}/${r.turn + 1}: ${r.error}`), '',
].join('\n');
await writeFile(join(root, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(join(root, 'summary.md'), markdown);
console.log(JSON.stringify(summary, null, 2));
