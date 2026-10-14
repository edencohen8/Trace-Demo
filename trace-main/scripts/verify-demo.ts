import { test, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { EvidenceStore, EVIDENCE_ROOT } from '../src/server/evidence-store.ts';
import { SessionStore } from '../src/server/session-store.ts';
import { initModelRegistry } from '../src/agent/provider.ts';
import { createInvestigationAgent } from '../src/agent/harness.ts';
import { createApi } from '../src/server/api.ts';
import { runChat } from '../src/server/chat.ts';
import { createDataTools } from '../src/server/tools.ts';
import { createRuntime, providerStatus, safeError, type AIConfig } from '../src/server/config.ts';
import type { CaseSession, ChatMessage, ProgressEvent } from '../src/demo/types.ts';
import { TIMELINE_SYSTEMS, countSystemRecords } from '../src/demo/systems.ts';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MessageBody from '../src/demo/MessageBody.ts';
import CitationLink from '../src/demo/CitationLink.ts';
import { describeCitation } from '../src/demo/citations.ts';
import { InvestigationProgress } from '../src/server/investigation-progress.ts';

const store = new EvidenceStore();
const temporary = await mkdtemp(join(tmpdir(), 'trace-demo-test-'));
after(() => rm(temporary, { recursive: true, force: true }));
const config: AIConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'test-only-secret', baseUrl: '' };
const empty = (caseId = 'case_001'): CaseSession => ({ caseId, messages: [], lessons: [] });

test('all four cases parse with exact manifest counts and original-file hashes', async () => {
  const cases = (await store.summaries()).filter((entry) => ['case_001', 'case_002', 'case_003', 'case_004'].includes(entry.id));
  assert.equal(cases.length, 4);
  assert.deepEqual(cases.map((entry) => entry.eventCount), [29362, 29389, 29419, 20954]);
  for (const entry of cases) {
    assert.deepEqual(entry.parseErrors, []);
    assert.equal(entry.files.length, 8);
    assert.equal(entry.diary.length, 5);
    assert.equal(entry.files.find((file) => file.name === 'sniffer.csv')!.records, (await store.manifest(entry.id)).exported_sniffer_rows);
  }
});

test('source clocks align and diary wall-clock times are not mistaken for UTC', async () => {
  const note = (await store.summary('case_001')).diary.find((event) => event.fields.entry_id === 'D-099')!;
  assert.equal(note.time, '2026-10-08T11:03:00.000Z');
  assert.equal(note.recordedTime, '2026-10-08T11:08:10.000Z');
  assert.equal(note.precision, 'בערך ±2 דקות');
  assert.equal((await store.resolve('case_001', '[sensor.txt:L1]')).event!.time, '2026-10-08T10:15:00.085Z');
  assert.equal((await store.resolve('case_001', '[ui_gateway.txt:L1]')).event!.time, '2026-10-08T10:15:00.000Z');
});

test('citations resolve byte-preserved CSV and TXT lines, with 1-based locations', async () => {
  for (const [file, line] of [['sniffer.csv', 1420], ['sensor.txt', 2]] as const) {
    const raw = (await readFile(join(EVIDENCE_ROOT, 'fixtures/case_001/raw', file), 'utf8')).split(/\r?\n/);
    const resolved = await store.resolve('case_001', `[${file}:L${line}]`);
    assert.ok(resolved.kind !== 'calculation');
    assert.equal(resolved.lines.find((entry) => entry.highlight)!.content, raw[line - 1]);
    assert.equal(resolved.event!.line, line);
  }
  const diary = await store.resolve('case_001', '[operator_diary.xlsx:L4]');
  assert.equal(diary.sheet, 'Operator diary');
});

test('unknown cases, paths, zero rows, and fabricated references are rejected', async () => {
  await assert.rejects(store.summary('../case_001'));
  for (const badge of ['[../sensor.txt:L1]', '[private_ground_truth.json:L1]', '[sensor.txt:L0]', '[sniffer.csv:L999999]', '[calc:invented]']) {
    await assert.rejects(store.resolve('case_001', badge));
  }
});

