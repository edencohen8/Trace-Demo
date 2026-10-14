import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceStore } from '../src/server/evidence-store.ts';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { after } from 'node:test';
import { angularRelation, inspectRegion } from '../src/server/radar-analysis.ts';
import { createDataTools } from '../src/server/tools.ts';
import { InvestigationProgress } from '../src/server/investigation-progress.ts';
import { reviewClaims } from '../src/server/claim-review.ts';
import type { Finding } from '../src/agent/types.ts';
import { RootCauseOrchestrator } from '../src/agent/root-cause-orchestrator.ts';
import { DelegationController } from '../src/agent/delegation-controller.ts';
import { defaultSkillRegistry } from '../src/agent/skills/registry.ts';
import { initModelRegistry } from '../src/agent/provider.ts';
import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { splitCitations } from '../src/demo/client.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRadarPackage, writeRadarPackage, type Variant } from './generate-radar-demo.ts';
const temporary: string[] = [];
after(async () => { for (const root of temporary) await rm(root, { recursive: true, force: true }); });

test('operator can open the named case and its exact original sources', async () => {
  const store = new EvidenceStore();
  const summary = await store.summary('case_005');
  assert.equal(summary.title, 'כשל בזיהוי מטרה T015I');
  assert.equal(summary.parseErrors.length, 0);
  assert.ok(summary.description?.includes('T015I'));
  for (const file of summary.files) {
    const source = await store.resolve('case_005', `[${file.name}:L1]`);
    assert.equal(source.sha256, file.sha256);
    assert.equal(source.lines[0]?.number, 1);
  }
  assert.equal((await store.summaries()).length, 5);
});

test('a calculation reference opens its result and inputs without inventing a source line', async () => {
  const store = new EvidenceStore();
  const result = await store.inspectRegion('case_005', '[case_report.txt:L1]');
  assert.match(result.calculation_citation, /^\[calc:region:case_005:\d+\]$/);
  const resolved = await new EvidenceStore().resolve('case_005', result.calculation_citation);
  assert.equal(resolved.kind, 'calculation');
  if (resolved.kind !== 'calculation') throw new Error('Expected a calculation');
  assert.equal(resolved.result.detections.count, 0);
  assert.equal(resolved.result.inhibit.blocks_report_throughout, true);
  assert.ok(resolved.inputs.includes('[case_report.txt:L1]'));
  assert.equal('line' in resolved, false);
  assert.equal('sourceFile' in resolved, false);
  assert.ok(splitCitations(`Result ${result.calculation_citation}`).some((part) => part.citation));
  await assert.rejects(store.resolve('case_001', result.calculation_citation), /Cross-case/);
  await assert.rejects(store.resolve('case_005', '[calc:region:case_005:999]'), /Unknown calculation/);
});

test('region tools accept the same unwrapped source locators as evidence opening', async () => {
  const store = new EvidenceStore();
  const expected = await store.inspectRegion('case_005', '[case_report.txt:L1]');
  for (const badge of ['case_report.txt:L1', 'case_report.txt:1', ' [case_report.txt:L1] ']) {
    assert.deepEqual(await store.inspectRegion('case_005', badge), expected);
  }
  await assert.rejects(store.inspectRegion('case_005', 'case_report.txt'), /Available report citations:.*\[case_report.txt:L1\]/);
  await assert.rejects(store.inspectRegion('case_005', '../case_001/case_report.txt:L1'), /Unknown report/);
});

