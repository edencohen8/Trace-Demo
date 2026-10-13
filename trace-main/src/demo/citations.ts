const SOURCES: Record<string, { short: string; full: string }> = {
  'sniffer.csv': { short: 'תעבורה', full: 'תעבורת המערכת' },
  'sensor.txt': { short: 'מכ״ם', full: 'תיעוד המכ״ם' },
  'tracking_service.txt': { short: 'עקיבה', full: 'תיעוד מעבד העקיבה' },
  'external_position_adapter.txt': { short: 'מיקום', full: 'תיעוד מתאם המיקום' },
  'notification_service.txt': { short: 'התראות', full: 'תיעוד מערכת ההתראות' },
  'ui_gateway.txt': { short: 'תצוגה', full: 'תיעוד שרת התצוגה' },
  'operator_diary.xlsx': { short: 'יומן', full: 'יומן המפעיל' },
  'capture_manifest.json': { short: 'כיסוי', full: 'פרטי כיסוי הקליטה' },
};

export function describeCitation(badge: string) {
  const match = badge.match(/^\[?([^:\[\]]+):L([1-9]\d*)\]?$/);
  const file = match?.[1] ?? '';
  const line = match?.[2] ?? '';
  const source = SOURCES[file] ?? { short: 'מקור', full: 'רשומת המקור' };
  return { file, line, short: source.short, label: `${source.short}${line ? ` · ${line}` : ''}`,
    description: `${source.full}${line ? `, שורה ${line}` : ''}` };
}
