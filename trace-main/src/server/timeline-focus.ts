import { createHash } from 'node:crypto';
import type { EvidenceEvent, TimelineFocus, TimelineGroup, TimelineGroupDetail, TimelineSeries } from '../demo/types.ts';
import { TIMELINE_SYSTEMS } from '../demo/systems.ts';
import { timelineLabel } from '../demo/timeline-labels.ts';

// Display rules for the public demo catalog. These are not health/anomaly rules.
const periodic = new Set(['RadarScan', 'DetectionCandidate', 'SensorHealth', 'TrackUpdate', 'UiTrackPublished', 'IFFReply', 'PositionReport', 'RadarState', 'InhibitSectorState', 'DisplayState', 'Detection', 'TargetTrack']);
const measurements = new Set(['confidence', 'range_km', 'bearing_deg', 'x_km', 'y_km',
  'site_gps_lat', 'site_gps_lon', 'site_manual_lat', 'site_manual_lon', 'site_external_lat', 'site_external_lon', 'azimuth_deg', 'altitude_km']);
const transport = new Set(['capture_time_utc', 'producer_time_utc', 'bus_sequence', 'message_id', 'valid_until', 'scan_id']);
const stateFields = ['track_state', 'filter_revision', 'position_quality', 'delivery_state', 'transponder_mode3a', 'enabled', 'displayed_enabled', 'pattern', 'azimuth_start_deg', 'azimuth_end_deg', 'range_min_km', 'range_max_km', 'receiver'];
const systems = new Map(TIMELINE_SYSTEMS.flatMap(system => system.sources.map(source => [source, system.id] as const)));
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
const order = (a: EvidenceEvent, b: EvidenceEvent) => a.time.localeCompare(b.time) || a.badge.localeCompare(b.badge);
const streamKey = (event: EvidenceEvent) => JSON.stringify([event.source, event.type, event.target ?? '', event.fields.track_id ?? '', event.fields.sensor_id ?? '', event.fields.sector_id ?? '']);

function signature(event: EvidenceEvent): string {
  const fields = Object.entries(event.fields).filter(([key]) => !transport.has(key) && !measurements.has(key))
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, key === 'details' ? String(value).replace(/\bscan=\d+/g, 'scan=*') : value]);
  // Unknown/free-form text stays exact apart from its recorded timestamp.
  const text = event.family === 'sniffer' ? '' : event.text.replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+(?:Z| ?[+-]\d{2}:?\d{2})?/g, '<time>')
    .replace(/\d{2}\/\d{2}\/\d{4} [\d:]+/g, '<time>');
  return JSON.stringify([streamKey(event), event.family, event.severity, fields, text]);
}

/** Compare each source/target stream across the full capture, before viewport filters. */
export function findTimelineStateChanges(events: readonly EvidenceEvent[]): Set<string> {
  const previous = new Map<string, string>();
  const changed = new Set<string>();
  for (const event of [...events].sort(order)) {
    if (!periodic.has(event.type)) continue;
    const state = stateFields.map(key => [key, event.fields[key] ?? null]);
    if (event.type === 'SensorHealth') state.push(['health', String(event.fields.details ?? '').split(';').filter(part => !/temperature_c=/.test(part)).join(';')]);
    const key = streamKey(event); const value = JSON.stringify(state);
    if (previous.has(key) && previous.get(key) !== value) changed.add(event.badge);
    previous.set(key, value);
  }
  return changed;
}

export interface FocusIndex { result: TimelineFocus; members: Map<string, EvidenceEvent[]> }

