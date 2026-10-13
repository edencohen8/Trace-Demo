// Synthetic UI fixtures only. This prototype does not read investigator data.
export const DAY = 16 * 3600;
export const INCIDENT = 6 * 3600 + 32 * 60;
export const systems = [
  { id: 'iff', name: 'מערכת IFF', detail: 'קליטה וזיהוי' },
  { id: 'sensor', name: 'בקר הסנסור', detail: 'טלמטריה ומצב' },
  { id: 'operator', name: 'עמדת המפעיל', detail: 'פעולות משתמש' },
  { id: 'services', name: 'שרת השירותים', detail: 'מסירת התרעות' },
  { id: 'radio', name: 'מערכת הקשר', detail: 'דיווחי מפעיל' },
] as const;
export type SystemId = typeof systems[number]['id'];
export interface TraceEvent {
  id: string; system: SystemId; time: number; title: string; detail: string;
  severity: 'info' | 'warning' | 'critical'; end?: number; file: string; line: number;
}
const normalTitles: Record<SystemId, string> = {
  iff: 'עדכון זיהוי מטרה', sensor: 'עדכון מצב הסנסור', operator: 'פתיחת תצוגת המטרה',
  services: 'אישור קבלת הודעה', radio: 'דיווח בקשר',
};
export const evidence: TraceEvent[] = [
  { id: 'EV-106', system: 'iff', time: INCIDENT, title: 'נקלט קוד 7500', detail: 'נקלט שידור IFF עם קוד 7500 עבור המטרה T-041. הרשומה מתעדת קליטה והעברה לשירות ההתרעות.', severity: 'warning', file: 'iff_messages.csv', line: 1420 },
  { id: 'EV-107', system: 'services', time: INCIDENT + 1, end: INCIDENT + 103, title: 'שירות ההתרעות נעצר', detail: 'תועדה הפסקה בשירות ההתרעות. רשומה זו אינה מוכיחה לבדה מה גרם להפסקה או מה ראה המפעיל.', severity: 'critical', file: 'alert_service.txt', line: 88 },
  { id: 'EV-111', system: 'operator', time: INCIDENT + 102, title: 'פתיחת פרטי המטרה', detail: 'פעולה ידנית בעמדת המפעיל תועדה 102 שניות לאחר קליטת הקוד. זהו פער מחושב בין שתי רשומות, לא זמן תגובה מוכח.', severity: 'warning', file: 'operator_actions.txt', line: 51 },
  { id: 'EV-112', system: 'radio', time: INCIDENT + 20, end: INCIDENT + 138, title: 'דיווח מפעיל בקשר', detail: 'תמלול מדומה: המפעיל מדווח שלא קיבל התרעה. זמן הדיווח מקורב; זו ראיה רכה.', severity: 'info', file: 'operator_diary.csv', line: 14 },
];
const background = systems.flatMap((system, s) => Array.from({ length: 28 - s * 4 }, (_, i): TraceEvent => ({
  id: `REC-${s + 1}-${String(i + 1).padStart(3, '0')}`, system: system.id,
  time: INCIDENT - 59 + ((i * 37 + s * 19 + i * i * 3) % 297),
  title: normalTitles[system.id], detail: 'רשומת דוגמה לצורך בדיקת ממשק התחקיר. אינה רשומת מקור אמיתית.',
  severity: 'info', file: `${system.id}_demo.txt`, line: i + 1,
})));
const dayEvents = systems.flatMap((system, s) => Array.from({ length: 80 }, (_, i): TraceEvent => ({
  id: `DAY-${s}-${i}`, system: system.id, time: (i * 719 + s * 117) % DAY,
  title: normalTitles[system.id], detail: 'רשומת דוגמה להמחשת ניווט לאורך ההקלטה.',
  severity: 'info', file: `${system.id}_demo.txt`, line: i + 200,
})));
export const events = [...background, ...dayEvents, ...evidence].sort((a, b) => a.time - b.time);
export function clock(seconds: number, short = false): string {
  const total = Math.round(seconds) + 8 * 3600;
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0');
  return `${hh}:${mm}${short ? '' : ':' + String(total % 60).padStart(2, '0')}`;
}
export function sourceRecord(event: TraceEvent): string {
  return JSON.stringify({ event_id: event.id, timestamp: `2026-10-05T${clock(event.time)}+03:00`, system: event.system,
    target: 'T-041', message: event.title, severity: event.severity, simulated: true,
    locator: { source_file: event.file, line: event.line } }, null, 2);
}
