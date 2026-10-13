// Opt-in live QA. Uses only the fictional public fixtures and never saves chat sessions.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { runChat } from '../src/server/chat.ts';
import { createRuntime, readConfig, safeError, providerStatus } from '../src/server/config.ts';
import type { CaseSession } from '../src/demo/types.ts';

const scenarios: { id: string; caseId: string; evidence: string[]; text: string; followups?: string[] }[] = [
  { id: 'sensor', caseId: 'case_001', evidence: ['[sensor.txt:L1]'],
    text: 'Use English. What sensor status does the attached record report? Answer in one sentence.' },
  { id: 'numeric', caseId: 'case_002', evidence: [],
    text: 'Use English. Calculate the maximum absolute difference between site_external_lat and site_gps_lat across all PositionReport rows. Give the sample count, units, and UTC timestamp of the peak. Use the calculation tool.' },
  { id: 'coverage', caseId: 'case_004', evidence: [],
    text: 'Use English. Does the absence of DetectionCandidate and FilterConfigApplied rows prove that the sensor detected nothing and that the filter configuration never changed? Check the export coverage.' },
  { id: 'cause', caseId: 'case_003', evidence: [],
    text: 'Use English. Investigate why the operator reported a delayed alert. Compare the evidence for delay in identification, alert matching, and notification delivery. State what remains uncertain.' },
  { id: 'gaps', caseId: 'case_001', evidence: [],
    text: 'Use English. What is the largest capture-time gap between consecutive RadarScan messages in this case? Give its duration in seconds and both endpoints in UTC. Use the calculation tool.' },
  { id: 'followup', caseId: 'case_002', evidence: [],
    text: 'Use English. Between 11:03:00 and 11:04:00 UTC, find the maximum absolute difference between site_external_lat and site_gps_lat in PositionReport rows. Give the value, sample count, and peak UTC timestamp.',
    followups: [
      'Use English. What about 11:04:00 to 11:05:00 UTC instead? Use the same fields and calculation.',
      'Use English. Open the peak row from your last answer. Give its two latitude values and the UTC timestamp.',
    ] },
];
const selected = process.argv[2];
if (selected && !scenarios.some((scenario) => scenario.id === selected)) throw new Error('Unknown QA scenario');
const config = await readConfig();
const store = new EvidenceStore();
const reports: unknown[] = [];
console.log(providerStatus(config));
for (const scenario of scenarios.filter((entry) => !selected || entry.id === selected)) {
  const session: CaseSession = { caseId: scenario.caseId, messages: [], lessons: [] };
  for (const [turnIndex, text] of [scenario.text, ...(scenario.followups ?? [])].entries()) {
  const input = { ...scenario, text, evidence: turnIndex === 0 ? scenario.evidence : [] };
  const started = performance.now();
  const calls = { completion: 0, agent: 0, tools: 0 };
  const toolRequests = new Map<string, { name: string; arguments: unknown }>();
  try {
    const answer = await runChat(input, session, store,
      config, AbortSignal.timeout(180_000), (event) => {
        if (event.type === 'tool_call') calls.tools++;
        if (event.type === 'tool_call' || event.type === 'status') {
          console.log(`${scenario.id}/${turnIndex + 1} ${((performance.now() - started) / 1000).toFixed(1)}s ${event.type}: ${event.tool ?? event.text}`);
        }
      }, (runtimeConfig, signal) => {
        const runtime = createRuntime(runtimeConfig, signal);
        return { ...runtime,
          complete: (prompt) => { calls.completion++; return runtime.complete(prompt); },
          streamFn: (model, context, options) => {
            calls.agent++;
            for (const message of context.messages) {
              if (message.role !== 'assistant') continue;
              for (const block of message.content) {
                if (block.type === 'toolCall') toolRequests.set(block.id, { name: block.name, arguments: block.arguments });
              }
            }
            return runtime.streamFn(model, context, options);
          },
        };
      });
    const sources = await Promise.all(answer.citations.map((badge) => store.resolve(scenario.caseId, badge)));
    const report = { scenario: input, turnIndex, elapsedMs: performance.now() - started, calls, toolRequests: [...toolRequests.values()], answer, sources };
    reports.push(report);
    session.messages.push({ id: `qa-user-${turnIndex}`, role: 'user', text, citations: input.evidence, createdAt: new Date().toISOString() }, answer);
    console.log(JSON.stringify({ id: scenario.id, elapsedMs: report.elapsedMs, calls, answer: answer.text }));
  } catch (error) {
    const report = { scenario: input, turnIndex, elapsedMs: performance.now() - started, calls, toolRequests: [...toolRequests.values()], error: safeError(error, config) };
    reports.push(report);
    console.error(JSON.stringify({ id: scenario.id, turnIndex, elapsedMs: report.elapsedMs, calls, error: report.error }));
    process.exitCode = 1;
    break;
  }
  }
}
const output = process.argv[3];
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ provider: providerStatus(config), reports }, null, 2));
  console.log(`QA report: ${output}`);
}