test('filters, pagination and timeline counts describe the same records', async () => {
  const scope = { start: '2026-10-08T11:00:00Z', end: '2026-10-08T11:05:00Z', source: 'track-core', limit: 20 };
  const first = await store.query('case_001', scope);
  const second = await store.query('case_001', { ...scope, offset: 20 });
  assert.ok(first.total > 40);
  assert.equal(first.rows.length, 20);
  assert.equal(new Set([...first.rows, ...second.rows].map((entry) => entry.id)).size, 40);
  assert.ok(first.rows.every((entry) => entry.source === 'track-core' && entry.time >= '2026-10-08T11:00:00'));
  const bins = await store.timeline('case_001', scope);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), first.total);
  assert.ok(bins.every((bin) => Object.keys(bin.alertSources).every((source) => source === 'track-core')));
  await assert.rejects(store.query('case_001', { start: 'nonsense' }));
});

test('filtered capture declares excluded types instead of inventing absence', async () => {
  const summary = await store.summary('case_004');
  assert.ok(summary.excludedTypes.length > 0);
  for (const messageType of summary.excludedTypes) assert.equal((await store.query('case_004', { messageType })).total, 0);
});

test('five system lanes preserve all source counts and mark the radio data as absent', async () => {
  assert.equal(TIMELINE_SYSTEMS.length, 5);
  const assignedSources = TIMELINE_SYSTEMS.flatMap((system) => [...system.sources]);
  assert.equal(new Set(assignedSources).size, assignedSources.length, 'Each source belongs to exactly one system');
  for (const summary of await store.summaries()) {
    assert.ok(summary.sources.every((source) => assignedSources.includes(source)), 'No imported source can disappear from the timeline');
    for (const bin of await store.timeline(summary.id)) {
      assert.equal(TIMELINE_SYSTEMS.reduce((count, system) => count + countSystemRecords(system, bin.sources), 0), bin.count);
      assert.equal(TIMELINE_SYSTEMS.reduce((count, system) => count + countSystemRecords(system, bin.alertSources), 0), bin.alerts);
    }
    assert.equal((await store.query(summary.id, { system: 'radio' })).total, 0);
  }
});

test('system drill-down includes its components and preserves source filters', async () => {
  const services = await store.query('case_002', { system: 'services', limit: 500 });
  assert.ok(services.rows.every((event) => ['track-core', 'position-bridge', 'alert-router'].includes(event.source)));
  assert.ok(services.rows.some((event) => event.source === 'track-core'));
  assert.ok(services.rows.some((event) => event.source === 'position-bridge'));
  const component = await store.query('case_002', { system: 'services', source: 'position-bridge', limit: 500 });
  assert.ok(component.rows.every((event) => event.source === 'position-bridge'));
  assert.equal((await store.query('case_002', { system: 'sensor', source: 'position-bridge' })).total, 0);
  await assert.rejects(store.query('case_002', { system: 'invented-system' }), /Unknown timeline system/);
});

test('deterministic analysis returns numeric results with real source evidence', async () => {
  const calculation = await store.analyze('case_002', { messageType: 'PositionReport', fieldA: 'site_external_lat', fieldB: 'site_gps_lat', operation: 'delta' }) as { count: number; max_absolute_delta: number; peak: { evidence_ref: string; fields: Record<string, number> } };
  assert.equal(calculation.count, 2700);
  assert.ok(calculation.max_absolute_delta > 0);
  const evidence = await store.resolve('case_002', calculation.peak.evidence_ref);
  // The source latitude fields have seven decimal places. Binary subtraction
  // must not add a floating-point tail to that source precision.
  assert.equal(calculation.max_absolute_delta, Number(Math.abs(Number(evidence.event!.fields.site_external_lat) - Number(evidence.event!.fields.site_gps_lat)).toFixed(7)));
  await assert.rejects(store.analyze('case_002', { fieldA: 'site_external_lat', operation: 'delta' }));
});

test('data tools enforce case access and row bounds', async () => {
  const tools = createDataTools(store, 'case_001', new Set(), new AbortController().signal);
  const query = tools.find((tool) => tool.name === 'query_events')!;
  await assert.rejects(query.execute('test', { investigation_id: 'case_002' }));
  const result = await query.execute('test', { limit: 10_000 });
  assert.equal((result.details as { rows: unknown[] }).rows.length, 50);
});

