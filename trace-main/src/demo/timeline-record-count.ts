import type { TimelinePoint } from './types.ts';

/** Same-time points represent several records. Citation pins can repeat them. */
export function countTimelineRecords(points: readonly TimelinePoint[], evidence: readonly TimelinePoint[]): number {
  const represented = new Set(points.map(point => `${point.system}:${point.time}`));
  const extra = new Set(evidence.filter(point => !represented.has(`${point.system}:${point.time}`)).map(point => point.badge));
  return points.reduce((total, point) => total + point.count, 0) + extra.size;
}
