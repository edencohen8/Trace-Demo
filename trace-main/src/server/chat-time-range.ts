import type { ChatTimeRange } from '../demo/types.ts';

export function parseChatTimeRange(value: unknown, recording: ChatTimeRange): ChatTimeRange | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid selected time range');
  const { start, end } = value as Record<string, unknown>;
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (typeof start !== 'string' || typeof end !== 'string' || !iso.test(start) || !iso.test(end)) throw new Error('Selected times need an explicit timezone');
  const first = Date.parse(start); const last = Date.parse(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) throw new Error('Selected time range must have a positive duration');
  if (first < Date.parse(recording.start) || last > Date.parse(recording.end)) throw new Error('Selected time range is outside this recording');
  return { start: new Date(first).toISOString(), end: new Date(last).toISOString() };
}

export function questionWithTimeRange(text: string, range?: ChatTimeRange): string {
  return range ? `${text}\n\nSelected timeline range (UTC, inclusive): ${range.start} to ${range.end}. Answer the question for this selected interval. Identify any supporting context outside it explicitly.` : text;
}
