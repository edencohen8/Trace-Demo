import { Type, type Static } from 'typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { EventFilter, ResolvedSource } from '../demo/types.ts';
import { EvidenceStore } from './evidence-store.ts';
import { evidenceBadges } from '../demo/evidence-badges.ts';

const FilterSchema = Type.Object({
  investigation_id: Type.Optional(Type.String()),
  time_start_utc: Type.Optional(Type.String({ description: 'ISO timestamp including UTC Z or timezone offset.' })),
  time_end_utc: Type.Optional(Type.String()),
  source_system: Type.Optional(Type.String({ description: 'Exact source ID from get_case_overview, or original filename. Do not use translated UI names.' })), target_id: Type.Optional(Type.String()),
  message_type: Type.Optional(Type.String({ description: 'Exact case-sensitive event type from the catalog or returned records.' })), query: Type.Optional(Type.String({ description: 'Literal keyword or identifier; not a natural-language question. Empty returns all matching records.' })),
  alerts_only: Type.Optional(Type.Boolean()), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
type FilterArgs = Static<typeof FilterSchema>;
function filter(args: FilterArgs): EventFilter {
  return { start: args.time_start_utc, end: args.time_end_utc, source: args.source_system, target: args.target_id,
    messageType: args.message_type, query: args.query, alertsOnly: args.alerts_only,
    limit: Math.min(50, args.limit ?? 25), offset: args.offset };
}
const AnalyzeSchema = Type.Object({
  ...FilterSchema.properties,
  field_a: Type.String(), field_b: Type.Optional(Type.String()),
  operation: Type.Union([Type.Literal('stats'), Type.Literal('delta'), Type.Literal('gaps'), Type.Literal('quantiles')]),
});
const EvidenceSchema = Type.Object({ badge: Type.String({ description: 'Exact original-row or calculation reference returned by a tool. One reference, no ranges.' }) });

export function rememberEvidence(seen: Set<string>, evidence: ResolvedSource): void {
  seen.add(evidence.badge);
  if (evidence.kind === 'calculation') { evidence.inputs.forEach((badge) => seen.add(badge)); return; }
  for (const line of evidence.lines) seen.add(`[${evidence.sourceFile}:L${line.number}]`);
}

export function createDataTools(store: EvidenceStore, caseId: string, seen: Set<string>, signal: AbortSignal): AgentTool<any>[] {
  const check = (id?: string) => { signal.throwIfAborted(); if (id && id !== caseId) throw new Error('Cross-case access denied'); };
  const result = (details: unknown) => {
    const text = JSON.stringify(details);
    evidenceBadges(text).forEach((badge) => seen.add(badge));
    return { content: [{ type: 'text' as const, text }], details };
  };
  const query = async (_id: string, raw: unknown) => {
    const args = raw as FilterArgs;
    check(args.investigation_id);
    const summary = await store.summary(caseId);
    if (args.time_start_utc && Date.parse(args.time_start_utc) > Date.parse(summary.end) || args.time_end_utc && Date.parse(args.time_end_utc) < Date.parse(summary.start)) throw new Error(`Requested interval is outside capture ${summary.start} to ${summary.end}. Copy the date and UTC times from the case report, or use an explicit local offset. This is not evidence that no events occurred.`);
    return result(await store.query(caseId, filter(args)));
  };
  return [
    { name: 'trace_request', label: 'Trace a control request', description: 'Trace one exact request_id across UI, gateway and processing service. Separates receipt from application; returns original rows, coverage and the latest reported software version of each participating component at request time. Use the ID found in source records.',
      parameters: Type.Object({ request_id: Type.String() }), execute: async (_id, raw) => { check(); return result(await store.traceRequest(caseId, (raw as { request_id: string }).request_id)); } },
    { name: 'reconstruct_state', label: 'Reconstruct effective and displayed state', description: 'Return valid effective radar/search/sector and displayed snapshots at a UTC time. Missing/stale snapshots stay unknown. Commands and receipts never replace effective state.',
      parameters: Type.Object({ at_utc: Type.String({ description: 'Copy a source UTC timestamp or provide an explicit offset, e.g. local time +03:00. A local hour with Z is a different instant.' }) }), execute: async (_id, raw) => {
        check(); const at = (raw as { at_utc: string }).at_utc; const summary = await store.summary(caseId);
        if (Date.parse(at) < Date.parse(summary.start) || Date.parse(at) > Date.parse(summary.end)) throw new Error(`Requested time ${at} is outside capture ${summary.start} to ${summary.end}. Check source date and timezone; local +03:00 is not UTC Z.`);
        return result(await store.reconstructState(caseId, at));
      } },
    { name: 'inspect_region', label: 'Check a reported region', description: 'Deterministically check a human report region and its uncertainty window against all detections/tracks, coverage, effective scan bounds and inhibit sectors. Requires report_badge. No target-ID filter. count counts records; distinct_recorded_id_count counts source-scoped radar IDs, not exercise-target identities. Sector continuous_state verifies the full adjacent unchanged state interval around the report, stopping at every validity gap. Cite calculation_citation for these computed counts, absence, geometry and intervals. That real calculation handle opens the result, method, input anchors and hashes; it is not an invented source row. The calculation includes EVERY matching record. Reuse it instead of paging through periodic states.',
      parameters: Type.Object({ report_badge: Type.String() }), execute: async (_id, raw) => { check(); return result(await store.inspectRegion(caseId, (raw as { report_badge: string }).report_badge)); } },
    { name: 'get_case_overview', label: 'Read case coverage', description: 'Read capture coverage, source counts, available message types and operator notes. Read before claiming absence.',
      parameters: Type.Object({}), execute: async () => { check(); return result({ ...(await store.summary(caseId)), manifest: await store.manifest(caseId), manifest_citation: await store.coverageCitation(caseId), manifest_references: await store.manifestReferences(caseId), catalog: await store.catalog(caseId) }); } },
    { name: 'query_events', label: 'Query source events', description: 'Read bounded chronological events with exact original-file citations. Filter by time, source, target or message type. Follow nextOffset for more.', parameters: FilterSchema, execute: query },
    { name: 'search_text', label: 'Search source text', description: 'Literal substring search of source text and fields. Use identifiers, error codes, or one short phrase. Also supports source and time filters.', parameters: FilterSchema, execute: query },
    { name: 'get_evidence', label: 'Open original evidence', description: 'Resolve a row citation to its original lines/hash, or a calculation citation to its reproducible result, method and original input references.', parameters: EvidenceSchema,
      execute: async (_id: string, raw: unknown) => {
        const args = raw as Static<typeof EvidenceSchema>; check();
        const evidence = await store.resolve(caseId, args.badge);
        rememberEvidence(seen, evidence);
        return result(evidence);
      } },
    { name: 'analyze_fields', label: 'Calculate field statistics', description: 'Compute exact statistics or field_a minus field_b over matching rows. Read field names/units from case catalog. Gaps returns the largest time gaps; no resampling.', parameters: AnalyzeSchema,
      execute: async (_id: string, raw: unknown) => { const args = raw as Static<typeof AnalyzeSchema>; check(args.investigation_id); return result(await store.analyze(caseId, { ...filter(args), fieldA: args.field_a, fieldB: args.field_b, operation: args.operation })); } },
  ];
}
