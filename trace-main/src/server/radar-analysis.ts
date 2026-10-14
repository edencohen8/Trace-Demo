import type { EvidenceEvent } from '../demo/types.ts';
import type { Manifest } from './evidence-store.ts';

type Fields = EvidenceEvent['fields'];
type Arc = [number, number];
const stateProperties = new Set(['sector_id', 'enabled', 'displayed_enabled', 'pattern', 'azimuth_start_deg', 'azimuth_end_deg', 'range_min_km', 'range_max_km', 'receiver', 'scan_period_s']);
const numeric = (f: Fields, key: string): number | undefined => typeof f[key] === 'number' && Number.isFinite(f[key]) ? f[key] as number : undefined;
const norm = (v: number) => ((v % 360) + 360) % 360;
// Invalid or zone-less clocks stay unknown; server locale never supplies a zone.
const timestamp = (value: unknown): number => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? Date.parse(value) : NaN;
const arc = (start: number, end: number): Arc[] => {
  const a = norm(start); const b = norm(end);
  return a <= b ? [[a, b]] : [[a, 360], [0, b]];
};
export function angularRelation(center: number, uncertainty: number, start: number, end: number): 'inside' | 'outside' | 'partial' | 'unknown' {
  if (![center, uncertainty, start, end].every(Number.isFinite) || uncertainty < 0 || uncertainty >= 180) return 'unknown';
  const region = arc(center - uncertainty, center + uncertainty); const sector = arc(start, end);
  if (region.every(([a, b]) => sector.some(([c, d]) => a >= c && b <= d))) return 'inside';
  if (region.some(([a, b]) => sector.some(([c, d]) => a <= d && b >= c))) return 'partial';
  return 'outside';
}
function relation(report: Fields, state: Fields) {
  const keys = ['azimuth_deg', 'azimuth_uncertainty_deg', 'range_km', 'range_uncertainty_km'];
  const bounds = ['azimuth_start_deg', 'azimuth_end_deg', 'range_min_km', 'range_max_km'];
  const [az, da, range, dr] = keys.map((key) => numeric(report, key));
  const [a, b, min, max] = bounds.map((key) => numeric(state, key));
  if ([az, da, range, dr, a, b, min, max].some((v) => v === undefined) || dr! < 0 || min! > max!) return 'unknown';
  const angle = angularRelation(az!, da!, a!, b!);
  if (angle === 'unknown') return 'unknown';
  if (angle === 'outside' || range! + dr! < min! || range! - dr! > max!) return 'outside';
  return angle === 'inside' && range! - dr! >= min! && range! + dr! <= max! ? 'inside' : 'partial';
}
const stateTypes = ['RadarState', 'InhibitSectorState', 'DisplayState'];
function streams(events: EvidenceEvent[], type: string): EvidenceEvent[][] {
  const grouped = new Map<string, EvidenceEvent[]>();
  for (const event of events.filter((e) => e.type === type)) {
    const key = `${event.source}/${event.fields.sector_id ?? ''}`;
    const values = grouped.get(key) ?? []; values.push(event); grouped.set(key, values);
  }
  return [...grouped.values()];
}
function segments(rows: EvidenceEvent[], start: number, end: number) {
  return rows.flatMap((row, i) => {
    const from = Math.max(start, timestamp(row.time));
    const until = Math.min(end, timestamp(row.fields.valid_until), rows[i + 1] ? timestamp(rows[i + 1]!.time) : Infinity);
    return Number.isFinite(until) && until > from ? [{ row, from, until }] : [];
  });
}
function compactSegments(parts: ReturnType<typeof segments>) {
  const result: { from: number; until: number; row: EvidenceEvent; last: EvidenceEvent; count: number; signature: string }[] = [];
  for (const part of parts) {
    const signature = JSON.stringify([part.row.source, part.row.type, Object.entries(part.row.fields).filter(([key]) => stateProperties.has(key)).sort(([a], [b]) => a.localeCompare(b))]);
    const previous = result.at(-1);
    if (previous && previous.until === part.from && previous.signature === signature) {
      previous.until = part.until; previous.last = part.row; previous.count++;
    } else result.push({ ...part, last: part.row, count: 1, signature });
  }
  return result;
}
const boundaryReferences = (parts: ReturnType<typeof compactSegments>) => refs(parts.flatMap((p) => [p.row, p.last]));
function spansWindow(parts: { from: number; until: number }[], start: number, end: number): boolean {
  let covered = start;
  for (const part of [...parts].sort((a, b) => a.from - b.from)) {
    if (part.from > covered) return false;
    covered = Math.max(covered, part.until);
  }
  return covered >= end;
}
const refs = (rows: EvidenceEvent[]) => [...new Set(rows.map((row) => row.badge))];
export function reconstructState(events: EvidenceEvent[], at: string) {
  const instant = timestamp(at);
  if (!Number.isFinite(instant)) throw new Error('State time requires an explicit timezone');
  const snapshots = stateTypes.flatMap((type) => streams(events, type).map((rows) => {
    const latest = rows.findLast((row) => timestamp(row.time) <= instant);
    const valid = latest && timestamp(latest.fields.valid_until) > instant;
    return { type, source: rows[0]!.source, entity: rows[0]!.fields.sector_id, state: valid ? latest.fields : null, evidence: valid ? latest.badge : null, limitation: valid ? null : 'No valid snapshot at this time; do not infer applied state from commands.' };
  }));
  return { at_utc: at, snapshots: snapshots.slice(0, 50), total: snapshots.length, truncated: snapshots.length > 50, evidence_references: snapshots.slice(0, 50).flatMap((s) => s.evidence ? [s.evidence] : []), method: 'Latest snapshot at/before the requested time, inside its half-open validity interval.' };
}

