import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { evidencePoint, evidenceWindow, interpolateWindow, messageReferences, timeAtPointer } from '../src/demo/evidence-focus.ts';
import { parseChatTimeRange, questionWithTimeRange } from '../src/server/chat-time-range.ts';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { SessionStore } from '../src/server/session-store.ts';
import { createApi } from '../src/server/api.ts';
import { runChat, type ChatInput } from '../src/server/chat.ts';
import { createRuntime, type AIConfig } from '../src/server/config.ts';
import { initModelRegistry } from '../src/agent/provider.ts';
import { createRenderer, h, ref } from 'vue';
import { useEvidenceFocus } from '../src/demo/use-evidence-focus.ts';
import type { ChatMessage, EvidenceEvent } from '../src/demo/types.ts';

const store = new EvidenceStore();
const config: AIConfig = { provider: 'anthropic', model: 'claude-haiku-5-5', apiKey: 'test-only', baseUrl: '' };
const at = (time: number) => ({ time: new Date(time).toISOString() }) as EvidenceEvent;
const recording = { start: 0, end: 3_600_000 };

test('focus fits exact milliseconds, pads the evidence interval, and clamps both recording edges', () => {
  const fit = evidenceWindow([at(60_085), at(80_442)], recording)!;
  assert.ok(fit.start < 60_085 && fit.end > 80_442);
  assert.equal(fit.end - fit.start, 30_000);
  assert.deepEqual(evidenceWindow([at(85)], recording), { start: 0, end: 30_000 });
  assert.deepEqual(evidenceWindow([at(3_599_999)], recording), { start: 3_570_000, end: 3_600_000 });
  assert.deepEqual(evidenceWindow([at(0), at(recording.end)], recording), recording);
  assert.deepEqual(evidenceWindow([at(50)], { start: 0, end: 100 }), { start: 0, end: 100 });
  assert.equal(evidenceWindow([], recording), undefined);
  assert.equal(evidenceWindow([{ time: 'not a timestamp' } as EvidenceEvent], recording), undefined);
  assert.equal(evidenceWindow([at(-1)], recording), undefined);
});

test('camera interpolation stays bounded, preserves positive duration, and lands exactly', () => {
  const from = { start: 0, end: 300_000 }; const to = { start: 3_570_000, end: 3_600_000 };
  for (const [a, b] of [[from, to], [to, from]] as const) {
    assert.deepEqual(interpolateWindow(a, b, 0, recording), a);
    assert.deepEqual(interpolateWindow(a, b, 1, recording), b);
    for (let index = 0; index <= 100; index++) {
      const frame = interpolateWindow(a, b, index / 100, recording);
      assert.ok(frame.start >= recording.start && frame.end <= recording.end);
      assert.ok(frame.end > frame.start);
    }
  }
});

test('answer focus includes all displayed findings, deduplicates citations, and excludes tool history', () => {
  const message: ChatMessage = { id: 'answer', role: 'assistant', createdAt: '', citations: ['[sensor.txt:L1]'],
    text: 'One [sensor.txt:L1] and two [sniffer.csv:L20]',
    details: [{ title: 'More', explanation: 'Three [sensor.txt:L2]', citations: ['[sensor.txt:L2]', '[sniffer.csv:L21]'] }],
    activity: [{ id: 'tool:1', title: 'Looked up', state: 'complete', startedAt: 0, citations: ['[sensor.txt:L99]'] }] };
  assert.deepEqual(messageReferences(message), ['[sensor.txt:L1]', '[sniffer.csv:L20]', '[sensor.txt:L2]', '[sniffer.csv:L21]']);
});

test('evidence pins resolve original records even when a grouped marker has a different representative', async () => {
  const source = await store.resolve('case_001', '[sniffer.csv:L17313]');
  const point = evidencePoint(source.event!)!;
  assert.equal(point.badge, source.badge);
  assert.equal(point.time, source.event!.time);
  assert.equal(point.count, 1);
  assert.equal(point.system, 'sensor');
  const diary = await store.resolve('case_001', '[operator_diary.xlsx:L4]');
  assert.equal(evidencePoint(diary.event!)?.diary, true);
  const manifest = await store.resolve('case_001', '[capture_manifest.json:L1]');
  assert.equal(manifest.event, undefined);
});

