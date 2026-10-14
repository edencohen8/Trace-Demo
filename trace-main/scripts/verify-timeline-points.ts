import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelinePoints } from '../src/server/timeline-points.ts';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import type { EvidenceEvent } from '../src/demo/types.ts';
import { layoutTimelinePoints } from '../src/demo/point-layout.ts';
import { panTimeWindow, wheelZoomFactor, zoomTimeWindow } from '../src/demo/time-window.ts';

function event(index: number, ms: number, extra: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return { id: `record-${index}`, badge: `[sensor.txt:L${index + 1}]`, caseId: 'case_001',
    source: 'radar-psr-01', sourceFile: 'sensor.txt', family: 'component_log', line: index + 1,
    time: new Date(Date.parse('2026-10-08T11:00:00Z') + ms).toISOString(), type: 'ComponentLog',
    severity: 'INFO', text: 'Source record', fields: {}, ...extra };
}

test('timeline markers preserve irregular source timestamps instead of uniform bins', () => {
  const records = [event(0, 85), event(1, 1250), event(2, 17331)];
  const result = buildTimelinePoints(records);
  assert.deepEqual(result.points.map(point => point.time), records.map(row => row.time));
  assert.deepEqual(result.points.map(point => point.badge), records.map(row => row.badge));
  assert.equal(result.totalRecords, 3);
  assert.equal(result.truncated, false);
});

test('only records from the same system and exact instant share a marker', () => {
  const result = buildTimelinePoints([event(0, 85), event(1, 85, { severity: 'ERROR' }),
    event(2, 86), event(3, 85, { source: 'ui-gateway' })]);
  assert.equal(result.totalPoints, 3);
  assert.equal(result.points.reduce((sum, point) => sum + point.count, 0), 4);
  const group = result.points.find(point => point.system === 'sensor' && point.count === 2)!;
  assert.equal(group.badge, '[sensor.txt:L2]');
  assert.equal(group.severity, 'ERROR');
});

test('nearby markers spread vertically without moving their source times', () => {
  const points = buildTimelinePoints(Array.from({ length: 5 }, (_, index) => event(index, 1000 + index))).points;
  const snapshot = structuredClone(points);
  const layout = layoutTimelinePoints(points, '2026-10-08T11:00:00Z', '2026-10-08T11:01:00Z', 800);
  assert.equal(new Set(layout.map(point => Math.round((point.top - 20) / 15))).size, 5);
  for (const [index, point] of layout.entries()) {
    assert.equal(point.time, points[index]!.time);
    assert.equal(point.badge, points[index]!.badge);
    assert.equal(point.left, (1000 + index) / 60000 * 100);
    assert.ok(point.top >= 16 && point.top <= 84);
  }
  assert.deepEqual(points, snapshot);
  assert.deepEqual(layoutTimelinePoints([...points].reverse(), '2026-10-08T11:00:00Z', '2026-10-08T11:01:00Z', 800), layout);
});

test('sparse markers also use different heights and keep their positions on redraw', () => {
  const points = buildTimelinePoints(Array.from({ length: 10 }, (_, index) => event(index, index * 30000))).points;
  const layout = layoutTimelinePoints(points, '2026-10-08T11:00:00Z', '2026-10-08T11:05:00Z', 800);
  assert.ok(new Set(layout.map(point => point.top)).size > 1);
  assert.deepEqual(layoutTimelinePoints(points, '2026-10-08T11:00:00Z', '2026-10-08T11:05:00Z', 800), layout);
  assert.deepEqual(layoutTimelinePoints(points, '', '', 800), []);
});

test('wheel zoom keeps the time under the cursor fixed in both directions', () => {
  const recording = { start: 0, end: 5_400_000 };
  const current = { start: 1_000_000, end: 1_300_000 };
  const fraction = .2;
  const anchor = current.start + (current.end - current.start) * fraction;
  for (const delta of [-100, 100]) {
    const next = zoomTimeWindow(current, recording, wheelZoomFactor(delta, 0, 400), fraction);
    assert.ok(Math.abs(next.start + (next.end - next.start) * fraction - anchor) <= 1);
    assert.equal(next.end - next.start < current.end - current.start, delta < 0);
  }
});

test('drag panning follows the pointer in both directions without changing zoom', () => {
  const recording = { start: 0, end: 5_400_000 };
  const current = { start: 1_000_000, end: 1_300_000 };
  assert.deepEqual(panTimeWindow(current, recording, 100, 1000), { start: 970_000, end: 1_270_000 });
  assert.deepEqual(panTimeWindow(current, recording, -100, 1000), { start: 1_030_000, end: 1_330_000 });
  assert.deepEqual(panTimeWindow(current, recording, 50, 500), panTimeWindow(current, recording, 100, 1000));
  assert.deepEqual(panTimeWindow(current, recording, 0, 1000), current);
});