export function inspectRegion(events: EvidenceEvent[], manifest: Manifest, report: EvidenceEvent, coverageBadge = '[capture_manifest.json:L1]') {
  const start = timestamp(report.fields.window_start); const end = timestamp(report.fields.window_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 15 * 60_000) throw new Error('Report must declare a valid window of at most 15 minutes with explicit timezones');
  if (report.family !== 'operator_diary') throw new Error('Expected a human report with position and time uncertainty');
  const position = ['azimuth_deg', 'azimuth_uncertainty_deg', 'range_km', 'range_uncertainty_km'].map((key) => numeric(report.fields, key));
  if (position.some((v) => v === undefined) || position[1]! < 0 || position[1]! >= 180 || position[2]! < 0 || position[3]! < 0) throw new Error('Report position or uncertainty is missing or invalid; geometry is unknown');
  const coverage = (type: string) => {
    const entry = manifest.coverage_by_type?.[type];
    return Boolean(entry?.complete && entry.all_targets && entry.spatial_filter === 'NONE' && timestamp(entry.start) <= start && timestamp(entry.end) >= end && manifest.known_recorder_drops === 0);
  };
  const within = (row: EvidenceEvent) => {
    const f = row.fields; const r = report.fields;
    const [a, d, b, radius, error, distance] = [numeric(r, 'azimuth_deg'), numeric(r, 'azimuth_uncertainty_deg'), numeric(f, 'azimuth_deg'), numeric(r, 'range_km'), numeric(r, 'range_uncertainty_km'), numeric(f, 'range_km')];
    if ([a, d, b, radius, error, distance].some((v) => v === undefined)) return null;
    return angularRelation(b!, 0, a! - d!, a! + d!) === 'inside' && distance! >= radius! - error! && distance! <= radius! + error!;
  };
  const observations = (type: string) => {
    const rows = events.filter((e) => e.type === type && timestamp(e.time) >= start && timestamp(e.time) <= end);
    const matching = rows.filter((r) => within(r) === true);
    const unknown = rows.filter((r) => within(r) === null).length;
    const identified = matching.flatMap((row) => {
      const target = row.fields.target_id ?? row.target;
      return target === undefined || target === '' ? [] : [{ source: row.source, target_id: String(target) }];
    });
    const ids = [...new Map(identified.map((id) => [JSON.stringify(id), id])).values()];
    return { count: matching.length, count_unit: 'records' as const, distinct_recorded_id_count: ids.length, recorded_ids: ids.slice(0, 10), recorded_ids_truncated: ids.length > 10, missing_id_count: matching.length - identified.length,
      total_in_window: rows.length, missing_position_count: unknown, coverage_complete: coverage(type) && !unknown,
      matches: matching.slice(0, 4).map(({ time, fields, badge }) => ({ time, fields, badge })), matches_truncated: matching.length > 4, evidence_references: refs(matching.slice(0, 4)) };
  };
  const scan = streams(events, 'RadarState').flatMap((rows) => segments(rows, start, end));
  const scanKnown = spansWindow(scan, start, end) && scan.every(({ row }) => relation(report.fields, row.fields) !== 'unknown' && ['ACTIVE', 'INACTIVE'].includes(String(row.fields.receiver)));
  const scanning = scan.filter(({ row }) => row.fields.receiver === 'ACTIVE' && relation(report.fields, row.fields) === 'inside');
  const sectorStreams = streams(events, 'InhibitSectorState');
  const sectors = sectorStreams.map((rows) => {
    const parts = segments(rows, start, end);
    // Derive continuity from every valid snapshot in this source stream. A
    // single missing interval splits the group, even outside the report window.
    const continuous = compactSegments(segments(rows, timestamp(manifest.window_utc.start), timestamp(manifest.window_utc.end)));
    return { sector_id: rows[0]!.fields.sector_id, state_coverage_complete: spansWindow(parts, start, end),
      intervals: compactSegments(parts).map(({ row, last, count, from, until, signature }) => {
        const extent = continuous.find((part) => part.signature === signature && part.from <= from && part.until >= until);
        return { start: new Date(from).toISOString(), end: new Date(until).toISOString(), enabled: row.fields.enabled, relation: relation(report.fields, row.fields), badge: row.badge, end_badge: last.badge, snapshot_count: count,
          continuous_state: { start: new Date(extent?.from ?? from).toISOString(), end: new Date(extent?.until ?? until).toISOString(), snapshot_count: extent?.count ?? count, evidence_references: refs(extent ? [extent.row, extent.last] : [row, last]) },
          bounds: Object.fromEntries(Object.entries(row.fields).filter(([key]) => stateProperties.has(key))) };
      }) };
  });
  const sectorKnown = sectors.length > 0 && sectors.every((s) => s.state_coverage_complete && s.intervals.every((i) => i.relation !== 'unknown' && ['true', 'false'].includes(String(i.enabled))));
  const blocking = sectors.flatMap((s) => s.intervals.filter((i) => i.enabled === 'true' && i.relation === 'inside').map((i) => ({ from: timestamp(i.start), until: timestamp(i.end) })));
  const partial = sectors.some((s) => s.intervals.some((i) => i.enabled === 'true' && i.relation === 'partial'));
  const scanGroups = compactSegments(scan);
  const scanRefs = boundaryReferences(scanGroups.slice(0, 10));
  let remainingIntervals = 10;
  const shownSectors = sectors.slice(0, 10).map((s) => {
    const intervals = s.intervals.slice(0, remainingIntervals); remainingIntervals -= intervals.length;
    return { ...s, intervals, total_intervals: s.intervals.length, truncated: intervals.length < s.intervals.length };
  });
  const sectorRefs = [...new Set(shownSectors.flatMap((s) => s.intervals.flatMap((i) => [i.badge, i.end_badge])))];
  const detections = observations('Detection'); const tracks = observations('TargetTrack');
  const stateExtentRefs = shownSectors.flatMap((s) => s.intervals.flatMap((i) => i.continuous_state.evidence_references));
  const evidenceReferences = [...new Set([report.badge, coverageBadge, ...scanRefs, ...sectorRefs, ...detections.evidence_references, ...tracks.evidence_references, ...stateExtentRefs])];
  const truncated = scanGroups.length > 10 || sectors.length > shownSectors.length || shownSectors.some((s) => s.truncated) || evidenceReferences.length > 50;
  return {
    report: { badge: report.badge, text: report.text, fields: report.fields },
    detections, tracks,
    search: { state_coverage_complete: scanKnown, covers_report_throughout: scanKnown ? spansWindow(scanning, start, end) : null, evidence_references: scanRefs, patterns: [...new Set(scan.map((s) => s.row.fields.pattern))].slice(0, 10), total_intervals: scanGroups.length },
    inhibit: { state_coverage_complete: sectorKnown, blocks_report_throughout: sectorKnown ? spansWindow(blocking, start, end) : null, partial_spatial_overlap: partial, sectors: shownSectors, total_sectors: sectors.length },
    evidence_truncated: truncated,
    citation_support: {
      detection_count_and_absence: [report.badge, coverageBadge, ...detections.evidence_references],
      scan_coverage: [report.badge, ...scanRefs],
      inhibit_overlap: [report.badge, ...sectorRefs],
      note: 'These are input source references for the computed claims. For an inference about the effect of a state, also cite its system-catalog definition. No source row by itself records an absence.',
    },
    evidence_references: evidenceReferences.slice(0, 50),
    method: 'Inclusive polar geometry over the human uncertainty region; union of half-open snapshot validity intervals over the entire reported window. Detection counts use position and time, without target-ID filtering. continuous_state is the maximal adjacent sequence of identical valid sector snapshots touching the reported interval, bounded by the capture. Every intervening snapshot is checked; a validity gap stops the sequence.',
    limitations: ['The position and target identity are reported by a human, not independently measured by radar.', 'Counts measure records, not unique tracks. Distinct recorded IDs are scoped to their source; they do not verify exercise-target identity. Missing IDs are counted separately.', 'A spatial match does not prove target identity. A repeat pass is supporting comparison, not a controlled experiment.', 'Null means missing or invalid evidence. False means the whole-window condition was not established; inspect individual intervals.', 'No matching record proves absence only if coverage_complete is true. Calculations cite input rows; they do not have invented source lines.', 'Calculations use all matching records. Repeated state is coalesced. At most 10 scan and 10 sector intervals, 10 recorded IDs per observation type, 4 matching examples per type and 50 input links are returned. Truncation limits displayed evidence, not the calculation.'],
  };
}
