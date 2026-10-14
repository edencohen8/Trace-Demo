import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { InvestigationStep, ProgressEvent } from '../demo/types.ts';
import { describeCitation } from '../demo/citations.ts';

type Values = Record<string, unknown>;
const object = (value: unknown): Values => value && typeof value === 'object' && !Array.isArray(value) ? value as Values : {};
const string = (value: unknown) => typeof value === 'string' ? value : '';
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const count = (value: number) => value.toLocaleString('he-IL');
const SOURCE_NAMES: Record<string, string> = { 'radar-psr-01': 'המכ״ם', 'track-core': 'מעבד העקיבה', 'position-bridge': 'מתאם המיקום', 'alert-router': 'מערכת ההתראות', 'ui-gateway': 'שרת התצוגה', 'operator-ui': 'תוכנת הממשק', 'control-gateway': 'שער הבקרה', 'config-service': 'שירות התצורה', 'iff-receiver': 'מקלט הזיהוי', operator: 'יומן המפעיל' };

function readableSource(value: unknown): string {
  const source = string(value);
  return SOURCE_NAMES[source] ?? (source.endsWith('.txt') || source.endsWith('.xlsx') ? describeCitation(`[${source}:L1]`).description.replace(', שורה 1', '') : 'המקורות שנבחרו');
}
function clock(value: unknown): string {
  const time = Date.parse(string(value));
  return Number.isFinite(time) ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(time) : '';
}
function timeWindow(args: Values): string {
  const start = clock(args.time_start_utc); const end = clock(args.time_end_utc);
  return start && end ? `בין ${start} ל־${end} (זמן מקומי)` : start ? `החל מ־${start} (זמן מקומי)` : '';
}
function field(value: unknown): string {
  const name = string(value);
  if (name.startsWith('site_external')) return 'המיקום החיצוני';
  if (name.startsWith('site_gps')) return 'מיקום הלוויין';
  if (name.startsWith('site_manual')) return 'המיקום שהוזן ידנית';
  return ({ confidence: 'איכות הזיהוי', threshold: 'סף הסינון', range_km: 'טווח המטרה', bearing_deg: 'כיוון המטרה' } as Record<string, string>)[name] ?? 'המדד שנבחר';
}
function startDescription(tool: string, args: Values, delegation: number): { title: string; detail?: string } {
  const window = timeWindow(args);
  switch (tool) {
    case 'inspect_region': return { title: 'בודק גילויים, כיסוי ומצב בפועל באזור המדווח', detail: 'מחשב חפיפה לפי חלון הזמן ואי־הוודאות שבדיווח.' };
    case 'trace_request': return { title: 'עוקב אחר הבקשה בין הרכיבים', detail: `מזהה בקשה: ${string(args.request_id)}` };
    case 'reconstruct_state': return { title: 'משווה מצב תצוגה למצב בפועל', detail: `מצב בשעה ${clock(args.at_utc)} (זמן מקומי).` };
    case 'get_case_overview': return { title: 'בודק מקורות וכיסוי קליטה', detail: 'קורא גם את דיווחי המפעיל.' };
    case 'query_events': return { title: args.source_system ? `בודק אירועים מתוך ${readableSource(args.source_system)}` : 'בודק את רצף האירועים', detail: [window, number(args.offset) ? `ממשיך מרשומה ${count(Number(args.offset) + 1)}` : !window ? 'משווה זמנים ורשומות שנקלטו.' : ''].filter(Boolean).join(' · ') };
    case 'search_text': return { title: `מחפש דיווחים מתוך ${readableSource(args.source_system)}`, detail: [window, string(args.query) ? `חיפוש: ״${string(args.query).slice(0, 70)}״` : !window ? 'מחפש דיווחים רלוונטיים במקור.' : ''].filter(Boolean).join(' · ') };
    case 'get_evidence': return { title: `פותח את ${describeCitation(string(args.badge)).description}`, detail: 'בודק את הרשומה ואת ההקשר שלה.' };
    case 'analyze_fields': return { title: args.operation === 'gaps' ? 'בודק פערי זמן בין הרשומות' : args.field_b ? `משווה בין ${field(args.field_a)} לבין ${field(args.field_b)}` : `מחשב נתוני סיכום עבור ${field(args.field_a)}`, detail: window || 'מחשב ישירות מהנתונים שנקלטו.' };
    case 'delegate_investigation': return { title: `בודק כיוון חקירה ${delegation}`, detail: /[\u0590-\u05ff]/.test(string(args.question)) ? string(args.question).slice(0, 160) : 'משווה הסבר נוסף מול המקורות.' };
    case 'update_blackboard': {
      const description = string(object(args.hypothesis).description);
      return { title: args.action === 'propose_hypothesis' ? 'מוסיף הסבר אפשרי לבדיקה' : args.action === 'update_hypothesis' ? 'מעדכן את ההסברים לפי הממצאים' : 'מעדכן את ממצאי התחקיר',
        detail: /[\u0590-\u05ff]/.test(description) ? `השערה לבדיקה: ${description.slice(0, 180)}` : undefined };
    }
    case 'submit_findings': return { title: 'מסכם ממצאים ושאלות פתוחות', detail: 'מצרף אסמכתאות ומגבלות לבדיקה.' };
    default: return { title: 'מבצע בדיקה נוספת במקורות' };
  }
}