test('Claude, Gemini and LiteLLM select independent models without exposing keys', () => {
  for (const [provider, modelId] of [['anthropic', 'claude-sonnet-4-6'], ['gemini', 'gemini-2.5-flash'], ['litellm', 'tomorrow-model-alias']] as const) {
    const registry = initModelRegistry({ provider, modelId, apiKey: 'test-only-secret', litellmOptions: { modelId, apiKey: 'test-only-secret' } });
    assert.equal(registry.getModel()!.id, modelId);
  }
  assert.ok(!JSON.stringify(providerStatus(config)).includes(config.apiKey));
  assert.equal(safeError(new Error(`failed ${config.apiKey}`), config), 'failed [redacted]');
  assert.equal(providerStatus({ ...config, apiKey: '' }).configured, false);
});

test('native Claude truncation is rejected before incomplete text reaches the router', async () => {
  const events = [
    { type: 'message_start', message: { id: 'test-truncation', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"answerKind":' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { output_tokens: 1800 } },
    { type: 'message_stop' },
  ];
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  }));
  try {
    const runtime = createRuntime({ ...config, model: 'claude-haiku-5-5' }, new AbortController().signal);
    await assert.rejects(runtime.complete('Classify this request'), /output limit/i);
    assert.equal(fetchMock.mock.callCount(), 1);
    const routingBody = JSON.parse(String(fetchMock.mock.calls[0]!.arguments[1]?.body));
    await assert.rejects(runtime.complete('Review this evidence', 'medium'), /output limit/i);
    const reviewBody = JSON.parse(String(fetchMock.mock.calls[1]!.arguments[1]?.body));
    assert.ok(reviewBody.max_tokens >= 16_384, 'Adaptive claim review needs room for reasoning and its verdict');
    assert.ok(reviewBody.max_tokens > routingBody.max_tokens);
  } finally { fetchMock.mock.restore(); }
});

test('JSON sessions persist and concurrent saves do not lose messages', async () => {
  const sessions = new SessionStore(temporary);
  const answer: ChatMessage = { id: 'answer', role: 'assistant', text: 'Source online [sensor.txt:L1]', citations: ['[sensor.txt:L1]'], createdAt: new Date().toISOString(), validation: 'satisfied' };
  await Promise.all([sessions.append('case_001', [answer]), sessions.append('case_001', [{ ...answer, id: 'second' }])]);
  const reopened = new SessionStore(temporary);
  assert.equal((await reopened.read('case_001')).messages.length, 2);
  assert.equal((await reopened.read('case_002')).messages.length, 0);
  await reopened.approve('case_001', 'answer'); await reopened.approve('case_001', 'answer');
  assert.equal((await reopened.read('case_001')).lessons.length, 1);
  await assert.rejects(reopened.approve('case_001', 'not-a-message'));
  await reopened.append('case_002', [answer]);
  const lessons = (await reopened.read('case_001')).lessons;
  await reopened.clearChat('case_001');
  const cleared = await new SessionStore(temporary).read('case_001');
  assert.deepEqual(cleared.messages, []);
  assert.deepEqual(cleared.lessons, lessons);
  assert.equal((await reopened.read('case_002')).messages.length, 1);
  assert.deepEqual(await reopened.clearChat('case_001'), cleared);
  await reopened.append('case_001', [{ ...answer, id: 'after-clear' }]);
  assert.deepEqual((await reopened.read('case_001')).messages.map(message => message.id), ['after-clear']);
});

function fakeRuntime(text: string, readEvidence = true, route: Record<string, unknown> = {}) {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses([
    ...(readEvidence ? [fauxAssistantMessage([fauxToolCall('get_evidence', { badge: '[sensor.txt:L1]' })], { stopReason: 'toolUse' })] : []),
    fauxAssistantMessage([fauxText(text)], { stopReason: 'stop' }),
    fauxAssistantMessage([fauxText(text)], { stopReason: 'stop' }),
    fauxAssistantMessage([fauxText(text)], { stopReason: 'stop' }),
  ]);
  return () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async (prompt = '') => prompt.startsWith('Review whether') ? JSON.stringify({ supported: true, issues: [] }) : JSON.stringify({ originalQuestion: 'sensor health', investigationId: 'case_001', entityScope: 'single', answerKind: 'health', mustCover: [], selectedSkillIds: ['health-status'], requiresClarification: false, confidence: .99, ...route }) });
}

