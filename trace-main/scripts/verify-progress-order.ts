import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvestigationProgress } from '../src/server/investigation-progress.ts';
import { visibleInvestigationSteps } from '../src/demo/progress-order.ts';
import type { InvestigationStep } from '../src/demo/types.ts';

function replay(sameTimestamp = false) {
  const rows: InvestigationStep[] = [];
  let time = 1000;
  const reporter = new InvestigationProgress((event) => {
    if (!event.step) return;
    const index = rows.findIndex((step) => step.id === event.step!.id);
    if (index < 0) rows.push(event.step); else rows[index] = event.step;
  }, () => sameTimestamp ? 1000 : ++time);
  reporter.status('קורא את הבקשה');
  reporter.status('משווה את המדידות');
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'a', toolName: 'query_events', args: {} });
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'b', toolName: 'query_events', args: {} });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'b', toolName: 'query_events', result: { details: { rows: [], total: 0 } }, isError: false });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'a', toolName: 'query_events', result: { details: { rows: [], total: 0 } }, isError: false });
  return { rows, reporter };
}

test('the loading message stays last after parallel checks finish', () => {
  const { rows } = replay();
  const view = visibleInvestigationSteps(rows, true, false);
  assert.equal(view.at(-1)!.state, 'running', 'The loading message must be below completed checks');
  assert.deepEqual(view.filter((step) => step.state !== 'running').map((step) => step.id), ['phase:1', 'tool:b', 'tool:a']);
});

test('only the current task has a loading row, even while an outer phase remains active', () => {
  const { rows, reporter } = replay();
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'c', toolName: 'analyze_fields', args: { field_a: 'site_external_lat', field_b: 'site_gps_lat' } });
  const view = visibleInvestigationSteps(rows, true, true);
  assert.equal(view.filter((step) => step.state === 'running').length, 1);
  assert.equal(view.at(-1)!.id, 'tool:c');
});

test('checks that finish in the same millisecond keep their actual completion order', () => {
  const { rows } = replay(true);
  assert.deepEqual(visibleInvestigationSteps(rows, true, true).map((step) => step.id), ['phase:1', 'tool:b', 'tool:a', 'phase:2']);
});

test('collapsing older checks does not hide the loader or change the completed order', () => {
  const { rows, reporter } = replay();
  reporter.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'c', toolName: 'query_events', args: {} });
  reporter.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'c', toolName: 'query_events', result: {}, isError: true });
  const before = structuredClone(rows);
  const collapsed = visibleInvestigationSteps(rows, true, false);
  const expanded = visibleInvestigationSteps(rows, true, true);
  assert.deepEqual(collapsed.map((step) => step.id), ['tool:b', 'tool:a', 'tool:c', 'phase:2']);
  assert.deepEqual(expanded.map((step) => step.id), ['phase:1', 'tool:b', 'tool:a', 'tool:c', 'phase:2']);
  assert.equal(collapsed[2]!.state, 'error');
  assert.deepEqual(rows, before, 'Display ordering must not mutate the saved trace');
});

test('finished history keeps completion order and interrupted steps remain unfinished', () => {
  const { rows, reporter } = replay();
  const interrupted = visibleInvestigationSteps(rows, false, false);
  assert.equal(interrupted.at(-1)!.state, 'running');
  const finished = visibleInvestigationSteps(reporter.finish(), false, false);
  assert.ok(finished.every((step) => step.state === 'complete'));
  assert.deepEqual(finished.map((step) => step.id), ['tool:b', 'tool:a', 'phase:2']);
  assert.deepEqual(visibleInvestigationSteps(reporter.finish(), false, true).map((step) => step.id), ['phase:1', 'tool:b', 'tool:a', 'phase:2']);
});
