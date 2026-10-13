import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { createDataTools } from '../src/server/tools.ts';
import { runChat } from '../src/server/chat.ts';
import type { AIConfig } from '../src/server/config.ts';
import { initModelRegistry } from '../src/agent/provider.ts';
import { fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import type { EvidenceEvent } from '../src/demo/types.ts';
import { decimalDifference } from '../src/server/decimal.ts';

const store = new EvidenceStore();

test('JSON component logs retain numeric fields at the end of the decoded message', async () => {
  const evidence = await store.resolve('case_003', '[notification_service.txt:L2]');
  assert.equal(evidence.event?.fields.backlog, 0);
  const calculation = await store.analyze('case_003', {
    source: 'alert-router', messageType: 'ComponentLog', fieldA: 'backlog', operation: 'stats',
  }) as { count: number; max: number };
  assert.ok(calculation.count > 0, 'Heartbeat backlog values must be available for analysis');
});

test('Mode 3/A identifiers keep their four-character source representation', async () => {
  const page = await store.query('case_003', { messageType: 'IFFReply', limit: 50 });
  assert.ok(page.rows.length > 0);
  for (const event of page.rows) {
    const code = event.fields.transponder_mode3a;
    assert.equal(typeof code, 'string', 'An octal identifier is not a numeric measurement');
    assert.match(String(code), /^[0-7]{4}$/);
    const evidence = await store.resolve('case_003', event.badge, 0);
    assert.ok(evidence.lines[0]!.content.includes(`,${code},`));
  }
});

test('original lines shown around evidence can be cited without another tool call', async () => {
  const seen = new Set<string>();
  const tool = createDataTools(store, 'case_001', seen, new AbortController().signal)
    .find((entry) => entry.name === 'get_evidence')!;
  await tool.execute('context', { badge: '[sensor.txt:L2]' });
  for (const line of [1, 2, 3, 4]) assert.ok(seen.has(`[sensor.txt:L${line}]`), `Displayed source line ${line} is available evidence`);
  assert.equal(seen.has('[sensor.txt:L5]'), false, 'Unread lines remain unavailable');
});

for (const attached of [false, true]) {
  test(`chat accepts a displayed context line without a repair (${attached ? 'attachment' : 'tool'})`, async () => {
    const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
    registry.fauxInstance!.setResponses([
      ...(!attached ? [fauxAssistantMessage([fauxToolCall('get_evidence', { badge: '[sensor.txt:L2]' })], { stopReason: 'toolUse' })] : []),
      fauxAssistantMessage([fauxText('The receiver is ACTIVE and sync is LOCKED [sensor.txt:L3].')], { stopReason: 'stop' }),
    ]);
    let calls = 0;
    const config: AIConfig = { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' };
    const answer = await runChat({ caseId: 'case_001', text: 'What does the nearby sensor record say?', evidence: attached ? ['[sensor.txt:L2]'] : [] },
      { caseId: 'case_001', messages: [], lessons: [] }, store, config, new AbortController().signal, () => {},
      () => ({ model: registry.getModel()!, streamFn: (model, context, options) => {
        assert.ok(++calls <= (attached ? 1 : 2), 'Valid context evidence must not trigger a repair call');
        return registry.streamFn(model, context, options);
      }, complete: async () => JSON.stringify({
        entityScope: 'single', answerKind: 'evidence_followup', mustCover: [], selectedSkillIds: [],
        requiresClarification: false, confidence: 1,
      }) }));
    assert.equal(answer.validation, 'satisfied');
    assert.deepEqual(answer.citations, ['[sensor.txt:L3]']);
    assert.equal(calls, attached ? 1 : 2);
  });
}

test('time-window query results match a full scan including exact boundaries', async () => {
  const all: EvidenceEvent[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await store.query('case_001', { offset, limit: 500 });
    all.push(...page.rows);
    if (page.nextOffset === null) break;
  }
  const pivot = all[Math.floor(all.length / 2)]!.time;
  const windows = [
    { start: pivot, end: pivot },
    { start: '2026-10-08T11:03:00.000Z', end: '2026-10-08T11:03:05.000Z' },
    { start: '2026-10-08T14:03:00+03:00', end: '2026-10-08T14:03:05+03:00' },
    { start: '2027-01-01T00:00:00Z', end: '2027-01-01T00:00:01Z' },
  ];
  for (const window of windows) {
    const expected = all.filter((row) => Date.parse(row.time) >= Date.parse(window.start) && Date.parse(row.time) <= Date.parse(window.end));
    const actual = await store.query('case_001', { ...window, limit: 500 });
    assert.equal(actual.total, expected.length);
    assert.deepEqual(actual.rows, expected.slice(0, 500));
  }
});

test('query and timeline filters reject timestamps without an explicit timezone', async () => {
  const window = { start: '2026-10-08T11:03:00', end: '2026-10-08T11:04:00' };
  await assert.rejects(store.query('case_001', window), /timezone|timestamp/i);
  await assert.rejects(store.timeline('case_001', window), /timezone|timestamp/i);
});

test('diary source inspection labels Excel wall-clock cells with their real timezone', async () => {
  const evidence = await store.resolve('case_001', '[operator_diary.xlsx:L4]', 0);
  const cells = JSON.parse(evidence.lines[0]!.content) as unknown[];
  assert.equal(cells[1], '2026-10-08T14:03:00.000+03:00');
  assert.equal(cells[2], '2026-10-08T14:08:10.000+03:00');
  assert.equal(Date.parse(String(cells[1])), Date.parse(evidence.event!.time));
  assert.equal(Date.parse(String(cells[2])), Date.parse(evidence.event!.recordedTime!));
});

test('gap calculations distinguish record counts from measured intervals', async () => {
  const result = await store.analyze('case_001', { messageType: 'RadarScan', fieldA: 'capture_time_utc', operation: 'gaps' }) as {
    count: number; interval_count: number; largest_gaps: { seconds: number; from: string; to: string }[];
  };
  assert.equal(result.count, 1080);
  assert.equal(result.interval_count, 1079);
  const largest = result.largest_gaps[0]!;
  assert.equal(largest.seconds, 5.143);
  const from = (await store.resolve('case_001', largest.from)).event!;
  const to = (await store.resolve('case_001', largest.to)).event!;
  assert.equal(Date.parse(to.time) - Date.parse(from.time), largest.seconds * 1000);
});

test('decimal field differences do not invent precision from binary floating-point tails', async () => {
  assert.equal(decimalDifference(0.3, 0.2), 0.1);
  assert.equal(decimalDifference(1e-7, 2e-7), -1e-7);
  assert.equal(decimalDifference(-1.1, -1.2), 0.1);
  assert.equal(decimalDifference(1e21, 2e21), -1e21);
  assert.throws(() => decimalDifference(Infinity, 0), /non-finite/);
  const result = await store.analyze('case_002', {
    messageType: 'PositionReport', fieldA: 'site_external_lat', fieldB: 'site_gps_lat', operation: 'delta',
  }) as { max_absolute_delta: number; peak: { value: number; evidence_ref: string } };
  assert.equal(result.max_absolute_delta, 0.0107904);
  assert.equal(result.peak.value, 0.0107904);
  assert.equal(result.peak.evidence_ref, '[sniffer.csv:L17852]');
});

test('coverage follow-ups can inspect the complete manifest in one tool call', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('get_case_overview', {})], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxText('Both types were excluded from this export; absence does not prove inactivity [capture_manifest.json:L1].')], { stopReason: 'stop' }),
  ]);
  let overviewRead = false;
  const answer = await runChat({ caseId: 'case_004', text: 'Does the export include DetectionCandidate?', evidence: [] },
    { caseId: 'case_004', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal,
    (event) => { if (event.type === 'tool_result' && event.tool === 'get_case_overview' && event.step?.state === 'complete') overviewRead = true; },
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async () => JSON.stringify({
      entityScope: 'single', answerKind: 'evidence_followup', mustCover: [], selectedSkillIds: [], requiresClarification: false, confidence: 1,
    }) }));
  assert.equal(overviewRead, true, 'The agent must be able to inspect coverage without paging through manifest lines');
  assert.equal(answer.validation, 'satisfied');
});

