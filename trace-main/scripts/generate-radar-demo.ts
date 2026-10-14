// Offline authoring only. Runtime imports no generator or test expectations.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Variant = 'baseline' | 'missing-state' | 'partial-detections' | 'outside-sector' | 'cancel-applied';
type Fields = Record<string, string | number>;
type Row = { timestamp: string; source: string; type: string; severity: string; message: string; fields: Fields };
const epoch = Date.parse('2026-10-14T12:00:00Z');
const time = (seconds: number) => new Date(epoch + seconds * 1000).toISOString();
const csv = (values: unknown[]) => values.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',');

export function buildRadarPackage(variant: Variant = 'baseline', seed = 15015): Map<string, string> {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const files = new Map<string, Row[]>();
  const add = (file: string, seconds: number, source: string, type: string, message: string, fields: Fields = {}, severity = 'INFO') => {
    const rows = files.get(file) ?? [];
    rows.push({ timestamp: time(seconds), source, type, severity, message, fields }); files.set(file, rows);
  };
  const az = variant === 'outside-sector' ? 60 : 42;
  const region = { azimuth_deg: az, azimuth_uncertainty_deg: 1, range_km: 26, range_uncertainty_km: .5 };
  const description = `דיווח מפעיל: מטרת התרגיל T015I לא התגלתה במעבר הצפוי סביב 15:04:10, זמן מקומי UTC+03:00. חלון הבדיקה כולל אי-ודאות בזמן: 15:03:55–15:04:25. המיקום הצפוי לפי תיאום התרגיל הוא אזימוט ${az}° מצפון אמיתי, בטווח 26 ק״מ; אי-ודאות ±1° ו־±0.5 ק״מ. זהו דיווח מתיאום התרגיל, לא מדידת מכ״ם. התבקשה סריקה בגזרה 30°–65°, בתבנית SEARCH_WIDE. יש לבדוק גילוי מכ״ם; אין כאן דיווח על כשל IFF.`;
  add('case_report.txt', 270, 'operator', 'InitialReport', description, { ...region, target_id: 'T015I', window_start: time(235), window_end: time(265), observation_basis: 'exercise_coordinator_report', reported_precision: 'time window includes ±5s; angle ±1deg; range ±0.5km' });
  add('operator_diary.csv', 20, 'operator', 'OperatorNote', 'הוגדרה חסימה זמנית לגזרה 35°–50° לצורך הכנת התרגיל.', { sector_id: 'SEC-7', request_id: 'req-101' });
  add('operator_diary.csv', 115, 'operator', 'OperatorNote', 'הנחיית חיפוש: עבור לסריקה 30°–65°, תבנית SEARCH_WIDE, טווח עד 80 ק״מ. בוצעה פקודת הכיוון.', { request_id: 'req-202' });
  add('operator_diary.csv', 180, 'operator', 'OperatorNote', 'לחצתי על ביטול המגזר. סימון החסימה נעלם מהמסך.', { request_id: 'req-303', sector_id: 'SEC-7' });
  add('operator_diary.csv', 275, 'operator', 'OperatorNote', 'לא ראיתי גילוי במעבר שעליו דיווח מתאם התרגיל. האזור מוצג פתוח.', { target_id: 'T015I', report_ref: 'case_report.txt' });
  add('operator_diary.csv', 435, 'operator', 'OperatorNote', 'בוצעה פעולת ביטול נוספת לפי נוהל תחזוקה.', { request_id: 'req-505', sector_id: 'SEC-7' });
  add('operator_diary.csv', 500, 'operator', 'RepeatPassReport', 'מתאם התרגיל דיווח על מעבר נוסף של T015I באותו אזור ובגובה ובמהירות דומים. נצפה גילוי במסך.', { ...region, target_id: 'T015I', window_start: time(480), window_end: time(490), observation_basis: 'exercise_coordinator_report', conditions: 'same exercise aircraft; altitude 2km ±0.1; speed 150m/s ±10' });

  add('ui_client.txt', 0, 'operator-ui', 'SoftwareVersion', 'UI started', { software_version: '2.0.0', component_id: 'operator-ui' });
  add('config_service.txt', 0, 'config-service', 'SoftwareVersion', 'Configuration service started', { software_version: '1.4.0', supported_schemas: 'sector.v1,search.v1' });
  add('ui_client.txt', 90, 'operator-ui', 'SoftwareVersion', 'UI update completed', { software_version: '2.1.0', previous_version: '2.0.0', sector_request_schema: 'sector.v2', search_request_schema: 'search.v1' });
  const request = (seconds: number, id: string, schema: string, operation: string, fields: Fields) => {
    add('ui_client.txt', seconds, 'operator-ui', 'RequestSent', 'Control request sent', { request_id: id, schema_id: schema, operation, ...fields });
    add('control_gateway.txt', seconds + .02, 'control-gateway', 'ReceiptAcknowledgement', 'Request accepted into queue', { request_id: id, acknowledgement: 'RECEIPT', queued: 'true' });
  };
  const applied = (seconds: number, id: string, schema: string, operation: string, fields: Fields) => {
    add('config_service.txt', seconds, 'config-service', 'RequestApplied', 'Request decoded and applied', { request_id: id, schema_id: schema, operation, result: 'APPLIED', ...fields });
    add('control_gateway.txt', seconds + .01, 'control-gateway', 'ApplicationAcknowledgement', 'Applied result forwarded', { request_id: id, acknowledgement: 'APPLICATION', result: 'APPLIED', ...fields });
  };
  request(20, 'req-101', 'sector.v1', 'SET', { sector_id: 'SEC-7', enabled: 'true' });
  applied(20.1, 'req-101', 'sector.v1', 'SET', { sector_id: 'SEC-7', enabled: 'true' });
  request(115, 'req-202', 'search.v1', 'SET_SEARCH', { azimuth_start_deg: 30, azimuth_end_deg: 65, pattern: 'SEARCH_WIDE' });
  applied(115.1, 'req-202', 'search.v1', 'SET_SEARCH', { pattern: 'SEARCH_WIDE' });
  request(180, 'req-303', 'sector.v2', 'REMOVE', { sector_id: 'SEC-7', ui_version: '2.1.0', payload_field: 'sector_action', payload_value: 'remove' });
  add('ui_client.txt', 180.03, 'operator-ui', 'DisplayChanged', 'Sector overlay removed after queue receipt', { request_id: 'req-303', sector_id: 'SEC-7', displayed_enabled: 'false', applied_state_verified: 'false', trigger: 'RECEIPT' });
  if (variant === 'cancel-applied') {
    add('config_service.txt', 170, 'config-service', 'SoftwareVersion', 'Service update complete', { software_version: '1.5.0', supported_schemas: 'sector.v1,sector.v2,search.v1' });
    applied(180.1, 'req-303', 'sector.v2', 'REMOVE', { sector_id: 'SEC-7', enabled: 'false', software_version: '1.5.0' });
  } else {
    add('config_service.txt', 180.1, 'config-service', 'RequestRejected', 'Unsupported sector request schema: expected enabled:boolean in sector.v1; sector_action in sector.v2 cannot be decoded', { request_id: 'req-303', sector_id: 'SEC-7', software_version: '1.4.0', schema_id: 'sector.v2', supported_schema: 'sector.v1', error_code: 'UNSUPPORTED_SCHEMA', result: 'NOT_APPLIED' }, 'ERROR');
    add('control_gateway.txt', 180.12, 'control-gateway', 'ResultDelivery', 'Processing result retained on internal result channel', { request_id: 'req-303', result: 'NOT_APPLIED', destination: 'internal-results', ui_subscribed: 'false' }, 'WARN');
    add('ui_client.txt', 181, 'operator-ui', 'ResultSubscription', 'UI listens for queue receipts; application result subscription disabled', { receipt_channel: 'subscribed', application_result_channel: 'not_subscribed', reconcile_effective_state: 'false' });
  }
  request(320, 'req-404', 'search.v1', 'SET_SEARCH', { pattern: 'SEARCH_WIDE', azimuth_start_deg: 30, azimuth_end_deg: 65 });
  applied(320.1, 'req-404', 'search.v1', 'SET_SEARCH', { pattern: 'SEARCH_WIDE' });
  add('config_service.txt', 420, 'config-service', 'SoftwareVersion', 'Service update complete', { software_version: '1.5.0', previous_version: variant === 'cancel-applied' ? '1.5.0' : '1.4.0', supported_schemas: 'sector.v1,sector.v2,search.v1' });
  request(435, 'req-505', 'sector.v2', 'REMOVE', { sector_id: 'SEC-7', payload_field: 'sector_action', payload_value: 'remove' });
  applied(435.1, 'req-505', 'sector.v2', 'REMOVE', { sector_id: 'SEC-7', enabled: 'false', software_version: '1.5.0' });
  add('ui_client.txt', 435.2, 'operator-ui', 'ApplicationResultReceived', 'Applied result requested and displayed by maintenance verification', { request_id: 'req-505', result: 'APPLIED', sector_id: 'SEC-7' });
  for (const [s, enabled] of [[20.1, 'true'], [435.1, 'false'], ...(variant === 'cancel-applied' ? [[180.1, 'false']] : [])] as [number, string][]) {
    add('sniffer.csv', s, 'radar-psr-01', 'InhibitSectorState', 'Effective sector transition', { sector_id: 'SEC-7', enabled, azimuth_start_deg: 35, azimuth_end_deg: 50, range_min_km: 0, range_max_km: 80, valid_until: time(Math.ceil(s / 5) * 5) });
  }
  add('sniffer.csv', 115.1, 'radar-psr-01', 'RadarState', 'Effective search transition', { pattern: 'SEARCH_WIDE', azimuth_start_deg: 30, azimuth_end_deg: 65, range_min_km: 0, range_max_km: 80, valid_until: time(120), scan_period_s: 5, receiver: 'ACTIVE', request_id: 'req-202' });
  add('ui_client.txt', 180.03, 'operator-ui', 'DisplayState', 'Displayed sector transition', { sector_id: 'SEC-7', displayed_enabled: 'false', valid_until: time(185) });
  for (let s = 0; s <= 600; s += 5) {
    add('sniffer.csv', s, 'radar-psr-01', 'RadarState', 'Effective search state', { pattern: s < 120 ? 'SEARCH_EAST' : 'SEARCH_WIDE', azimuth_start_deg: s < 120 ? 70 : 30, azimuth_end_deg: s < 120 ? 110 : 65, range_min_km: 0, range_max_km: 80, valid_until: time(s + 5), scan_period_s: 5, receiver: 'ACTIVE', request_id: s < 120 ? 'initial' : s < 325 ? 'req-202' : 'req-404' });
    if (variant !== 'missing-state' || s < 175 || s >= 440) {
      add('sniffer.csv', s, 'radar-psr-01', 'InhibitSectorState', 'Effective sector state', { sector_id: 'SEC-7', enabled: s >= 25 && s < (variant === 'cancel-applied' ? 185 : 440) ? 'true' : 'false', azimuth_start_deg: 35, azimuth_end_deg: 50, range_min_km: 0, range_max_km: 80, valid_until: time(s + 5) });
    }
    add('ui_client.txt', s, 'operator-ui', 'DisplayState', 'Displayed sector state', { sector_id: 'SEC-7', displayed_enabled: s >= 25 && s <= 180 ? 'true' : 'false', valid_until: time(s + 5) });
    // Ordinary detections outside the inhibit region, inside the configured scan.
    const backgroundAz = s + .5 < 115.1 ? 85 : 56 + Math.round(random() * 2);
    if (variant !== 'partial-detections' || s < 235 || s > 265) {
      for (const type of ['Detection', 'TargetTrack']) add('sniffer.csv', s + .5, 'radar-psr-01', type, 'Radar observation', { target_id: 'TRK-B12', azimuth_deg: backgroundAz, range_km: 32, altitude_km: 2, scan_id: `scan-${s / 5}` });
    }
    if (s >= 480 && s <= 490 || variant === 'cancel-applied' && s >= 240 && s <= 260) {
      for (const type of ['Detection', 'TargetTrack']) add('sniffer.csv', s + 1, 'radar-psr-01', type, 'Radar observation', { target_id: 'TRK-781', azimuth_deg: az + .2, range_km: 26.1, altitude_km: 2.02, scan_id: `scan-${s / 5}` });
    }
    if (s % 60 === 0) add('config_service.txt', s + .3, 'config-service', 'Heartbeat', 'Service ready; request queue drained', { queue_depth: 0, uptime_s: s < 420 ? s : s - 420 });
  }
  const output = new Map<string, string>();
  const declarations: Record<string, { format: string; family: string; source: string; records: number }> = {};
  const columns = ['capture_time_utc', 'producer', 'message_type', 'target_id', 'details', 'request_id', 'sector_id', 'enabled', 'pattern', 'azimuth_start_deg', 'azimuth_end_deg', 'range_min_km', 'range_max_km', 'valid_until', 'scan_period_s', 'receiver', 'azimuth_deg', 'range_km', 'altitude_km', 'scan_id'];
  for (const [name, rows] of files) {
    rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    // State intervals stop at the next snapshot, including a subsecond transition.
    // This is explicit recorder validity metadata, not a model interpolation.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (!row.fields.valid_until) continue;
      const next = rows.slice(i + 1).find((r) => r.type === row.type && r.source === row.source && r.fields.sector_id === row.fields.sector_id);
      if (next && next.timestamp < String(row.fields.valid_until)) row.fields.valid_until = next.timestamp;
    }
    let content: string;
    if (name === 'sniffer.csv') content = [csv(columns), ...rows.map((r) => csv(columns.map((key) => ({ capture_time_utc: r.timestamp, producer: r.source, message_type: r.type, details: r.message, ...r.fields })[key])))].join('\n') + '\n';
    else if (name.endsWith('.csv')) content = [csv(['timestamp', 'source', 'type', 'severity', 'message', 'fields']), ...rows.map((r) => csv([r.timestamp, r.source, r.type, r.severity, r.message, JSON.stringify(r.fields)]))].join('\n') + '\n';
    else content = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    output.set(`raw/${name}`, content);
    declarations[name] = { format: name === 'sniffer.csv' ? 'sniffer_csv' : name.endsWith('.csv') ? 'diary_csv' : 'event_jsonl', family: name === 'sniffer.csv' ? 'sniffer' : name.includes('diary') || name === 'case_report.txt' ? 'operator_diary' : 'component_log', source: rows[0]!.source, records: rows.length };
  }
  const catalog = [
    'Synthetic radar system catalog. Not a description of a real radar.',
    'InhibitSectorState is effective radar state. An enabled inhibit sector suppresses production of Detection and TargetTrack messages within its angular and range bounds, even if the area is scanned.',
    'Requested state, DisplayState and effective RadarState/InhibitSectorState are separate observations. Display state does not certify applied state.',
    'ReceiptAcknowledgement means accepted into a queue only. ApplicationAcknowledgement with APPLIED means processing and application completed. RequestRejected with NOT_APPLIED is local to that request; it does not mean the service crashed.',
    'SoftwareVersion reports the actual component software version and supported schemas. RequestSent carries schema_id. sector.v1 represents a change with enabled:boolean. sector.v2 uses sector_action:set|remove. search.v1 is a separate request schema.',
    'Angles are degrees clockwise from true north in a fixed radar-site polar frame. Ranges are kilometres. Bounds are inclusive. Increasing azimuth wraps through north (0 degrees). Equal angular endpoints mean zero width.',
    'RadarState gives the effective search bounds, pattern and receiver status. SEARCH_WIDE and SEARCH_EAST name search patterns; use the reported bounds, not the name alone, for geometry.',
    'Snapshots are valid from timestamp until valid_until (exclusive), unless replaced earlier. Do not carry state across a gap. Clocks are synchronized UTC within 10ms; report windows include human timing uncertainty.',
    'InitialReport and RepeatPassReport are human reports from the exercise coordinator. Their position and time uncertainty are explicit. The exercise target identifier need not be present in radar observations. A spatial match is not independent identity confirmation.',
    'Detection/TargetTrack absence is meaningful only within an interval with complete message-type, all-target, spatially unfiltered capture and zero recorder drops. Partial exports cannot prove absence.',
    'Use inspect_region with a report badge for reproducible geometry, coverage and counts. Its calculation_citation opens the result, method and input references. Use that real calculation handle for derived claims; do not invent a source row. Use reconstruct_state for a UTC instant and trace_request for request identifiers.',
  ].join('\n') + '\n';
  output.set('raw/system_catalog.txt', catalog);
  declarations['system_catalog.txt'] = { format: 'document', family: 'component_log', source: 'catalog', records: 0 };
  const types = [...new Set(files.get('sniffer.csv')!.map((r) => r.type))];
  const manifest = {
    investigation_id: 'case_005', title: 'כשל בזיהוי מטרה T015I', description, synthetic: true, generator_seed: seed,
    source_clock: 'UTC; operator local +0300', window_utc: { start: time(0), end: time(605) },
    export_selection: { message_types: types, excluded_message_types: [], target_filter: 'ALL', spatial_filter: 'NONE', columns },
    known_recorder_drops: variant === 'partial-detections' ? null : 0,
    capture_completeness: variant === 'partial-detections' || variant === 'missing-state' ? 'partial; inspect coverage_by_type' : 'complete for declared types, all targets and full recording window',
    coverage_by_type: Object.fromEntries([...types, 'RequestSent', 'ReceiptAcknowledgement', 'RequestApplied', 'ApplicationAcknowledgement', 'RequestRejected', 'ResultDelivery'].map((type) => [type, { complete: !(variant === 'partial-detections' && ['Detection', 'TargetTrack'].includes(type) || variant === 'missing-state' && type === 'InhibitSectorState'), start: time(0), end: time(605), all_targets: true, spatial_filter: 'NONE' }])),
    files: declarations, exported_sniffer_rows: files.get('sniffer.csv')!.length,
    file_sha256: Object.fromEntries([...output].map(([name, text]) => [name.replace('raw/', ''), createHash('sha256').update(text).digest('hex')])),
  };
  output.set('capture_manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return output;
}

export async function writeRadarPackage(root: string, variant: Variant = 'baseline'): Promise<void> {
  for (const [name, text] of buildRadarPackage(variant)) {
    await mkdir(join(root, 'raw'), { recursive: true });
    await writeFile(join(root, name), text);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeRadarPackage(resolve('src/radar-simulator/TRACE_v03_investigator_data/fixtures/case_005'));
  console.log('Generated synthetic case_005 (seed 15015).');
}