test('dragging clamps at recording edges and returns smoothly from them', () => {
  const recording = { start: 0, end: 5_400_000 };
  const current = { start: 1_000_000, end: 1_300_000 };
  assert.deepEqual(panTimeWindow(current, recording, 10_000, 1000), { start: 0, end: 300_000 });
  assert.deepEqual(panTimeWindow(current, recording, -100_000, 1000), { start: 5_100_000, end: 5_400_000 });
  assert.deepEqual(panTimeWindow(current, recording, 100, 1000), { start: 970_000, end: 1_270_000 });
  assert.deepEqual(panTimeWindow(recording, recording, 300, 1000), recording);
  assert.deepEqual(panTimeWindow(current, recording, 100, 0), current);
  assert.deepEqual(panTimeWindow(current, recording, NaN, 1000), current);
});

test('wheel zoom respects recording boundaries and the minimum time window', () => {
  const recording = { start: 0, end: 5_400_000 };
  const current = { start: 1_000_000, end: 1_300_000 };
  const minimum = zoomTimeWindow(current, recording, .00001, .8);
  assert.equal(minimum.end - minimum.start, 15_000);
  assert.deepEqual(zoomTimeWindow(current, recording, 100), recording);
  assert.equal(zoomTimeWindow({ start: 0, end: 300_000 }, recording, 2, .8).start, 0);
  assert.equal(zoomTimeWindow({ start: 5_100_000, end: 5_400_000 }, recording, 2, .2).end, recording.end);
  assert.deepEqual(zoomTimeWindow({ start: 0, end: 5000 }, { start: 0, end: 10_000 }, .1), { start: 0, end: 10_000 });
  assert.deepEqual(zoomTimeWindow(current, recording, Infinity), current);
  assert.equal(wheelZoomFactor(1, 1, 400), wheelZoomFactor(16, 0, 400));
  assert.equal(wheelZoomFactor(100_000, 0, 400), wheelZoomFactor(160, 0, 400));
});

test('wide views stay bounded, disclose omission and retain warning/diary records', () => {
  const records = Array.from({ length: 900 }, (_, i) => event(i, i * 1234 + i % 7));
  records[421]!.severity = 'ERROR';
  records[453]!.severity = 'WARN';
  records.push(event(999, 123, { source: 'operator', family: 'operator_diary' }));
  const result = buildTimelinePoints(records);
  assert.equal(result.truncated, true);
  assert.equal(result.totalPoints, 901);
  assert.equal(result.points.filter(point => point.system === 'sensor').length, 300);
  for (const record of [records[421]!, records[453]!, records[900]!]) {
    assert.ok(result.points.some(point => point.badge === record.badge && point.time === record.time));
  }
  assert.deepEqual(buildTimelinePoints(records), result);
  assert.ok(result.points.every(point => records.some(row => row.badge === point.badge && row.time === point.time)));
});

test('even a dense warning-only capture has a bounded response', () => {
  const result = buildTimelinePoints(Array.from({ length: 1000 }, (_, i) => event(i, i, { severity: 'WARN' })));
  assert.equal(result.points.length, 300);
  assert.equal(result.totalRecords, 1000);
  assert.equal(result.truncated, true);
});

const store = new EvidenceStore();
test('real-case point counts, source references and same-time drill-down agree', async () => {
  const scope = { start: '2026-10-08T11:00:30Z', end: '2026-10-08T11:01:30Z' };
  const result = await store.timelinePoints('case_001', scope);
  assert.equal(result.totalRecords, (await store.query('case_001', scope)).total);
  assert.equal(result.truncated, false);
  assert.equal(result.points.reduce((sum, point) => sum + point.count, 0), result.totalRecords);
  assert.ok(result.points.some(point => !point.time.endsWith('00.000Z')));
  for (const point of result.points) {
    const original = await store.resolve('case_001', point.badge);
    assert.equal(original.event!.time, point.time);
    assert.equal(original.event!.source, point.source);
    const group = await store.query('case_001', { ...scope, system: point.system, start: point.time, end: point.time, limit: 500 });
    assert.equal(group.total, point.count);
    assert.ok(group.rows.some(row => row.badge === point.badge));
  }
});

test('point filters keep case scope and the empty radio lane truthful', async () => {
  assert.deepEqual(await store.timelinePoints('case_001', { system: 'radio' }), { points: [], totalPoints: 0, totalRecords: 0, truncated: false });
  const scope = { system: 'services', source: 'position-bridge', query: 'PositionReport' };
  const points = await store.timelinePoints('case_004', scope);
  assert.equal(points.totalRecords, (await store.query('case_004', scope)).total);
  assert.ok(points.points.every(point => point.system === 'services' && point.source === 'position-bridge'));
  await assert.rejects(store.timelinePoints('invalid-case'));
});
