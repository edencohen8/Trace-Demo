export interface TimeWindow { start: number; end: number }

/** Keep the time under the pointer fixed unless the recording boundary is reached. */
export function zoomTimeWindow(current: TimeWindow, recording: TimeWindow, factor: number, fraction = .5): TimeWindow {
  const duration = current.end - current.start;
  const total = recording.end - recording.start;
  if (![current.start, current.end, recording.start, recording.end, factor, fraction].every(Number.isFinite)
    || duration <= 0 || total <= 0 || factor <= 0) return current;
  const anchor = Math.max(0, Math.min(1, fraction));
  const width = Math.round(Math.max(Math.min(15_000, total), Math.min(total, duration * factor)));
  const time = current.start + duration * anchor;
  const start = Math.round(Math.max(recording.start, Math.min(recording.end - width, time - width * anchor)));
  return { start, end: start + width };
}

export function wheelZoomFactor(delta: number, mode: number, pageHeight: number): number {
  if (!Number.isFinite(delta)) return 1;
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? Math.max(1, pageHeight) : 1);
  return Math.exp(Math.max(-160, Math.min(160, pixels)) * .0025);
}