test('region results distinguish records from IDs and verify the continuous state around the report', async () => {
  const store = new EvidenceStore();
  const initial = await store.inspectRegion('case_005', '[case_report.txt:L1]');
  const interval = initial.inhibit.sectors[0]!.intervals[0]!.continuous_state;
  assert.equal(interval.start, '2026-10-14T12:00:20.100Z');
  assert.equal(interval.end, '2026-10-14T12:07:15.100Z');
  assert.ok(interval.snapshot_count > 80);
  for (const badge of interval.evidence_references) await store.resolve('case_005', badge);
  const repeat = await store.inspectRegion('case_005', '[operator_diary.csv:L7]');
  assert.equal(repeat.tracks.count_unit, 'records');
  assert.equal(repeat.tracks.count, 2);
  assert.equal(repeat.tracks.distinct_recorded_id_count, 1);
  assert.deepEqual(repeat.tracks.recorded_ids, [{ source: 'radar-psr-01', target_id: 'TRK-781' }]);
  assert.equal(repeat.tracks.missing_id_count, 0);
});

test('continuous state does not cross a validity gap outside the report window', async () => {
  const store = new EvidenceStore();
  const events = [...(await store.query('case_005', { limit: 500 })).rows, ...(await store.query('case_005', { offset: 500, limit: 500 })).rows];
  const report = events.find((event) => event.type === 'InitialReport')!;
  const missing = events.filter((event) => !(event.type === 'InhibitSectorState' && event.time === '2026-10-14T12:03:50.000Z'));
  const result = inspectRegion(missing, await store.manifest('case_005'), report);
  assert.equal(result.inhibit.blocks_report_throughout, true, 'The reported window still has complete state');
  assert.equal(result.inhibit.sectors[0]!.intervals[0]!.continuous_state.start, '2026-10-14T12:03:55.000Z', 'The earlier gap must stop continuity');
});

test('generation is reproducible and request outcomes resolve across sources', async () => {
  assert.deepEqual([...buildRadarPackage()], [...buildRadarPackage()]);
  const store = new EvidenceStore();
  const chain = await store.traceRequest('case_005', 'req-303');
  assert.ok(chain.rows.some((r) => r.type === 'RequestRejected' && r.fields.result === 'NOT_APPLIED'));
  assert.ok(chain.rows.some((r) => r.type === 'ReceiptAcknowledgement'));
  assert.equal(chain.rows.filter((r) => r.type === 'ApplicationAcknowledgement').length, 0);
  assert.equal(chain.type_counts.RequestApplied, 0);
  assert.equal(chain.query_complete, true);
  assert.deepEqual(chain.component_versions_at_request.map((r) => r.fields.software_version).sort(), ['1.4.0', '2.1.0']);
  const recovered = await store.traceRequest('case_005', 'req-505');
  assert.ok(recovered.rows.some((r) => r.type === 'ApplicationAcknowledgement'));
  assert.ok(recovered.component_versions_at_request.some((r) => r.source === 'config-service' && r.fields.software_version === '1.5.0'));
});

test('region analysis uses complete time coverage, effective state and report uncertainty', async () => {
  const store = new EvidenceStore();
  const result = await store.inspectRegion('case_005', '[case_report.txt:L1]');
  assert.equal(result.detections.count, 0);
  assert.equal(result.detections.coverage_complete, true);
  assert.equal(result.search.covers_report_throughout, true);
  assert.equal(result.inhibit.blocks_report_throughout, true);
  assert.equal(result.inhibit.sectors[0]!.intervals.length, 1, 'Unchanged state should be one interval with first/last source anchors');
  const repeat = (await store.query('case_005', { messageType: 'RepeatPassReport' })).rows[0]!;
  const recovered = await store.inspectRegion('case_005', repeat.badge);
  assert.ok(recovered.detections.count > 0);
  assert.equal(recovered.inhibit.blocks_report_throughout, false);
  assert.equal(recovered.search.covers_report_throughout, true);
});