test('grouped citations are formatted without a model repair, while unread groups are rejected', async () => {
  for (const format of ['full', 'shorthand', 'mixed']) for (const unread of [false, true]) {
    const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
    const text = `The receiver is ACTIVE and sync is LOCKED${format === 'mixed' ? '; delivery heartbeat is present' : ''} [sensor.txt:L2, ${format === 'full' ? 'sensor.txt:' : ''}L${unread ? 5 : 3}${format === 'mixed' ? '; notification_service.txt:L2' : ''}].`;
    registry.fauxInstance!.setResponses([
      fauxAssistantMessage([fauxText(text)], { stopReason: 'stop' }),
      fauxAssistantMessage([fauxText(text)], { stopReason: 'stop' }),
    ]);
    let calls = 0;
    const answer = runChat({ caseId: 'case_001', text: 'Summarize the attached source lines.', evidence: ['[sensor.txt:L2]', ...(format === 'mixed' ? ['[notification_service.txt:L2]'] : [])] },
      { caseId: 'case_001', messages: [], lessons: [] }, store,
      { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
      () => ({ model: registry.getModel()!, streamFn: (model, context, options) => {
        calls++; return registry.streamFn(model, context, options);
      }, complete: async () => JSON.stringify({ entityScope: 'single', answerKind: 'evidence_followup',
        mustCover: [], selectedSkillIds: [], requiresClarification: false, confidence: 1 }) }));
    if (unread) await assert.rejects(answer, /not read during this investigation/);
    else {
      assert.deepEqual((await answer).citations, ['[sensor.txt:L2]', '[sensor.txt:L3]', ...(format === 'mixed' ? ['[notification_service.txt:L2]'] : [])]);
      assert.equal(calls, 1, 'Citation formatting must not consume a model repair call');
    }
  }
});

test('causal fallback composes from all findings and limitations in the requested language', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  const finding = { finding_id: 'F-qa', investigation_id: 'case_001', status: 'ABSTENTION',
    title: 'מצב החיישן', claim: 'החיישן דיווח שהוא פעיל.', confidence: 0,
    rationale: 'The cause is unknown because the transport was not checked.', missing_coverage_flag: true,
    evidence_citations: [1, 2, 3].map((line) => ({ badge: `[sensor.txt:L${line}]`, source_file: 'sensor.txt', kind: 'source_locator' })),
  };
  registry.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('submit_findings', { findings: [finding], rationale: 'Only the attached records were checked.' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxText('Done')], { stopReason: 'stop' }),
  ]);
  let completions = 0;
  const expected = 'The sensor reported ACTIVE [sensor.txt:L2] [sensor.txt:L3]. The cause is unknown because the transport was not checked [sensor.txt:L1].';
  const answer = await runChat({ caseId: 'case_001', text: 'Use English. Why did this happen?', evidence: ['[sensor.txt:L2]'] },
    { caseId: 'case_001', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async (prompt) => {
      if (++completions === 1) return JSON.stringify({ entityScope: 'single', answerKind: 'cause', mustCover: [],
        selectedSkillIds: ['root-cause-investigation'], requiresClarification: false, confidence: 1 });
      assert.match(prompt, /Use English/);
      assert.match(prompt, /transport was not checked/);
      for (const citation of finding.evidence_citations) assert.ok(prompt.includes(citation.badge));
      return expected;
    } }));
  assert.equal(completions, 2, 'Missing user-facing answers must be composed from the full findings');
  assert.equal(answer.text, expected);
});