test('range selection follows LTR time, preserves milliseconds, and clamps off-track pointers', () => {
  const window = { start: 123_001, end: 153_001 };
  assert.equal(timeAtPointer(window, 400, 100, 1000), 132_001);
  assert.equal(timeAtPointer(window, -100, 100, 1000), window.start);
  assert.equal(timeAtPointer(window, 2000, 100, 1000), window.end);
});

function mountFocus() {
  const renderer = createRenderer<Record<string, unknown>, Record<string, unknown>>({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  });
  const caseId = ref('case_001');
  let focus!: ReturnType<typeof useEvidenceFocus>;
  const app = renderer.createApp({ setup() { focus = useEvidenceFocus(caseId); return () => h('div'); } });
  app.mount({});
  return { caseId, focus, unmount: () => app.unmount() };
}

test('a later citation click wins even when an earlier source resolves last; case changes discard pending focus', async () => {
  const replies = new Map<string, (response: Response) => void>();
  const fetchMock = mock.method(globalThis, 'fetch', (path: string) => new Promise<Response>(resolve => { replies.set(new URL(path, 'http://test').searchParams.get('badge')!, resolve); }));
  const view = mountFocus();
  try {
    const first = view.focus.focus(['[sensor.txt:L1]'], 'first');
    const second = view.focus.focus(['[sensor.txt:L2]'], 'second');
    replies.get('[sensor.txt:L2]')!(Response.json(await store.resolve('case_001', '[sensor.txt:L2]')));
    await second;
    replies.get('[sensor.txt:L1]')!(Response.json(await store.resolve('case_001', '[sensor.txt:L1]')));
    assert.equal(await first, undefined);
    assert.equal(view.focus.messageId.value, 'second');
    assert.deepEqual([...view.focus.active.value], ['[sensor.txt:L2]']);
    const previousCase = view.focus.focus(['[sensor.txt:L3]']);
    view.caseId.value = 'case_002';
    replies.get('[sensor.txt:L3]')!(Response.json(await store.resolve('case_001', '[sensor.txt:L3]')));
    assert.equal(await previousCase, undefined);
    assert.equal(view.focus.events.value.length, 0);
    assert.equal(view.focus.pending.value, false);
  } finally { view.unmount(); fetchMock.mock.restore(); }
});

test('source reads are bounded and manual cancellation prevents queued requests and late highlights', async () => {
  const replies: Array<(response: Response) => void> = [];
  const fetchMock = mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { replies.push(resolve); }));
  const view = mountFocus();
  try {
    const request = view.focus.focus(Array.from({ length: 25 }, (_, index) => `[sensor.txt:L${index + 1}]`));
    assert.equal(replies.length, 6);
    view.focus.cancelPending();
    for (const resolve of replies) resolve(Response.json(await store.resolve('case_001', '[sensor.txt:L1]')));
    assert.equal(await request, undefined);
    assert.equal(fetchMock.mock.callCount(), 6);
    assert.equal(view.focus.events.value.length, 0);
  } finally { view.unmount(); fetchMock.mock.restore(); }
});

test('a failed source can be retried and metadata sources never get fake timeline pins', async () => {
  let failed = true;
  const fetchMock = mock.method(globalThis, 'fetch', async () => failed
    ? Response.json({ error: 'temporary failure' }, { status: 503 })
    : Response.json(await store.resolve('case_001', '[capture_manifest.json:L1]')));
  const view = mountFocus();
  try {
    await view.focus.focus(['[capture_manifest.json:L1]']);
    assert.match(view.focus.notice.value, /לא נטענו/);
    failed = false;
    await view.focus.focus(['[capture_manifest.json:L1]']);
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal(view.focus.sources.value.length, 1);
    assert.equal(view.focus.events.value.length, 0);
    assert.match(view.focus.notice.value, /ללא זמן אירוע/);
  } finally { view.unmount(); fetchMock.mock.restore(); }
});