function resultDescription(tool: string, args: Values, result: unknown): string {
  const details = object(object(result).details);
  if (tool === 'inspect_region') {
    const detections = object(details.detections); const search = object(details.search); const inhibit = object(details.inhibit);
    return [
      `נמצאו ${number(detections.count) ?? 0} גילויים באזור ובזמן המדווחים${detections.coverage_complete ? ', בכיסוי הקלטה מלא' : '; כיסוי ההקלטה אינו מספיק לקביעת היעדר'}.`,
      search.covers_report_throughout === true ? 'נתוני הסריקה מכסים את האזור לאורך כל החלון.' : search.covers_report_throughout === null ? 'חסר מידע על הסריקה בחלק מהחלון.' : 'הסריקה אינה מכסה את כל האזור לאורך כל החלון.',
      inhibit.blocks_report_throughout === true ? 'האזור המדווח נמצא בתוך מגזר פעיל לאורך כל החלון.' : inhibit.blocks_report_throughout === null ? 'חסר דיווח מצב שמאפשר לקבוע אם החסימה הייתה פעילה.' : 'לא נמצאה חסימה של כל האזור לאורך כל החלון.',
    ].join(' ');
  }
  if (tool === 'trace_request') {
    const rows = Array.isArray(details.rows) ? details.rows.map(object) : [];
    const kinds = rows.map((row) => string(row.type));
    const rejected = object(rows.find((r) => r.type === 'RequestRejected')?.fields);
    const display = object(rows.find((r) => r.type === 'DisplayChanged')?.fields);
    const delivery = object(rows.find((r) => r.type === 'ResultDelivery')?.fields);
    if (rejected.error_code === 'UNSUPPORTED_SCHEMA') return [
      `בקשת ${string(rejected.schema_id)} נדחתה בשירות בגרסה ${string(rejected.software_version)}; הפורמט הנתמך הוא ${string(rejected.supported_schema)}.`,
      display.trigger === 'RECEIPT' && display.applied_state_verified === 'false' ? 'התצוגה השתנתה לפי אישור קבלה, ללא אימות החלה.' : '',
      delivery.ui_subscribed === 'false' ? 'ערוץ תוצאת העיבוד לא היה מחובר לממשק.' : '',
    ].filter(Boolean).join(' ');
    return [`נמצאו ${number(details.total) ?? rows.length} רשומות לבקשה.`,
      kinds.includes('ReceiptAcknowledgement') ? 'תועד אישור קבלה.' : '',
      kinds.includes('RequestRejected') ? 'תועד כשל בעיבוד הבקשה.' : '',
      kinds.includes('ApplicationAcknowledgement') ? 'תועד אישור החלה.' : 'לא הוחזר אישור החלה; יש לבדוק את כיסוי המקור ואת המצב בפועל.',
    ].filter(Boolean).join(' ');
  }
  if (tool === 'reconstruct_state') {
    const rows = Array.isArray(details.snapshots) ? details.snapshots.map(object) : [];
    const effective = rows.find((r) => r.type === 'InhibitSectorState');
    const displayed = rows.find((r) => r.type === 'DisplayState');
    const label = (value: unknown) => value === 'true' ? 'פעיל' : value === 'false' ? 'כבוי' : 'לא ידוע';
    return [effective?.state ? `מצב מגזר בפועל: ${label(object(effective.state).enabled)}.` : 'אין דיווח מגזר תקף בשעה זו.',
      displayed?.state ? `מצב בתצוגה: ${label(object(displayed.state).displayed_enabled)}.` : 'אין דיווח תצוגה תקף בשעה זו.'].join(' ');
  }
  if (tool === 'query_events' || tool === 'search_text') {
    const total = number(details.total); const rows = Array.isArray(details.rows) ? details.rows.length : 0;
    if (total === 0) return 'לא נמצאו רשומות תואמות. אין בכך הוכחה שהאירוע לא התרחש.';
    if (total !== undefined) return `נמצאו ${count(total)} רשומות; הוחזרו ${count(rows)} לבדיקה${details.nextOffset != null ? '. קיימות רשומות נוספות' : ''}.`;
  }
  if (tool === 'get_evidence') return details.kind === 'calculation' ? 'נפתחה תוצאת החישוב, שיטת החישוב וקישורים למקורות.' : clock(object(details.event).time) ? `נפתחה הרשומה משעה ${clock(object(details.event).time)} וההקשר שלה.` : 'נפתחו הרשומה המקורית ושורות סמוכות.';
  if (tool === 'analyze_fields') {
    const samples = number(details.count);
    if (samples === 0) return 'לא נמצאו דגימות מספריות מתאימות.';
    const delta = number(details.max_absolute_delta);
    if (delta !== undefined) return `נבדקו ${count(samples ?? 0)} דגימות. הפער המרבי: ${Number(delta.toPrecision(5))}${/_(lat|lon)$/.test(string(args.field_a)) ? ' מעלות' : ''}.`;
    if (Array.isArray(details.largest_gaps)) {
      const gap = number(object(details.largest_gaps[0]).seconds);
      return gap === undefined ? 'אין מספיק רשומות לחישוב פערים.' : `נבדקו ${count(samples ?? 0)} רשומות. הפער הארוך ביותר: ${Number(gap.toFixed(2))} שניות.`;
    }
    if (samples !== undefined) return `חושבו נתוני סיכום עבור ${count(samples)} דגימות.`;
  }
  if (tool === 'get_case_overview') {
    const sources = Array.isArray(details.sources) ? details.sources : Array.isArray(details.available_feeds) ? details.available_feeds : [];
    const missing = Array.isArray(details.excludedTypes) ? details.excludedTypes : Array.isArray(details.missing_feeds) ? details.missing_feeds : [];
    return `${sources.length} מקורות זמינים לבדיקה.${missing.length ? ` ${missing.length} סוגי הודעות לא נכללו בקליטה.` : ''}`;
  }
  if (tool === 'delegate_investigation') return details.status === 'error' || details.status === 'budget_exhausted'
    ? 'הבדיקה הזו לא הושלמה. המסקנות יוגבלו לראיות שנאספו.'
    : `הבדיקה הסתיימה${Array.isArray(details.findings) ? `: ${details.findings.length} ממצאים לבדיקה` : ''}.`;
  if (tool === 'update_blackboard') {
    const state = string(object(args.hypothesis).status);
    return ({ SUPPORTED: 'נמצאה תמיכה ראשונית; האסמכתאות עדיין בבדיקה.', REFUTED: 'נרשמה ראיה נגד ההסבר שנבדק.', DISCARDED: 'כיוון החקירה הוסר מהרשימה.' } as Record<string, string>)[state] ?? 'הממצאים והבדיקות הבאות עודכנו.';
  }
  if (tool === 'submit_findings') return `הוגשו ${number(details.findings_count) ?? 0} ממצאים. בודק את האסמכתאות.`;
  return 'הבדיקה הסתיימה; התוצאה הועברה לתחקיר.';
}