test('an explicit English request corrects a Hebrew draft without changing evidence', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses([fauxAssistantMessage([
    fauxText('החיישן דיווח שהוא פעיל. אין די מידע לקבוע את הסיבה לתקלה. [sensor.txt:L2]'),
  ], { stopReason: 'stop' })]);
  let completions = 0;
  const expected = 'The sensor reported ACTIVE. There is not enough evidence to determine the cause [sensor.txt:L2].';
  const answer = await runChat({ caseId: 'case_001', text: 'Use English. Explain the attached evidence.', evidence: ['[sensor.txt:L2]'] },
    { caseId: 'case_001', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async (prompt) => {
      if (++completions === 1) return JSON.stringify({ entityScope: 'single', answerKind: 'evidence_followup', mustCover: [],
        selectedSkillIds: [], requiresClarification: false, confidence: 1 });
      assert.match(prompt, /English/);
      return expected;
    } }));
  assert.equal(answer.text, expected);
  assert.deepEqual(answer.citations, ['[sensor.txt:L2]']);
  assert.equal(completions, 2);
});

test('numeric answers preserve requested measurements without an automatic editing call', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  const original = `There are 30 samples. The maximum absolute latitude difference is 0.0107904 degrees at 11:03:56.457 UTC [sniffer.csv:L17852]. ${'This is an observed difference between two source fields; its cause remains unknown. '.repeat(10)}`;
  registry.fauxInstance!.setResponses([fauxAssistantMessage([fauxText(original)], { stopReason: 'stop' })]);
  let completions = 0;
  const answer = await runChat({ caseId: 'case_002', text: 'Use English. Give the maximum latitude difference, sample count and exact peak time.', evidence: ['[sniffer.csv:L17852]'] },
    { caseId: 'case_002', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async () => {
      if (++completions === 1) return JSON.stringify({ entityScope: 'single', answerKind: 'signal', mustCover: [],
        selectedSkillIds: ['signal-analysis'], requiresClarification: false, confidence: 1 });
      return 'The largest latitude difference was about 0.0108 degrees [sniffer.csv:L17852]. Its cause is unknown.';
    } }));
  assert.equal(answer.text, original);
  assert.equal(completions, 1, 'Validated numeric results must not incur a lossy editing call');
});