test('chat runs the real agent/tool path, validates evidence and emits progress', async () => {
  const progress: ProgressEvent[] = [];
  const answer = await runChat({ caseId: 'case_001', text: 'Was the sensor online at capture start?', evidence: [] }, empty(), store, config, new AbortController().signal,
    (event) => progress.push(event), fakeRuntime('Sensor reported online with self-test PASS. [sensor.txt:L1]'));
  assert.equal(answer.validation, 'satisfied');
  assert.deepEqual(answer.citations, ['[sensor.txt:L1]']);
  assert.ok(progress.some((event) => event.type === 'tool_call' && event.tool === 'get_evidence'));
  assert.ok(answer.activity?.some((step) => step.title.includes('תיעוד המכ״ם')));
  assert.ok(answer.activity?.every((step) => step.state === 'complete'));
});

test('a real citation that the model never read cannot pass validation', async () => {
  await assert.rejects(runChat({ caseId: 'case_001', text: 'Was the sensor online?', evidence: [] }, empty(), store, config, new AbortController().signal, () => {},
    fakeRuntime('Online [sensor.txt:L1]', false)), /validation failed/);
});

test('fabricated citations fail even after bounded repair', async () => {
  await assert.rejects(runChat({ caseId: 'case_001', text: 'Was the sensor online?', evidence: [] }, empty(), store, config, new AbortController().signal, () => {},
    fakeRuntime('Online [sensor.txt:L99999]')), /validation failed/);
});

test('an all-systems health request still rejects a sensor-only answer', async () => {
  await assert.rejects(runChat({ caseId: 'case_001', text: 'Report the health of all systems', evidence: [] }, empty(), store, config, new AbortController().signal, () => {},
    fakeRuntime('radar-psr-01 was online [sensor.txt:L1]', true, { entityScope: 'all_available' })), /missing entities/i);
});

test('Hebrew component names satisfy coverage without forcing English service IDs into the answer', async () => {
  const text = '**המכ״ם פעל בתחילת הקליטה.** [sensor.txt:L1]\n\nמצב מקלט הזיהוי, מעבד העקיבה, מתאם המיקום, מערכת ההתראות ושרת התצוגה לא נבדק.';
  const answer = await runChat({ caseId: 'case_001', text: 'מה מצב כל המערכות?', evidence: [] }, empty(), store, config, new AbortController().signal, () => {},
    fakeRuntime(text, true, { entityScope: 'all_available' }));
  assert.equal(answer.validation, 'satisfied');
  assert.equal(answer.text, text);
});

test('long answers are shortened using existing citations and still pass evidence validation', async () => {
  const long = `**המכ״ם פעל בתחילת הקליטה.** [sensor.txt:L1]\n\n${'הבדיקה התייחסה לרשומה אחת בלבד ולא לכל משך הקליטה. '.repeat(16)}`;
  const concise = '**המכ״ם פעל בתחילת הקליטה.** הבדיקה מתייחסת לרשומה אחת בלבד, ולכן אין להסיק ממנה על כל משך הקליטה. [sensor.txt:L1]';
  const runtime = fakeRuntime(long)();
  const classify = runtime.complete;
  const prompts: string[] = [];
  const answer = await runChat({ caseId: 'case_001', text: 'מה מצב המכ״ם?', evidence: [] }, empty(), store, config, new AbortController().signal, () => {}, () => ({
    ...runtime, complete: async (prompt: string) => { if (prompt.startsWith('Review whether')) return JSON.stringify({ supported: true, issues: [] }); prompts.push(prompt); return prompts.length === 1 ? classify() : concise; },
  }));
  assert.equal(answer.text, concise);
  assert.equal(answer.validation, 'satisfied');
  assert.equal(prompts.length, 2);
  assert.ok(prompts[1]!.includes(JSON.stringify(long)));
});

