import { splitCitations } from './client.ts';
import { TIMELINE_SYSTEMS } from './systems.ts';
import type { ChatMessage, EvidenceEvent, TimelinePoint } from './types.ts';
import type { TimeWindow } from './time-window.ts';

/** Include expanded findings, but not unrelated tool-history references. */
export function messageReferences(message: ChatMessage): string[] {
  const text = [message.text, ...(message.details ?? []).map(detail => detail.explanation)].join('\n');
  return [...new Set([...message.citations, ...splitCitations(text).filter(part => part.citation).map(part => part.text),
    ...(message.details ?? []).flatMap(detail => detail.citations)])];
}

export function evidencePoint(event: EvidenceEvent): TimelinePoint | undefined {
  const system = TIMELINE_SYSTEMS.find(system => system.sources.includes(event.source));
  if (!system || !Number.isFinite(Date.parse(event.time))) return;
  return { system: system.id, time: event.time, badge: event.badge, source: event.source,
    type: event.type, severity: event.severity, diary: event.family === 'operator_diary', count: 1 };
}

/** Fit actual source times with breathing room, without inventing a time for metadata. */
export function evidenceWindow(events: readonly EvidenceEvent[], recording: TimeWindow): TimeWindow | undefined {
  const times = events.map(event => Date.parse(event.time)).filter(time => Number.isFinite(time) && time >= recording.start && time <= recording.end);
  if (!times.length || recording.end <= recording.start) return;
  const first = Math.min(...times); const last = Math.max(...times);
  const width = Math.min(recording.end - recording.start, Math.max(30_000, (last - first) * 1.4));
  const start = Math.round(Math.max(recording.start, Math.min(recording.end - width, (first + last - width) / 2)));
  return { start, end: Math.round(start + width) };
}

/** A bounded camera path with zero speed and acceleration at both ends. */
export function interpolateWindow(from: TimeWindow, to: TimeWindow, progress: number, recording: TimeWindow): TimeWindow {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  const t = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  const width = Math.exp(Math.log(from.end - from.start) * (1 - t) + Math.log(to.end - to.start) * t);
  const center = (from.start + from.end) / 2 * (1 - t) + (to.start + to.end) / 2 * t;
  const start = Math.max(recording.start, Math.min(recording.end - width, center - width / 2));
  return { start: Math.round(start), end: Math.round(start + width) };
}

export function timeAtPointer(window: TimeWindow, x: number, left: number, width: number): number {
  return Math.round(window.start + Math.max(0, Math.min(1, (x - left) / width)) * (window.end - window.start));
}