test('causal answers retain source links and qualifications without a second rewrite', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  const original = `The transport reported a delivery acknowledgement [notification_service.txt:L58]. The earlier retry was deferred [notification_service.txt:L56]. ${'A transport acknowledgement does not establish when the operator saw the alert on screen. '.repeat(10)}`;
  registry.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('submit_findings', { answer: original,
      findings: [{ finding_id: 'F-delivery', investigation_id: 'case_003', status: 'ABSTENTION', title: 'Display time unknown',
        claim: 'The transport acknowledged delivery; the actual display time is unknown.', confidence: 0,
        rationale: 'No console display record was checked.', missing_coverage_flag: true,
        evidence_citations: [{ badge: '[notification_service.txt:L58]', source_file: 'notification_service.txt', kind: 'source_locator' }],
      }], rationale: 'Transport acknowledgement only' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxText('Done')], { stopReason: 'stop' }),
  ]);
  let completions = 0;
  const answer = await runChat({ caseId: 'case_003', text: 'Use English. Why was the alert delayed?', evidence: ['[notification_service.txt:L58]'] },
    { caseId: 'case_003', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async () => {
      if (++completions === 1) return JSON.stringify({ entityScope: 'single', answerKind: 'cause', mustCover: [],
        selectedSkillIds: ['root-cause-investigation'], requiresClarification: false, confidence: 1 });
      return 'The operator saw the alert after a retry [notification_service.txt:L56].';
    } }));
  assert.equal(answer.text, original.trim());
  assert.equal(completions, 1);
});

test('optional prose editing cannot discard original supporting citations', async () => {
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  const original = `The radar reported online [sensor.txt:L1]. The receiver reported ACTIVE [sensor.txt:L2]. ${'These records describe a short part of the capture; later operation was not checked. '.repeat(10)}`;
  registry.fauxInstance!.setResponses([fauxAssistantMessage([fauxText(original)], { stopReason: 'stop' })]);
  let completions = 0;
  const answer = await runChat({ caseId: 'case_001', text: 'Describe the sensor status.', evidence: ['[sensor.txt:L2]'] },
    { caseId: 'case_001', messages: [], lessons: [] }, store,
    { provider: 'anthropic', model: 'test', apiKey: 'test-only', baseUrl: '' }, new AbortController().signal, () => {},
    () => ({ model: registry.getModel()!, streamFn: registry.streamFn, complete: async () => {
      if (++completions === 1) return JSON.stringify({ entityScope: 'single', answerKind: 'health', mustCover: [],
        selectedSkillIds: ['health-status'], requiresClarification: false, confidence: 1 });
      return 'The radar and receiver were online [sensor.txt:L2]. Later operation was not checked.';
    } }));
  assert.equal(answer.text, original);
  assert.equal(completions, 2);
});