test('chat renders bold text, paragraphs and lists with RTL and isolated clickable citations', async () => {
  const html = await renderToString(createSSRApp({ render: () => h(MessageBody, { text: 'GPS: **נמצאה סטייה זמנית.**\n\n- המיקום חזר לתקין. **[sniffer.csv:L17852]**\n- הסיבה עדיין לא ידועה.' }) }));
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<strong>נמצאה סטייה זמנית\.<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>/);
  assert.match(html, /<button[^>]*class="citation citation-link"[^>]*dir="rtl"/);
  assert.match(html, /<bdi dir="ltr">17852<\/bdi>/);
  assert.match(html, /data-evidence="\[sniffer.csv:L17852\]"/);
  assert.ok(!html.includes('**'));
});

test('compact citation links explain the source and keep the exact evidence reference', async () => {
  assert.equal(describeCitation('[operator_diary.xlsx:L4]').label, 'יומן · 4');
  const html = await renderToString(createSSRApp({ render: () => h(CitationLink, { badge: '[operator_diary.xlsx:L4]' }) }));
  assert.match(html, /aria-label="פתיחת יומן המפעיל, שורה 4"/);
  assert.match(html, /data-evidence="\[operator_diary.xlsx:L4\]"/);
  assert.match(html, /יומן · <bdi dir="ltr">4<\/bdi>/);
});

test('a finding with many sources folds its links without losing original references', async () => {
  const badges = ['[case_report.txt:L1]', '[sniffer.csv:L205]', '[system_catalog.txt:L2]', '[capture_manifest.json:L46]'];
  const html = await renderToString(createSSRApp({ render: () => h(MessageBody, { text: `ממצא מתוך הראיות. ${badges.join(' ')}` }) }));
  assert.match(html, /<details class="finding-sources">/);
  assert.match(html, /מקורות לממצא · 4/);
  for (const badge of badges) assert.ok(html.includes(`data-evidence="${badge}"`));
});

test('parallel tool progress updates the matching step with real counts and source links', () => {
  const events: ProgressEvent[] = [];
  let time = 1000;
  const reporter = new InvestigationProgress((event) => events.push(event), () => time++);
  reporter.status('מתחיל בדיקה');
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'a', toolName: 'query_events', args: { source_system: 'radar-psr-01', time_start_utc: '2026-10-08T11:00:00Z', time_end_utc: '2026-10-08T11:05:00Z' } });
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'b', toolName: 'query_events', args: { source_system: 'position-bridge' } });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'b', toolName: 'query_events', result: { details: { total: 0, rows: [] } }, isError: false });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'a', toolName: 'query_events', result: { details: { total: 90, rows: [{ badge: '[sensor.txt:L49]' }], nextOffset: 1 } }, isError: false });
  const steps = reporter.finish();
  assert.equal(steps.length, 3);
  assert.match(steps.find((step) => step.id === 'tool:a')!.title, /המכ״ם/);
  assert.match(steps.find((step) => step.id === 'tool:a')!.detail!, /90 רשומות/);
  assert.deepEqual(steps.find((step) => step.id === 'tool:a')!.citations, [], 'Search order does not select evidence for a semantic claim');
  assert.match(steps.find((step) => step.id === 'tool:b')!.detail!, /אין בכך הוכחה/);
  assert.ok(steps.every((step) => step.state === 'complete'));
  const start = events.find((event) => event.type === 'tool_call' && event.step?.id === 'tool:a')!;
  assert.equal(start.step!.state, 'running');
  assert.match(start.step!.detail!, /14:00:00/);
});

test('progress reports a tool failure without marking it complete or exposing raw error content', () => {
  const reporter = new InvestigationProgress(() => {});
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'a', toolName: 'get_evidence', args: { badge: '[sensor.txt:L49]' } });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'a', toolName: 'get_evidence', result: { content: [{ type: 'text', text: 'private error detail' }] }, isError: true });
  const steps = reporter.finish();
  assert.equal(steps[0]!.state, 'error');
  assert.ok(!JSON.stringify(steps).includes('private error detail'));
  assert.deepEqual(steps[0]!.citations, []);
});

