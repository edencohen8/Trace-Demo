import { Type, type Static } from 'typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { EventFilter, ResolvedSource } from '../demo/types.ts';
import { EvidenceStore } from './evidence-store.ts';

const FilterSchema = Type.Object({
  investigation_id: Type.Optional(Type.String()),
  time_start_utc: Type.Optional(Type.String({ description: 'ISO timestamp including UTC Z or timezone offset.' })),
  time_end_utc: Type.Optional(Type.String()),
  source_system: Type.Optional(Type.String()), target_id: Type.Optional(Type.String()),
  message_type: Type.Optional(Type.String()), query: Type.Optional(Type.String({ description: 'Literal keyword or identifier; not a natural-language question. Empty returns all matching records.' })),
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
const EvidenceSchema = Type.Object({ badge: Type.String({ description: 'Exact reference such as [sniffer.csv:L1420].' }) });

export function rememberEvidence(seen: Set<string>, evidence: ResolvedSource): void {
  seen.add(evidence.badge);
  for (const line of evidence.lines) seen.add(`[${evidence.sourceFile}:L${line.number}]`);
}

export function createDataTools(store: EvidenceStore, caseId: string, seen: Set<string>, signal: AbortSignal): AgentTool<any>[] {
  const check = (id?: string) => { signal.throwIfAborted(); if (id && id !== caseId) throw new Error('Cross-case access denied'); };
  const result = (details: unknown) => {
    const text = JSON.stringify(details);
    for (const match of text.matchAll(/\[[a-zA-Z0-9_]+\.(?:csv|txt|xlsx|json):L[1-9]\d*\]/g)) seen.add(match[0]);
    return { content: [{ type: 'text' as const, text }], details };
  };
  const query = async (_id: string, raw: unknown) => {
    const args = raw as FilterArgs;
    check(args.investigation_id);
    return result(await store.query(caseId, filter(args)));
  };
  return [
    { name: 'get_case_overview', label: 'Read case coverage', description: 'Read capture coverage, source counts, available message types and operator notes. Read before claiming absence.',
      parameters: Type.Object({}), execute: async () => { check(); return result({ ...(await store.summary(caseId)), manifest: await store.manifest(caseId), manifest_citation: '[capture_manifest.json:L1]', catalog: await store.catalog() }); } },
    { name: 'query_events', label: 'Query source events', description: 'Read bounded chronological events with exact original-file citations. Filter by time, source, target or message type. Follow nextOffset for more.', parameters: FilterSchema, execute: query },
    { name: 'search_text', label: 'Search source text', description: 'Literal substring search of source text and fields. Use identifiers, error codes, or one short phrase. Also supports source and time filters.', parameters: FilterSchema, execute: query },
    { name: 'get_evidence', label: 'Open original evidence', description: 'Resolve an exact citation to the original lines, file hash and metadata.', parameters: EvidenceSchema,
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