for (const variant of ['missing-state', 'partial-detections', 'outside-sector', 'cancel-applied'] as Variant[]) {
  test(`isolated evidence changes the calculation: ${variant}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'trace-radar-'));
    temporary.push(root);
    await writeRadarPackage(join(root, 'fixtures/case_005'), variant);
    const store = new EvidenceStore(root, ['case_005']);
    const result = await store.inspectRegion('case_005', '[case_report.txt:L1]');
    if (variant === 'missing-state') assert.equal(result.inhibit.blocks_report_throughout, null);
    if (variant === 'partial-detections') assert.equal(result.detections.coverage_complete, false);
    if (variant === 'outside-sector') assert.equal(result.inhibit.blocks_report_throughout, false);
    if (variant === 'cancel-applied') {
      assert.equal(result.inhibit.blocks_report_throughout, false);
      assert.ok(result.detections.count > 0);
    }
  });
}

test('angular calculations wrap through north and include exact boundaries', () => {
  assert.equal(angularRelation(0, 2, 350, 10), 'inside');
  assert.equal(angularRelation(350, 0, 350, 10), 'inside');
  assert.equal(angularRelation(10, 1, 350, 10), 'partial');
  assert.equal(angularRelation(180, 1, 350, 10), 'outside');
  assert.equal(angularRelation(1, 0, 0, 0), 'outside');
  assert.equal(angularRelation(0, 180, 350, 10), 'unknown');
});

test('state changes at application time; expired snapshots do not become facts', async () => {
  const store = new EvidenceStore();
  const active = await store.reconstructState('case_005', '2026-10-14T12:07:15.099Z');
  const applied = await store.reconstructState('case_005', '2026-10-14T12:07:15.100Z');
  assert.equal(active.snapshots.find((s) => s.type === 'InhibitSectorState')?.state?.enabled, 'true');
  assert.equal(applied.snapshots.find((s) => s.type === 'InhibitSectorState')?.state?.enabled, 'false');
  const expired = await store.reconstructState('case_005', '2026-10-14T12:11:00Z');
  assert.ok(expired.snapshots.every((s) => s.state === null));
  await assert.rejects(store.reconstructState('case_005', '2026-10-14T12:04:00'), /timezone/);
});

test('hash and count mismatches fail closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-radar-'));
  temporary.push(root);
  const packageRoot = join(root, 'fixtures/case_005');
  await writeRadarPackage(packageRoot);
  await writeFile(join(packageRoot, 'raw/config_service.txt'), 'changed');
  await assert.rejects(new EvidenceStore(root, ['case_005']).summary('case_005'), /hash mismatch/);
  await writeRadarPackage(packageRoot);
  const path = join(packageRoot, 'capture_manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files['config_service.txt'].records++;
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(new EvidenceStore(root, ['case_005']).summary('case_005'), /count mismatch/);
});

test('progress derives semantic findings from calculation outputs and preserves input links', async () => {
  const store = new EvidenceStore(); const seen = new Set<string>();
  const tool = createDataTools(store, 'case_005', seen, new AbortController().signal).find((t) => t.name === 'inspect_region')!;
  const result = await tool.execute('calc', { report_badge: '[case_report.txt:L1]' });
  const progress = new InvestigationProgress(() => {});
  progress.onAgentEvent({ type: 'tool_execution_start', toolCallId: 'calc', toolName: tool.name, args: {} });
  progress.onAgentEvent({ type: 'tool_execution_end', toolCallId: 'calc', toolName: tool.name, result, isError: false });
  const step = progress.finish()[0]!;
  assert.match(step.detail!, /0 גילויים/);
  assert.match(step.detail!, /מגזר פעיל/);
  for (const badge of step.citations!) { assert.ok(seen.has(badge)); await store.resolve('case_005', badge); }
  await assert.rejects(tool.execute('bad', { report_badge: '[other_case.txt:L1]' }), /Unknown report/);
});

test('a readable source does not bypass claim support review', async () => {
  const finding: Finding = { finding_id: 'F', investigation_id: 'case_005', status: 'POSITIVE', title: 'Unsupported claim', claim: 'The cancel was applied.', rationale: 'Receipt was returned.', confidence: 1, evidence_citations: [{ badge: '[control_gateway.txt:L5]', source_file: 'control_gateway.txt' }], missing_coverage_flag: false };
  await assert.rejects(reviewClaims({ question: 'Was the cancel applied?', findings: [finding], computations: [] }, new EvidenceStore(), 'case_005', async (prompt) => {
    assert.match(prompt, /ReceiptAcknowledgement/);
    return JSON.stringify({ supported: false, issues: ['Receipt is not application.'] });
  }), /Receipt is not application/);
});

test('claim review retains aggregate counts, metadata context and compact request coverage', async () => {
  const store = new EvidenceStore();
  const repeat = (await store.query('case_005', { messageType: 'RepeatPassReport' })).rows[0]!;
  const calculation = await store.inspectRegion('case_005', repeat.badge);
  const trace = await store.traceRequest('case_005', 'req-303');
  await reviewClaims({ question: 'Check the count and application result.', answer: `Two tracks match the repeat report. ${repeat.badge} ${await store.coverageCitation('case_005')}`, findings: [], computations: [{ tool: 'inspect_region', result: calculation }, { tool: 'trace_request', result: trace }] }, store, 'case_005', async (prompt) => {
    const payload = JSON.parse(prompt.split('Returned deterministic calculations: ')[1]!) as { tool: string; result: Record<string, unknown> }[];
    const request = payload.find((p) => p.tool === 'trace_request')!.result;
    assert.equal((request.type_counts as Record<string, number>).RequestApplied, 0);
    assert.equal(request.query_complete, true);
    assert.equal(request.total, 6);
    assert.equal(request.rows, undefined, 'The reviewer should not receive a duplicate raw request dump');
    assert.equal((payload.find((p) => p.tool === 'inspect_region')!.result.tracks as { count: number }).count, 2);
    assert.ok(prompt.includes('"number":45'), 'The manifest citation includes the same drop-count context as the UI');
    return JSON.stringify({ supported: true, issues: [] });
  });
});

test('claim review resolves references in visible rationales as well as evidence arrays', async () => {
  const finding: Finding = { finding_id: 'F', investigation_id: 'case_005', status: 'POSITIVE', title: 'Display result', claim: 'The rejection was not sent to the display.', rationale: 'The result channel had no UI subscriber [control_gateway.txt:L6].', confidence: 0.9, evidence_citations: [], missing_coverage_flag: false };
  await reviewClaims({ question: 'Why did the display disagree?', findings: [finding], computations: [] }, new EvidenceStore(), 'case_005', async (prompt) => {
    const sources = JSON.parse(prompt.split('Cited original records: ')[1]!.split('\nCapture metadata:')[0]!) as { badge: string; record: { fields: Record<string, unknown> } }[];
    assert.equal(sources[0]?.badge, '[control_gateway.txt:L6]');
    assert.equal(String(sources[0]?.record.fields.ui_subscribed), 'false');
    return JSON.stringify({ supported: true, issues: [] });
  });
});

test('focused claim review does not require a full incident investigation', async () => {
  await reviewClaims({ scope: 'focused', question: 'Did the radar search in the reported region?', answer: 'The scan covered the report window. [case_report.txt:L1]', findings: [], computations: [] }, new EvidenceStore(), 'case_005', async (prompt) => {
    assert.match(prompt, /Review scope: focused/);
    assert.doesNotMatch(prompt, /a relevant later report should be checked as a recovery comparison/);
    assert.match(prompt, /Do not require the full causal chain/);
    return JSON.stringify({ supported: true, issues: [] });
  });
});

test('calculation clocks reject missing zones and large windows return bounded state summaries', async () => {
  const store = new EvidenceStore();
  const first = await store.query('case_005', { limit: 500 });
  const second = await store.query('case_005', { limit: 500, offset: 500 });
  const rows = [...first.rows, ...second.rows];
  const manifest = await store.manifest('case_005');
  const report = structuredClone((await store.resolve('case_005', '[case_report.txt:L1]')).event!);
  report.fields.window_start = '2026-10-14T12:03:55';
  assert.throws(() => inspectRegion(rows, manifest, report), /explicit timezones/);
  report.fields.window_start = manifest.window_utc.start; report.fields.window_end = manifest.window_utc.end;
  const wide = inspectRegion(rows, manifest, report);
  assert.equal(wide.detections.count, 3);
  assert.ok(wide.evidence_references.length <= 50);
  assert.ok(wide.inhibit.sectors.reduce((n, s) => n + s.intervals.length, 0) <= 10);
  assert.ok(JSON.stringify(wide).length < 20_000);
  const brokenClocks = rows.map((r) => r.type === 'InhibitSectorState' ? { ...r, fields: { ...r.fields, valid_until: String(r.fields.valid_until).replace('Z', '') } } : r);
  assert.equal(inspectRegion(brokenClocks, manifest, report).inhibit.blocks_report_throughout, null);
  const partial = structuredClone(manifest);
  partial.coverage_by_type!.Detection!.start = '2026-10-14T12:00:00';
  assert.equal(inspectRegion(rows, partial, report).detections.coverage_complete, false);
});

test('routine detections stay inside the search state effective at their own timestamps', async () => {
  const store = new EvidenceStore();
  const detections = (await store.query('case_005', { messageType: 'Detection', limit: 500 })).rows;
  for (const detection of detections) {
    const state = (await store.reconstructState('case_005', detection.time)).snapshots.find((s) => s.type === 'RadarState')!.state!;
    assert.equal(angularRelation(Number(detection.fields.azimuth_deg), 0, Number(state.azimuth_start_deg), Number(state.azimuth_end_deg)), 'inside', detection.badge);
  }
});

test('a rejected finding can be corrected without rewriting the accepted claims or their sources', async () => {
  const runtime = initModelRegistry({ useFaux: true, fauxOptions: { tokensPerSecond: 100_000 } });
  const first: Finding = { finding_id: 'F1', investigation_id: 'case_005', status: 'POSITIVE', title: 'Receipt', claim: 'Receipt was returned.', rationale: 'Gateway record.', confidence: .9, missing_coverage_flag: false, evidence_citations: [{ badge: '[control_gateway.txt:L5]', source_file: 'control_gateway.txt' }] };
  const second: Finding = { ...first, finding_id: 'F2', title: 'Application', claim: 'It was applied.' };
  runtime.fauxInstance!.setResponses([
    fauxAssistantMessage([fauxToolCall('submit_findings', { summary_finding_ids: ['F1', 'F2'], findings: [first, second] })], { stopReason: 'toolUse' }),
    fauxAssistantMessage([fauxToolCall('submit_findings', { corrections: [{ finding_id: 'F2', claim: 'Receipt does not confirm application.' }] })], { stopReason: 'toolUse' }),
  ]);
  let reviews = 0;
  const model = runtime.getModel()!;
  const orchestrator = new RootCauseOrchestrator({ investigationId: 'case_005', goal: 'Check the acknowledgement.', model, streamFn: runtime.streamFn, skillRegistry: defaultSkillRegistry,
    delegationController: new DelegationController({ model, streamFn: runtime.streamFn, availableWorkerTools: [] }),
    caseOverviewProvider: async () => ({ caseId: 'case_005', title: 'Test', availableFeeds: [], timeWindow: { startUtc: '', endUtc: '' }, anomalyHint: '', recorderDrops: 0 }),
    validateFindings: async (findings) => {
      assert.deepEqual(findings[0], first);
      if (++reviews === 1) throw new Error('F2: receipt does not confirm application.');
      assert.equal(findings[1]?.claim, 'Receipt does not confirm application.');
    },
  });
  const result = await orchestrator.run();
  assert.equal(reviews, 2);
  assert.equal(result.concluded, true);
  assert.equal(result.answer, 'Receipt was returned. [control_gateway.txt:L5]\n\nReceipt does not confirm application. [control_gateway.txt:L5]');
});