test('progress ignores unvalidated model text and only publishes actions and results', () => {
  const events: ProgressEvent[] = [];
  const reporter = new InvestigationProgress((event) => events.push(event));
  reporter.onAgentEvent({ type: 'message_start', message: fauxAssistantMessage([fauxText('Internal draft that must not become progress')], { stopReason: 'stop' }) });
  assert.deepEqual(events, []);
  assert.deepEqual(reporter.finish(), []);
});

test('progress reports exact numeric summaries without inferred root causes', () => {
  const reporter = new InvestigationProgress(() => {});
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'n', toolName: 'analyze_fields', args: { field_a: 'site_external_lat', field_b: 'site_gps_lat' } });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'n', toolName: 'analyze_fields', result: { details: { count: 50, max_absolute_delta: .01079, evidence_references: ['[sniffer.csv:L17852]'] } }, isError: false });
  const step = reporter.finish()[0]!;
  assert.match(step.title, /המיקום החיצוני/);
  assert.match(step.detail!, /50 דגימות/);
  assert.match(step.detail!, /0.01079 מעלות/);
  assert.equal(step.state, 'complete');
});

test('model-authored HTML, images and unsafe links are not executed by the message renderer', async () => {
  const html = await renderToString(createSSRApp({ render: () => h(MessageBody, { text: '<script>alert(1)</script>\n\n<img src="https://example.invalid/private" onerror="alert(1)">\n\n[לחיצה](javascript:alert) ![תמונה](https://example.invalid/image)' }) }));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href='));
  assert.match(html, /&lt;script&gt;/);
});

test('cancellation prevents starting AI work', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runChat({ caseId: 'case_001', text: 'Was the sensor online?', evidence: [] }, empty(), store, config, controller.signal, () => {}, () => { throw new Error('Must not run'); }), /abort/i);
});

test('causal investigation validates coverage without inventing an all-systems health checklist', async () => {
  const conciseAnswer = '**לא ניתן לקבוע את הסיבה.** חלק מההודעות חסרות בקובץ שנמסר. [capture_manifest.json:L1]';
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('get_case_overview', { case_id: 'case_004' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxToolCall('submit_findings', { summary_finding_ids: ['F-test'], findings: [{ finding_id: 'F-test', investigation_id: 'case_004', status: 'ABSTENTION', title: 'Incomplete capture', claim: conciseAnswer, confidence: 0, rationale: 'Missing records do not prove absence.', evidence_citations: [{ badge: '[capture_manifest.json:L1]', source_file: 'capture_manifest.json', kind: 'manifest' }], missing_coverage_flag: true }], rationale: 'Coverage limitation' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxText('Done')], { stopReason: 'stop' }),
  ]);
  const answer = await runChat({ caseId: 'case_004', text: 'Why was a target not visible?', evidence: [] }, empty('case_004'), store, config, new AbortController().signal, () => {}, () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async (prompt) => prompt.startsWith('Review whether') ? JSON.stringify({ supported: true, issues: [] }) : JSON.stringify({ originalQuestion: 'Why?', investigationId: 'case_004', entityScope: 'specified', requestedEntities: ['track-core', 'ui-gateway', 'radar-psr-01'], answerKind: 'cause', mustCover: [], selectedSkillIds: ['root-cause-investigation'], requiresClarification: false, confidence: .99 }) }));
  assert.equal(answer.validation, 'satisfied');
  assert.equal(answer.text, conciseAnswer);
  assert.equal(answer.details?.[0]?.title, 'Incomplete capture');
  assert.match(answer.details![0]!.explanation, /Missing records do not prove absence/);
});

test('agent turn limits terminate a model that keeps calling tools', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses(Array.from({ length: 5 }, () => fauxAssistantMessage([fauxToolCall('get_evidence', { badge: '[sensor.txt:L1]' })], { stopReason: 'toolUse' })));
  const agent = createInvestigationAgent({ model: registry.getModel()!, streamFn: registry.streamFn, maxTurns: 2,
    tools: createDataTools(store, 'case_001', new Set(), new AbortController().signal) });
  await assert.rejects(agent.prompt('Read repeatedly'), /budget|abort/i);
});