function resultCitations(tool: string, result: unknown): string[] {
  const details = object(object(result).details);
  if (tool === 'get_evidence') return string(details.badge) ? [string(details.badge)] : [];
  if (tool === 'analyze_fields') return Array.isArray(details.evidence_references) ? details.evidence_references.filter((entry): entry is string => typeof entry === 'string').slice(0, 2) : [];
  if (tool === 'inspect_region' && string(details.calculation_citation)) return [string(details.calculation_citation)];
  if (tool === 'inspect_region' || tool === 'reconstruct_state') return Array.isArray(details.evidence_references) ? details.evidence_references.filter((v): v is string => typeof v === 'string') : [];
  if (tool === 'trace_request') return Array.isArray(details.rows) ? details.rows.filter((row) => ['ReceiptAcknowledgement', 'RequestRejected', 'ApplicationAcknowledgement', 'DisplayChanged', 'ResultDelivery'].includes(string(object(row).type))).flatMap((row) => string(object(row).badge) ? [string(object(row).badge)] : []) : [];
  return [];
}

export class InvestigationProgress {
  private steps = new Map<string, InvestigationStep>();
  private args = new Map<string, Values>();
  private phaseId?: string;
  private phaseNumber = 0;
  private delegationNumber = 0;
  private completionNumber = 0;
  constructor(private emit: (event: ProgressEvent) => void, private now = Date.now) {}