export function buildTimelineFocus(events: readonly EvidenceEvent[], start: string, end: string, changes: ReadonlySet<string> = findTimelineStateChanges(events)): FocusIndex {
  const width = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(width) || width <= 0) throw new Error('Invalid timeline window');
  const granular = width <= 30_000;
  const steps = [1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1800_000, 3600_000];
  const bucketMs = steps.find(step => step >= width / 10) ?? Math.ceil(width / 10);
  const buckets = new Map<string, { kind: TimelineGroup['kind']; records: EvidenceEvent[] }>();
  for (const event of [...events].sort(order)) {
    const system = systems.get(event.source);
    if (!system) throw new Error(`No timeline system for source: ${event.source}`);
    const kind: TimelineGroup['kind'] = event.family === 'operator_diary' ? 'diary' : event.severity !== 'INFO' ? 'alert'
      : changes.has(event.badge) ? 'change' : periodic.has(event.type) ? (granular ? 'record' : 'activity') : 'event';
    const bucket = Math.floor(Date.parse(event.time) / bucketMs);
    const key = kind === 'activity' ? JSON.stringify([system, bucket, kind])
      : (kind === 'diary' || kind === 'change' || kind === 'record') ? event.badge : JSON.stringify([system, bucket, kind, signature(event)]);
    const group = buckets.get(key);
    if (group) group.records.push(event); else buckets.set(key, { kind, records: [event] });
  }
  const members = new Map<string, EvidenceEvent[]>();
  const groups: TimelineGroup[] = [];
  for (const { kind, records } of buckets.values()) {
    const first = records[0]!; const last = records.at(-1)!;
    const displayKind = kind === 'activity' && records.length === 1 ? 'record' : kind;
    const id = hash(JSON.stringify([kind, first.badge, last.badge, records.length]));
    members.set(id, records);
    groups.push({ id, kind: displayKind, system: systems.get(first.source)!, source: first.source, type: first.type,
      time: first.time, end: last.time, badge: first.badge, count: records.length, severity: first.severity,
      diary: kind === 'diary', seriesCount: new Set(records.map(signature)).size,
      label: displayKind === 'activity' ? 'עדכונים מחזוריים' : kind === 'change' ? `שינוי · ${timelineLabel(first.type)}` : timelineLabel(first.type) });
  }
  groups.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  return { result: { groups, totalRecords: events.length, bucketMs }, members };
}

export function describeTimelineGroup(index: FocusIndex, id: string, offset = 0, limit = 80, seriesId?: string): TimelineGroupDetail {
  const group = index.result.groups.find(group => group.id === id);
  const records = index.members.get(id);
  if (!group || !records) throw new Error('Timeline group is outside the selected scope');
  if (!Number.isFinite(offset) || !Number.isFinite(limit)) throw new Error('Invalid pagination');
  const bySeries = new Map<string, EvidenceEvent[]>();
  for (const event of records) {
    const key = hash(signature(event));
    const current = bySeries.get(key);
    if (current) current.push(event); else bySeries.set(key, [event]);
  }
  if (seriesId && !bySeries.has(seriesId)) throw new Error('Unknown timeline series');
  const series: TimelineSeries[] = [...bySeries.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    const ranges: TimelineSeries['ranges'] = [];
    for (const field of measurements) {
      let min: EvidenceEvent | undefined; let max: EvidenceEvent | undefined;
      for (const row of rows) {
        const value = row.fields[field];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        if (!min || value < Number(min.fields[field])) min = row;
        if (!max || value > Number(max.fields[field])) max = row;
      }
      if (min && max) ranges.push({ field, min: Number(min.fields[field]), max: Number(max.fields[field]), minBadge: min.badge, maxBadge: max.badge });
    }
    return { id, source: first.source, type: first.type, target: first.target, count: rows.length,
      start: first.time, end: rows.at(-1)!.time, ranges };
  });
  const rows = seriesId ? bySeries.get(seriesId)! : records;
  offset = Math.max(0, Math.floor(offset)); limit = Math.max(1, Math.min(500, Math.floor(limit)));
  return { group, series, seriesId, page: { rows: rows.slice(offset, offset + limit), total: rows.length, offset,
    nextOffset: offset + limit < rows.length ? offset + limit : null } };
}