test('HTTP API serves data, handles SSE, rejects cross-origin writes and persists only completed chat', async () => {
  const sessions = new SessionStore(join(temporary, 'http'));
  const handler = createApi({ store, sessions, getConfig: async () => config,
    chat: async (input, session, data, provider, signal, emit) => runChat(input, session, data, provider, signal, emit, fakeRuntime('Sensor online [sensor.txt:L1]')) });
  const server = createServer((request, response) => { void handler(request, response); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const status = await (await fetch(`${base}/status`)).json(); assert.equal(status.configured, true); assert.ok(!JSON.stringify(status).includes(config.apiKey));
    const page = await (await fetch(`${base}/cases/case_001/events?limit=2`)).json(); assert.equal(page.rows.length, 2);
    const points = await (await fetch(`${base}/cases/case_001/timeline-points?system=iff&start=2026-10-08T11:00:00Z&end=2026-10-08T11:01:00Z`)).json();
    assert.equal(points.totalRecords, 2);
    assert.ok(points.points.every((point: { system: string; badge: string }) => point.system === 'iff' && point.badge.startsWith('[sniffer.csv:')));
    assert.equal((await fetch(`${base}/cases/not-a-case/timeline-points`)).status, 400);
    const scope = 'start=2026-10-08T11:00:00Z&end=2026-10-08T11:05:00Z';
    const focus = await (await fetch(`${base}/cases/case_001/timeline-focus?${scope}`)).json();
    const group = focus.groups.find((group: { count: number }) => group.count > 1);
    assert.ok(group);
    const grouped = await (await fetch(`${base}/cases/case_001/timeline-group?${scope}&group=${group.id}&limit=2`)).json();
    assert.equal(grouped.page.total, group.count); assert.equal(grouped.page.rows.length, 2);
    assert.equal((await fetch(`${base}/cases/case_001/timeline-group?${scope}&group=unknown`)).status, 400);
    assert.equal((await fetch(`${base}/cases/not-a-case/timeline-focus`)).status, 400);
    assert.equal((await fetch(`${base}/cases/not-a-case/events`)).status, 400);
    assert.equal((await fetch(`${base}/cases/case_001/session`, { headers: { Origin: 'https://unrelated.example' } })).status, 403);
    const response = await fetch(`${base}/cases/case_001/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Check the sensor', evidence: [] }) });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /event-stream/);
    const events = await response.text(); assert.match(events, /"type":"tool_call"/); assert.match(events, /"type":"done"/);
    assert.equal((await sessions.read('case_001')).messages.length, 2);
    assert.equal((await fetch(`${base}/cases/case_001/chat`, { method: 'DELETE', headers: { Origin: 'https://unrelated.example' } })).status, 403);
    assert.equal((await sessions.read('case_001')).messages.length, 2);
    assert.equal((await fetch(`${base}/cases/not-a-case/chat`, { method: 'DELETE' })).status, 400);
    const cleared = await fetch(`${base}/cases/case_001/chat`, { method: 'DELETE' });
    assert.equal(cleared.status, 200);
    assert.deepEqual((await cleared.json()).messages, []);
    assert.deepEqual((await (await fetch(`${base}/cases/case_001/session`)).json()).messages, []);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('clearing chat waits for the active turn and the next turn has no old history', async () => {
  const sessions = new SessionStore(join(temporary, 'clear-chat-busy'));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const histories: number[] = [];
  const handler = createApi({ store, sessions, getConfig: async () => config, chat: async (_input, session) => {
    histories.push(session.messages.length);
    entered.resolve();
    await release.promise;
    return { id: `answer-${histories.length}`, role: 'assistant', text: 'Test answer', citations: [], createdAt: new Date().toISOString() };
  } });
  const server = createServer((request, response) => { void handler(request, response); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/cases/case_001/chat`;
  const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Test question' }) }).then(response => response.text());
  const first = send();
  try {
    await entered.promise;
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 409);
    release.resolve();
    assert.match(await first, /"type":"done"/);
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 200);
    assert.match(await send(), /"type":"done"/);
    assert.deepEqual(histories, [0, 0]);
    assert.equal((await sessions.read('case_001')).messages.length, 2);
  } finally {
    release.resolve(); await first;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