  private send(type: ProgressEvent['type'], step: InvestigationStep, tool?: string) {
    const recorded = step.state === 'running' ? step : { ...step, completionOrder: step.completionOrder ?? ++this.completionNumber };
    this.steps.set(step.id, recorded);
    this.emit({ type, text: recorded.detail || recorded.title, tool, step: { ...recorded } });
  }
  private closePhase() {
    const previous = this.phaseId ? this.steps.get(this.phaseId) : undefined;
    if (previous?.state === 'running') this.send('status', { ...previous, state: 'complete', completedAt: this.now() });
  }
  status(title: string, detail?: string) {
    this.closePhase();
    this.phaseId = `phase:${++this.phaseNumber}`;
    this.send('status', { id: this.phaseId, title, detail, state: 'running', startedAt: this.now() });
  }
  onAgentEvent = (event: AgentEvent) => {
    // Only public actions/results. Never forward model thinking or token deltas.
    if (event.type === 'tool_execution_start') {
      const id = `tool:${event.toolCallId}`;
      const args = object(event.args);
      this.args.set(id, args);
      if (event.toolName === 'delegate_investigation') this.delegationNumber++;
      this.send('tool_call', { id, ...startDescription(event.toolName, args, this.delegationNumber), state: 'running', startedAt: this.now() }, event.toolName);
    }
    if (event.type === 'tool_execution_end') {
      const id = `tool:${event.toolCallId}`;
      const step = this.steps.get(id);
      if (!step) return;
      const details = object(object(event.result).details);
      const failed = event.isError || details.status === 'error' || details.status === 'budget_exhausted' || details.success === false;
      this.send('tool_result', { ...step, state: failed ? 'error' : 'complete', completedAt: this.now(),
        detail: event.isError ? 'הבדיקה לא הצליחה. התוצאה הזו לא תשמש ראיה למסקנה.' : resultDescription(event.toolName, this.args.get(id) ?? {}, event.result),
        citations: failed ? [] : resultCitations(event.toolName, event.result) }, event.toolName);
    }
  };
  finish(): InvestigationStep[] { this.closePhase(); return [...this.steps.values()].map((step) => ({ ...step })); }
}
