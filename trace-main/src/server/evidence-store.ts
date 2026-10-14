import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import readXlsxFile from 'read-excel-file/node';
import type { CaseSummary, EvidenceEvent, EventFilter, EventPage, ResolvedSource, ResolvedCalculation, TimelineBin, TimelinePoints, TimelineFocus, TimelineGroupDetail } from '../demo/types.ts';
import { getTimelineSystem } from '../demo/systems.ts';
import { decimalDifference } from './decimal.ts';
import { buildTimelinePoints } from './timeline-points.ts';
import { buildTimelineFocus, describeTimelineGroup, findTimelineStateChanges } from './timeline-focus.ts';
import { inspectRegion, reconstructState } from './radar-analysis.ts';

// This is the only data root. No simulator directory or arbitrary upload path is read.
export const EVIDENCE_ROOT = fileURLToPath(new URL('../radar-simulator/TRACE_v03_investigator_data/', import.meta.url));
export const CASE_IDS = ['case_001', 'case_002', 'case_003', 'case_004', 'case_005'] as const;
const FILES = ['sniffer.csv', 'sensor.txt', 'tracking_service.txt', 'ui_gateway.txt', 'external_position_adapter.txt', 'notification_service.txt', 'operator_diary.xlsx'];
const LOG_SOURCES: Record<string, string> = {
  'sensor.txt': 'radar-psr-01', 'tracking_service.txt': 'track-core', 'ui_gateway.txt': 'ui-gateway',
  'external_position_adapter.txt': 'position-bridge', 'notification_service.txt': 'alert-router',
};

export interface Manifest {
  investigation_id: string;
  title?: string;
  description?: string;
  files?: Record<string, { format: 'sniffer_csv' | 'diary_csv' | 'event_jsonl' | 'document'; family: EvidenceEvent['family']; source: string; records: number }>;
  coverage_by_type?: Record<string, { complete: boolean; start: string; end: string; all_targets: boolean; spatial_filter: string }>;
  source_clock: string;
  window_utc: { start: string; end: string };
  export_selection: { message_types: string[]; excluded_message_types: string[]; target_filter: string; columns: string[] };
  known_recorder_drops: number | null;
  capture_completeness: string;
  file_sha256: Record<string, string>;
  exported_sniffer_rows: number;
}

interface LoadedCase {
  summary: CaseSummary;
  manifest: Manifest;
  events: EvidenceEvent[];
  byBadge: Map<string, EvidenceEvent>;
  originals: Map<string, string[]>;
  stateChanges: Set<string>;
}

function iso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    throw new Error('Invalid timestamp: include an explicit timezone (Z or an offset such as +03:00)');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid timestamp');
  return new Date(parsed).toISOString();
}

function logTime(line: string): string {
  if (line.startsWith('{')) return iso((JSON.parse(line) as { timestamp: string }).timestamp);
  const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})/);
  if (isoMatch) return iso(isoMatch[0]);
  const sensor = line.match(/^(\d{4}-\d{2}-\d{2}) ([\d:.]+) ([+-]\d{4})/);
  if (sensor) return iso(`${sensor[1]}T${sensor[2]}${sensor[3]}`);
  const ui = line.match(/^(\d{2})\/(\d{2})\/(\d{4}) ([\d:]+).*\[local ([+-]\d{4})\]/);
  if (ui) return iso(`${ui[3]}-${ui[2]}-${ui[1]}T${ui[4]}${ui[5]}`);
  throw new Error('Unknown source clock format');
}

function fieldsFromText(text: string): Record<string, string | number> {
  // Parse the message, not JSON punctuation around its final key=value pair.
  if (text.startsWith('{')) text = String((JSON.parse(text) as { message?: unknown }).message ?? '');
  return Object.fromEntries([...text.matchAll(/([a-zA-Z_][\w]*)=([^\s;,]+)/g)].map((m) =>
    [m[1], fieldValue(m[1]!, m[2]!)]));
}

function fieldValue(key: string, value: string): string | number {
  const identifier = /(?:_id|_code)$/.test(key) || key === 'transponder_mode3a';
  return !identifier && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
}

