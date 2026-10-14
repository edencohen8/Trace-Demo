const SOURCES: Record<string, { short: string; full: string }> = {
  'sniffer.csv': { short: 'תעבורה', full: 'תעבורת המערכת' },
  'sensor.txt': { short: 'מכ״ם', full: 'תיעוד המכ״ם' },
  'tracking_service.txt': { short: 'עקיבה', full: 'תיעוד מעבד העקיבה' },
  'external_position_adapter.txt': { short: 'מיקום', full: 'תיעוד מתאם המיקום' },
  'notification_service.txt': { short: 'התראות', full: 'תיעוד מערכת ההתראות' },
  'ui_gateway.txt': { short: 'תצוגה', full: 'תיעוד שרת התצוגה' },
  'operator_diary.xlsx': { short: 'יומן', full: 'יומן המפעיל' },
  'capture_manifest.json': { short: 'כיסוי', full: 'פרטי כיסוי הקליטה' },
  'case_report.txt': { short: 'דיווח', full: 'דיווח התיק' },
  'operator_diary.csv': { short: 'יומן', full: 'יומן המפעיל' },
  'ui_client.txt': { short: 'ממשק', full: 'לוג תוכנת הממשק' },
  'control_gateway.txt': { short: 'שער', full: 'לוג שער הבקרה' },
  'config_service.txt': { short: 'תצורה', full: 'לוג שירות התצורה' },
  'system_catalog.txt': { short: 'קטלוג', full: 'קטלוג המערכת' },
};

export function describeCitation(badge: string) {
  const calculation = badge.match(/^\[calc:region:case_[a-zA-Z0-9_]+:([1-9]\d*)\]$/);
  if (calculation) return { file: '', line: calculation[1]!, short: 'חישוב אזור', label: `חישוב אזור · ${calculation[1]}`, description: `תוצאת בדיקת אזור ${calculation[1]}, כולל שיטה ומקורות` };
  const match = badge.match(/^\[?([^:\[\]]+):L([1-9]\d*)\]?$/);
  const file = match?.[1] ?? '';
  const line = match?.[2] ?? '';
  const source = SOURCES[file] ?? { short: 'מקור', full: 'רשומת המקור' };
  return { file, line, short: source.short, label: `${source.short}${line ? ` · ${line}` : ''}`,
    description: `${source.full}${line ? `, שורה ${line}` : ''}` };
}
