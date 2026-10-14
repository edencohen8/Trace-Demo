import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EvidenceEvent } from '../src/demo/types.ts';
import { buildTimelineFocus, describeTimelineGroup, findTimelineStateChanges } from '../src/server/timeline-focus.ts';
import { EvidenceStore } from '../src/server/evidence-store.ts';

const start = '2026-10-08T11:00:00.000Z'; const end = '2026-10-08T11:05:00.000Z';
function event(index: number, extra: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return { id: `row-${index}`, badge: `[sniffer.csv:L${index + 2}]`, caseId: 'case_001', source: 'track-core', sourceFile: 'sniffer.csv',
    family: 'sniffer', line: index + 2, time: new Date(Date.parse(start) + index * 1000).toISOString(), type: 'TrackUpdate',
    severity: 'INFO', text: 'TrackUpdate', target: 'T-001', fields: { track_state: 'CONFIRMED', x_km: index, message_id: `M-${index}` }, ...extra };
}

test('focused groups cover every original row once with exact first and last timestamps', () => {
  const events = Array.from({ length: 250 }, (_, i) => event(i));
  const before = structuredClone(events); const index = buildTimelineFocus(events, start, end);
  assert.equal(index.result.totalRecords, 250);
  assert.ok(index.result.groups.length < 15);
  assert.equal(index.result.groups.reduce((sum, group) => sum + group.count, 0), events.length);
  assert.deepEqual([...index.members.values()].flat().map(row => row.badge).sort(), events.map(row => row.badge).sort());
  for (const group of index.result.groups) {
    assert.equal(group.time, index.members.get(group.id)![0]!.time);
    assert.equal(group.end, index.members.get(group.id)!.at(-1)!.time);
  }
  assert.deepEqual(events, before);
  assert.deepEqual(buildTimelineFocus([...events].reverse(), start, end).result, index.result);
});

test('zoom exposes individual records at 30 seconds without marking them as healthy', () => {
  const events = Array.from({ length: 25 }, (_, i) => event(i));
  const wide = buildTimelineFocus(events, start, end).result;
  const narrow = buildTimelineFocus(events, start, '2026-10-08T11:00:30.000Z').result;
  assert.equal(wide.groups.length, 1);
  assert.equal(narrow.groups.length, events.length);
  assert.ok(narrow.groups.every(group => group.kind === 'record' && group.count === 1));
});

test('INFO lifecycle/config messages, warnings, diary and unfamiliar types stay out of activity groups', () => {
  const events = [event(0), event(1, { type: 'FilterConfigApplied' }), event(2, { type: 'TrackTerminated' }),
    event(3, { type: 'UnknownNewEvent' }), event(4, { severity: 'WARN' }),
    event(5, { source: 'operator', family: 'operator_diary', type: 'OperatorNote' })];
  const index = buildTimelineFocus(events, start, end);
  for (const row of events.slice(1)) assert.ok(index.result.groups.some(group => group.badge === row.badge && group.kind !== 'activity'));
});

test('state changes are source/target scoped and remain visible at the left viewport edge', () => {
  const events = [event(0), event(1, { target: 'T-002', fields: { track_state: 'TENTATIVE' } }),
    event(2, { fields: { track_state: 'TERMINATED' } }), event(3, { fields: { track_state: 'CONFIRMED' } })];
  const changes = findTimelineStateChanges(events);
  assert.deepEqual([...changes], [events[2]!.badge, events[3]!.badge]);
  const index = buildTimelineFocus(events.slice(2), events[2]!.time, end, changes);
  assert.ok(index.result.groups.every(group => group.kind === 'change'));
});

test('series keep targets and categorical state separate and retain numeric extrema with source links', () => {
  const events = [event(0), event(1, { fields: { track_state: 'CONFIRMED', x_km: 900 } }),
    event(2, { target: 'T-002' }), event(3, { fields: { track_state: 'CONFIRMED', x_km: -4 } }),
    event(4, { fields: { track_state: 'TENTATIVE', x_km: 2 } })];
  const index = buildTimelineFocus(events, start, end, new Set());
  const detail = describeTimelineGroup(index, index.result.groups[0]!.id);
  assert.equal(detail.series.length, 3);
  const primary = detail.series.find(series => series.count === 3)!;
  assert.deepEqual(primary.ranges, [{ field: 'x_km', min: -4, max: 900, minBadge: events[3]!.badge, maxBadge: events[1]!.badge }]);
  const scoped = describeTimelineGroup(index, detail.group.id, 1, 1, primary.id);
  assert.equal(scoped.page.total, 3); assert.equal(scoped.page.rows[0]!.badge, events[1]!.badge);
  assert.equal(scoped.page.nextOffset, 2);
  assert.throws(() => describeTimelineGroup(index, detail.group.id, 0, 80, 'unrelated'));
  assert.throws(() => describeTimelineGroup(index, 'unrelated'));
});

test('identical warning floods become counted markers without merging different messages or sources', () => {
  const events = Array.from({ length: 1000 }, (_, i) => event(i, { time: new Date(Date.parse(start) + i).toISOString(),
    severity: 'WARN', family: 'component_log', fields: {}, text: 'retry failed' }));
  events.push(event(1001, { time: start, severity: 'WARN', family: 'component_log', fields: {}, text: 'other error' }));
  events.push(event(1002, { time: start, source: 'position-bridge', severity: 'WARN', family: 'component_log', fields: {}, text: 'retry failed' }));
  const index = buildTimelineFocus(events, start, end);
  assert.equal(index.result.groups.length, 3);
  assert.equal(index.result.groups.reduce((sum, group) => sum + group.count, 0), 1002);
  const flood = index.result.groups.find(group => group.count === 1000)!;
  const detail = describeTimelineGroup(index, flood.id, 0, 10000);
  assert.equal(detail.page.rows.length, 500);
  assert.equal(detail.page.nextOffset, 500);
});

const store = new EvidenceStore();
test('all four real cases preserve counts, evidence and filters in focused mode', async () => {
  for (const id of ['case_001', 'case_002', 'case_003', 'case_004']) {
    const scope = { start, end };
    const focus = await store.timelineFocus(id, scope);
    const rows = await store.query(id, scope);
    assert.equal(focus.totalRecords, rows.total);
    assert.equal(focus.groups.reduce((sum, group) => sum + group.count, 0), rows.total);
    assert.ok(focus.groups.length < rows.total / 2);
    const group = focus.groups.find(group => group.kind === 'activity' && group.count > 1)!;
    const detail = await store.timelineGroup(id, group.id, { ...scope, limit: 500 });
    assert.equal(detail.page.total, group.count);
    assert.equal(detail.series.reduce((sum, series) => sum + series.count, 0), group.count);
    for (const row of detail.page.rows) assert.equal((await store.resolve(id, row.badge)).event!.time, row.time);
    await assert.rejects(store.timelineGroup(id, group.id, { ...scope, system: 'radio' }));
    const narrow = await store.timelineFocus(id, { ...scope, source: 'track-core', target: 'T-014' });
    assert.equal(narrow.totalRecords, (await store.query(id, { ...scope, source: 'track-core', target: 'T-014' })).total);
    assert.ok(narrow.groups.every(group => group.system === 'services'));
  }
  assert.deepEqual((await store.timelineFocus('case_001', { system: 'radio' })).groups, []);
  await assert.rejects(store.timelineFocus('not-a-case'));
  await assert.rejects(store.timelineFocus('case_001', { start: '2026-10-08T11:00:00' }));
  await assert.rejects(store.timelineGroup('case_001', 'missing'));
});