// Events are sorted by normalized UTC time. Keep both requested boundaries inclusive.
function timeBound(events: EvidenceEvent[], time: string, after: boolean): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (events[middle]!.time < time || (after && events[middle]!.time === time)) low = middle + 1;
    else high = middle;
  }
  return low;
}

function severity(text: string): EvidenceEvent['severity'] {
  return /\b(ERROR|CRITICAL|FATAL)\b/.test(text) ? 'ERROR' : /\b(WARN|WARNING)\b/.test(text) ? 'WARN' : 'INFO';
}

export class EvidenceStore {
  private cache = new Map<string, Promise<LoadedCase>>();
  // Constructor injection is for isolated test packages. HTTP and agent tools
  // never expose these paths or allow a caller to change the registry.
  constructor(private root = EVIDENCE_ROOT, private caseIds: readonly string[] = CASE_IDS) {}

  assertCase(id: string): void {
    if (!this.caseIds.includes(id) || !/^case_[a-zA-Z0-9_]+$/.test(id)) throw new Error('Unknown investigation');
  }

  private load(id: string): Promise<LoadedCase> {
    this.assertCase(id);
    let cached = this.cache.get(id);
    if (!cached) {
      cached = this.readCase(id).catch((error: unknown) => { this.cache.delete(id); throw error; });
      this.cache.set(id, cached);
    }
    return cached;
  }