test('chat time scope accepts explicit offsets and rejects ambiguous or invalid intervals', () => {
  const bounds = { start: '2026-10-08T10:15:00.000Z', end: '2026-10-08T11:45:00.000Z' };
  assert.deepEqual(parseChatTimeRange({ start: '2026-10-08T14:02:00.085+03:00', end: '2026-10-08T14:03:00.442+03:00' }, bounds),
    { start: '2026-10-08T11:02:00.085Z', end: '2026-10-08T11:03:00.442Z' });
  for (const value of [null, [], {}, { start: '2026-10-08T14:02:00', end: bounds.end },
    { start: bounds.end, end: bounds.start }, { start: bounds.start, end: bounds.start },
    { start: '2026-10-08T10:00:00Z', end: bounds.end }]) assert.throws(() => parseChatTimeRange(value, bounds));
  assert.equal(parseChatTimeRange(undefined, bounds), undefined);
  assert.equal(questionWithTimeRange('Question'), 'Question');
});

test('selected interval overrides a router time guess and reaches the actual agent prompt', async () => {
  const range = { start: '2026-10-08T10:15:00.000Z', end: '2026-10-08T10:16:00.000Z' };
  const registry = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  registry.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('get_evidence', { badge: '[sensor.txt:L1]' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxText('המכ״ם דיווח על אתחול תקין. [sensor.txt:L1]')], { stopReason: 'stop' }),
  ]);
  let routerPrompt = ''; const contexts: string[] = [];
  const runtime: typeof createRuntime = () => ({ model: registry.getModel()!,
    streamFn: (model, context, options) => { contexts.push(JSON.stringify(context)); return registry.streamFn(model, context, options); },
    complete: async prompt => { routerPrompt = prompt; return JSON.stringify({ entityScope: 'single', answerKind: 'health', mustCover: [],
      selectedSkillIds: ['health-status'], requiresClarification: false, confidence: .99,
      requestedTime: { start: '2026-10-08T11:00:00Z', end: '2026-10-08T11:05:00Z' } }); } });
  await runChat({ caseId: 'case_001', text: 'מה מצב המכ״ם בטווח שנבחר?', evidence: [], timeRange: range },
    { caseId: 'case_001', messages: [], lessons: [] }, store, config, new AbortController().signal, () => {}, runtime);
  assert.ok(routerPrompt.includes(range.start) && routerPrompt.includes(range.end));
  assert.ok(contexts.some(context => context.includes('Selected timeline range (UTC, inclusive)')));
  assert.ok(contexts.some(context => context.includes(JSON.stringify(range).replaceAll('"', '\\"'))));
});

test('HTTP chat validates and persists selected scope without changing the displayed question', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trace-range-test-'));
  const sessions = new SessionStore(directory); let received: ChatInput | undefined;
  const api = createApi({ store, sessions, getConfig: async () => config, chat: async input => {
    received = input;
    return { id: 'answer', role: 'assistant', text: 'Verified [sensor.txt:L1]', citations: ['[sensor.txt:L1]'], createdAt: new Date().toISOString() };
  } });
  const server = createServer((request, response) => { void api(request, response); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/cases/case_001/chat`;
    const timeRange = { start: '2026-10-08T11:02:00.085Z', end: '2026-10-08T11:03:00.442Z' };
    const post = (range: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'What happened here?', evidence: [], timeRange: range }) });
    const response = await post(timeRange);
    assert.equal(response.status, 200); assert.match(await response.text(), /"type":"done"/);
    assert.deepEqual(received?.timeRange, timeRange);
    const saved = (await sessions.read('case_001')).messages[0]!;
    assert.equal(saved.text, 'What happened here?'); assert.deepEqual(saved.timeRange, timeRange);
    assert.equal((await post({ ...timeRange, end: timeRange.start })).status, 400);
    assert.equal((await sessions.read('case_001')).messages.length, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