  private async readCase(id: string): Promise<LoadedCase> {
    const root = join(this.root, 'fixtures', id);
    const manifestText = await readFile(join(root, 'capture_manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText) as Manifest;
    if (manifest.investigation_id !== id) throw new Error('Manifest case mismatch');
    const events: EvidenceEvent[] = [];
    const originals = new Map<string, string[]>([['capture_manifest.json', manifestText.trimEnd().split(/\r?\n/)]]);
    const summary: CaseSummary = {
      id, title: manifest.title ?? `תחקיר ${id.slice(-3)}`, description: manifest.description, start: manifest.window_utc.start, end: manifest.window_utc.end,
      eventCount: 0, sources: [], targets: [], messageTypes: manifest.export_selection.message_types,
      excludedTypes: manifest.export_selection.excluded_message_types,
      recorderDrops: manifest.known_recorder_drops, coverage: manifest.capture_completeness,
      diary: [], files: [], parseErrors: [],
    };
    for (const file of manifest.files ? Object.keys(manifest.files) : FILES) {
      if (!/^[a-zA-Z0-9_]+\.(csv|txt|xlsx|json)$/.test(file)) throw new Error('Invalid evidence filename');
      const declaration = manifest.files?.[file];
      const bytes = await readFile(join(root, 'raw', file));
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (manifest.file_sha256[file] !== hash) throw new Error(`Evidence hash mismatch: ${id}/${file}`);
      const before = events.length;
      const add = (line: number, entry: Omit<EvidenceEvent, 'id' | 'badge' | 'caseId' | 'sourceFile' | 'line'>) => {
        events.push({ ...entry, id: `${file}:${line}`, badge: `[${file}:L${line}]`, caseId: id, sourceFile: file, line });
      };
      if (declaration?.format === 'document') {
        originals.set(file, bytes.toString('utf8').trimEnd().split(/\r?\n/));
      } else if (declaration?.format === 'event_jsonl' || declaration?.format === 'diary_csv') {
        const text = bytes.toString('utf8');
        originals.set(file, text.trimEnd().split(/\r?\n/));
        const rows = declaration.format === 'event_jsonl'
          ? text.trimEnd().split(/\r?\n/).map((line, index) => ({ record: JSON.parse(line) as Record<string, unknown>, line: index + 1 }))
          : (parse(text, { columns: true, skip_empty_lines: true, info: true }) as { record: Record<string, unknown>; info: { lines: number } }[]).map(({ record, info }) => ({ record, line: info.lines }));
        for (const { record, line } of rows) {
          const fields = (typeof record.fields === 'string' ? JSON.parse(record.fields) : record.fields) as Record<string, string | number>;
          if (!fields || Object.values(fields).some((v) => typeof v !== 'number' && typeof v !== 'string')) throw new Error('Invalid event fields');
          if (record.source !== declaration.source) throw new Error('Event source differs from declared source');
          add(line, { family: declaration.family, source: declaration.source, time: iso(String(record.timestamp)), type: String(record.type),
            severity: severity(String(record.severity)), text: String(record.message), fields,
            precision: declaration.family === 'operator_diary' ? String(fields.reported_precision ?? 'reported by operator') : undefined,
            target: fields.target_id ? String(fields.target_id) : undefined });
        }
      } else if (file === 'sniffer.csv') {
        const text = bytes.toString('utf8');
        originals.set(file, text.trimEnd().split(/\r?\n/));
        const records = parse(text, { columns: true, skip_empty_lines: true, info: true }) as { record: Record<string, string>; info: { lines: number } }[];
        for (const { record, info } of records) {
          try {
            const fields = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== '').map(([key, value]) =>
              [key, fieldValue(key, value)]));
            add(info.lines, { family: 'sniffer', source: record.producer, time: iso(record.capture_time_utc),
              type: record.message_type, severity: 'INFO', target: record.target_id || undefined,
              text: [record.message_type, record.target_id, record.details].filter(Boolean).join(' · '), fields });
          } catch (error) { summary.parseErrors.push({ file, line: info.lines, reason: String(error) }); }
        }
        if (records.length !== manifest.exported_sniffer_rows) throw new Error('Sniffer count does not match manifest');
      } else if (file.endsWith('.txt')) {
        const lines = bytes.toString('utf8').trimEnd().split(/\r?\n/);
        originals.set(file, lines);
        for (const [index, raw] of lines.entries()) {
          try {
            const fields = fieldsFromText(raw);
            add(index + 1, { family: 'component_log', source: LOG_SOURCES[file], time: logTime(raw),
              type: 'ComponentLog', severity: severity(raw), text: raw, fields,
              target: String(fields.target_id || fields.target || '') || undefined });
          } catch (error) { summary.parseErrors.push({ file, line: index + 1, reason: String(error) }); }
        }
      } else {
        const sheets = await readXlsxFile(bytes);
        if (sheets.length !== 1) throw new Error('Demo diary must contain one sheet');
        const sheet = sheets[0]!;
        const headers = sheet.data[0]!.map(String);
        const offset = manifest.source_clock.match(/[+-]\d{4}/)?.[0];
        if (!offset) throw new Error('Diary timezone is missing');
        // The parser represents Excel wall clocks as Date objects. Their Z suffix
        // is not a source timezone. Show the manifest offset in decoded cells.
        const wallClock = (value: unknown): string => {
          if (!(value instanceof Date)) throw new Error('Invalid diary date');
          const wall = new Date(Math.round(value.getTime() / 1000) * 1000).toISOString().slice(0, -1);
          return `${wall}${offset.slice(0, 3)}:${offset.slice(3)}`;
        };
        originals.set(file, sheet.data.map((row) => JSON.stringify(row.map((value) => value instanceof Date ? wallClock(value) : value))));
        for (let index = 1; index < sheet.data.length; index++) {
          try {
            const row = Object.fromEntries(headers.map((header, column) => [header, sheet.data[index]![column]]));
            const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? wallClock(value) : String(value ?? '')]));
            add(index + 1, { family: 'operator_diary', source: 'operator', sheet: sheet.sheet,
              time: iso(wallClock(row.reported_local_time)), recordedTime: iso(wallClock(row.logged_local_time)),
              precision: String(row.reported_precision), type: 'OperatorNote', severity: 'INFO', text: String(row.note_he), fields });
          } catch (error) { summary.parseErrors.push({ file, line: index + 1, reason: String(error) }); }
        }
      }
      if (declaration && events.length - before !== declaration.records) throw new Error(`Evidence count mismatch: ${file}`);
      summary.files.push({ name: file, sha256: hash, records: events.length - before });
    }
    summary.files.push({ name: 'capture_manifest.json', sha256: createHash('sha256').update(manifestText).digest('hex'), records: 1 });
    events.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    summary.eventCount = events.length;
    summary.sources = [...new Set(events.map((event) => event.source))].sort();
    summary.targets = [...new Set(events.flatMap((event) => event.target ? [event.target] : []))].sort();
    summary.diary = events.filter((event) => event.family === 'operator_diary');
    return { summary, manifest, events, originals, byBadge: new Map(events.map((event) => [event.badge, event])), stateChanges: findTimelineStateChanges(events) };
  }

  async summaries(): Promise<CaseSummary[]> { return Promise.all(this.caseIds.map((id) => this.summary(id))); }
  async summary(id: string): Promise<CaseSummary> { return (await this.load(id)).summary; }
  async manifest(id: string): Promise<Manifest> { return (await this.load(id)).manifest; }
  async coverageCitation(id: string): Promise<string> {
    const lines = (await this.load(id)).originals.get('capture_manifest.json')!;
    const index = lines.findIndex((line) => line.includes('"capture_completeness"'));
    return `[capture_manifest.json:L${index >= 0 ? index + 1 : 1}]`;
  }
  async manifestReferences(id: string): Promise<Record<string, string>> {
    const lines = (await this.load(id)).originals.get('capture_manifest.json')!;
    return Object.fromEntries(['capture_completeness', 'known_recorder_drops', 'export_selection', 'coverage_by_type', 'files', 'file_sha256'].flatMap((key) => {
      const index = lines.findIndex((line) => line.includes(`"${key}"`));
      return index < 0 ? [] : [[key, `[capture_manifest.json:L${index + 1}]`]];
    }));
  }
  async catalog(id?: string): Promise<unknown> {
    if (id) {
      const loaded = await this.load(id);
      const lines = loaded.originals.get('system_catalog.txt');
      if (lines) return lines.map((text, index) => ({ text, badge: `[system_catalog.txt:L${index + 1}]` }));
    }
    return JSON.parse(await readFile(join(this.root, 'public_system_catalog.json'), 'utf8'));
  }

  private async filtered(id: string, filter: EventFilter): Promise<EvidenceEvent[]> {
    const loaded = await this.load(id);
    const system = filter.system ? getTimelineSystem(filter.system) : undefined;
    const start = filter.start ? iso(filter.start) : undefined;
    const end = filter.end ? iso(filter.end) : undefined;
    if (start && end && start > end) throw new Error('Start must precede end');
    const query = filter.query?.trim().toLowerCase();
    const candidates = start || end ? loaded.events.slice(
      start ? timeBound(loaded.events, start, false) : 0,
      end ? timeBound(loaded.events, end, true) : loaded.events.length,
    ) : loaded.events;
    return candidates.filter((event) => (!system || system.sources.includes(event.source))
      && (!filter.source || event.source === filter.source || event.sourceFile === filter.source)
      && (!filter.target || event.target === filter.target)
      && (!filter.messageType || event.type === filter.messageType)
      && (!filter.alertsOnly || event.severity !== 'INFO')
      && (!query || `${event.badge} ${event.text} ${JSON.stringify(event.fields)}`.toLowerCase().includes(query)));
  }

  async query(id: string, filter: EventFilter = {}): Promise<EventPage> {
    const rows = await this.filtered(id, filter);
    const limit = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 100)));
    const offset = Math.max(0, Math.floor(filter.offset ?? 0));
    if (!Number.isFinite(limit) || !Number.isFinite(offset)) throw new Error('Invalid pagination');
    return { rows: rows.slice(offset, offset + limit), total: rows.length, offset, nextOffset: offset + limit < rows.length ? offset + limit : null };
  }

  async traceRequest(id: string, requestId: string) {
    if (!requestId || requestId.length > 120) throw new Error('Invalid request ID');
    const loaded = await this.load(id);
    const rows = loaded.events.filter((event) => event.fields.request_id === requestId);
    const sources = new Set(rows.map((row) => row.source));
    const versions = [...sources].flatMap((source) => {
      const current = loaded.events.findLast((event) => event.source === source && event.type === 'SoftwareVersion' && event.time <= (rows[0]?.time ?? ''));
      return current ? [current] : [];
    });
    const shownVersions = versions.slice(0, 10);
    const shownRows = rows.slice(0, 50 - shownVersions.length);
    const types = new Set([...Object.keys(loaded.manifest.coverage_by_type ?? {}), ...rows.map((row) => row.type)]);
    return { request_id: requestId, rows: shownRows, total: rows.length, truncated: rows.length > shownRows.length || versions.length > shownVersions.length,
      type_counts: Object.fromEntries([...types].map((type) => [type, rows.filter((row) => row.type === type).length])),
      query_complete: true, query_window: loaded.manifest.window_utc, recorder_drops: loaded.manifest.known_recorder_drops,
      component_versions_at_request: shownVersions,
      coverage: loaded.manifest.coverage_by_type ?? null, evidence_references: [...shownRows, ...shownVersions].map((r) => r.badge),
      limitation: 'Receipt is not application. Missing records require type/time coverage; inspect explicit outcomes and effective state.' };
  }

  async reconstructState(id: string, at: string) { return reconstructState((await this.load(id)).events, at); }
  async inspectRegion(id: string, reportBadge: string) {
    const loaded = await this.load(id);
    const reports = loaded.events.filter((event) => event.family === 'operator_diary' && event.fields.window_start && event.fields.window_end);
    const match = reportBadge.trim().match(/^\[?([a-zA-Z0-9_]+\.(?:csv|txt|xlsx|json)):L?([1-9]\d*)\]?$/);
    const report = match ? loaded.byBadge.get(`[${match[1]}:L${match[2]}]`) : undefined;
    if (!report) throw new Error(`Unknown report citation. Available report citations: ${reports.slice(0, 10).map((event) => event.badge).join(', ') || 'none'}`);
    const index = reports.findIndex((event) => event.badge === report.badge);
    if (index < 0) throw new Error('Expected a report with a time window');
    const result = inspectRegion(loaded.events, loaded.manifest, report, await this.coverageCitation(id));
    return { ...result, calculation_citation: `[calc:region:${id}:${index + 1}]` };
  }

  private async resolveCalculation(id: string, badge: string): Promise<ResolvedCalculation> {
    const match = badge.match(/^\[?calc:region:(case_[a-zA-Z0-9_]+):([1-9]\d*)\]?$/);
    if (!match) throw new Error('Unknown calculation reference');
    if (match[1] !== id) throw new Error('Cross-case calculation access denied');
    const loaded = await this.load(id);
    const reports = loaded.events.filter((event) => event.family === 'operator_diary' && event.fields.window_start && event.fields.window_end);
    const report = reports[Number(match[2]) - 1];
    if (!report) throw new Error('Unknown calculation reference');
    const result = inspectRegion(loaded.events, loaded.manifest, report, await this.coverageCitation(id));
    const inputHashes = loaded.summary.files.map(({ name, sha256 }) => ({ name, sha256 }));
    return { kind: 'calculation', badge: `[calc:region:${id}:${match[2]}]`, operation: 'region', title: 'בדיקת האזור המדווח',
      result, inputs: result.evidence_references, inputHashes,
      fingerprint: createHash('sha256').update(JSON.stringify({ method: 'region-v2', report: report.badge, inputHashes })).digest('hex') };
  }

  async timelinePoints(id: string, filter: EventFilter = {}): Promise<TimelinePoints> {
    return buildTimelinePoints(await this.filtered(id, filter));
  }

  private async focusIndex(id: string, filter: EventFilter) {
    const loaded = await this.load(id);
    const start = iso(filter.start ?? loaded.summary.start); const end = iso(filter.end ?? loaded.summary.end);
    return buildTimelineFocus(await this.filtered(id, { ...filter, start, end }), start, end, loaded.stateChanges);
  }

  async timelineFocus(id: string, filter: EventFilter = {}): Promise<TimelineFocus> {
    return (await this.focusIndex(id, filter)).result;
  }

  async timelineGroup(id: string, group: string, filter: EventFilter = {}, series?: string): Promise<TimelineGroupDetail> {
    return describeTimelineGroup(await this.focusIndex(id, filter), group, filter.offset, filter.limit, series);
  }

  async timeline(id: string, filter: EventFilter = {}): Promise<TimelineBin[]> {
    const summary = await this.summary(id);
    const start = Date.parse(iso(filter.start ?? summary.start));
    const end = Date.parse(iso(filter.end ?? summary.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Invalid timeline window');
    const width = (end - start) / 90;
    const bins: TimelineBin[] = Array.from({ length: 90 }, (_, index) => ({ start: new Date(start + index * width).toISOString(), end: new Date(start + (index + 1) * width).toISOString(), count: 0, alerts: 0, sources: {}, alertSources: {} }));
    for (const event of await this.filtered(id, { ...filter, start: new Date(start).toISOString(), end: new Date(end).toISOString() })) {
      const bin = bins[Math.min(89, Math.floor((Date.parse(event.time) - start) / width))]!;
      bin.count++; bin.alerts += Number(event.severity !== 'INFO'); bin.sources[event.source] = (bin.sources[event.source] ?? 0) + 1;
      if (event.severity !== 'INFO') bin.alertSources[event.source] = (bin.alertSources[event.source] ?? 0) + 1;
    }
    return bins;
  }

  async resolve(id: string, badge: string, context = 2): Promise<ResolvedSource> {
    if (badge.replace(/^\[/, '').startsWith('calc:')) return this.resolveCalculation(id, badge);
    const loaded = await this.load(id);
    const match = badge.match(/^\[?([a-zA-Z0-9_]+\.(?:csv|txt|xlsx|json)):L([1-9]\d*)\]?$/);
    if (!match) throw new Error('Invalid evidence reference');
    const [, file, rawLine] = match;
    const line = Number(rawLine);
    const lines = loaded.originals.get(file!);
    if (!lines || line > lines.length) throw new Error('Evidence reference does not exist in this case');
    const radius = Math.max(0, Math.min(5, Math.floor(context)));
    const canonical = `[${file}:L${line}]`;
    const event = loaded.byBadge.get(canonical);
    return { badge: canonical, sourceFile: file!, line, sheet: event?.sheet, event,
      sha256: loaded.summary.files.find((entry) => entry.name === file)!.sha256,
      lines: lines.slice(Math.max(0, line - 1 - radius), line + radius).map((content, index) => ({ number: Math.max(1, line - radius) + index, content, highlight: Math.max(1, line - radius) + index === line })) };
  }

  async analyze(id: string, args: EventFilter & { fieldA: string; fieldB?: string; operation: 'delta' | 'stats' | 'gaps' | 'quantiles' }): Promise<unknown> {
    const rows = await this.filtered(id, args);
    const samples = rows.flatMap((event) => {
      const a = event.fields[args.fieldA];
      const b = args.fieldB ? event.fields[args.fieldB] : undefined;
      return typeof a === 'number' && (!args.fieldB || typeof b === 'number') ? [{ value: args.fieldB ? decimalDifference(a, b as number) : a, event }] : [];
    });
    if (args.operation === 'delta' && !args.fieldB) throw new Error('delta requires field_b');
    if (args.operation === 'gaps') {
      const gaps = rows.slice(1).map((event, index) => ({ seconds: (Date.parse(event.time) - Date.parse(rows[index]!.time)) / 1000, from: rows[index]!.badge, to: event.badge }));
      gaps.sort((a, b) => b.seconds - a.seconds);
      return { operation: 'gaps', count: rows.length, interval_count: gaps.length, largest_gaps: gaps.slice(0, 8),
        coverage: (await this.summary(id)).coverage,
        method: 'count is the number of source records; interval_count is the number of measured gaps between consecutive records (max(0, count - 1)). No resampling or clock correction.' };
    }
    if (!samples.length) return { count: 0, field_a: args.fieldA, field_b: args.fieldB, note: 'No numeric samples match. Inspect catalog fields and capture coverage.' };
    const sorted = [...samples].sort((a, b) => a.value - b.value);
    const peak = samples.reduce((a, b) => Math.abs(a.value) >= Math.abs(b.value) ? a : b);
    return { operation: args.operation, field_a: args.fieldA, field_b: args.fieldB, count: samples.length,
      min: sorted[0]!.value, max: sorted.at(-1)!.value, mean: samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length,
      p50: sorted[Math.floor((sorted.length - 1) * .5)]!.value, p95: sorted[Math.floor((sorted.length - 1) * .95)]!.value,
      max_absolute_delta: args.fieldB ? Math.abs(peak.value) : undefined,
      peak: { timestamp_utc: peak.event.time, value: peak.value, evidence_ref: peak.event.badge, fields: peak.event.fields },
      evidence_references: [...new Set([sorted[0]!.event.badge, sorted.at(-1)!.event.badge, peak.event.badge])],
      method: 'Exact arithmetic over matching original CSV values. No interpolation or clock correction. Latitude/longitude: WGS84 degrees; x/y: local km.' };
  }
}
