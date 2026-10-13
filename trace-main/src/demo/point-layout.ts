import type { TimelinePoint } from './types.ts';

export interface PositionedPoint extends TimelinePoint {
  left: number;
  top: number;
}

function badgeHash(badge: string): number {
  let hash = 2166136261;
  for (const character of badge) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

/** Vertical rows separate nearby records; only horizontal position encodes time. */
export function layoutTimelinePoints(points: readonly TimelinePoint[], start: string, end: string, trackWidth: number): PositionedPoint[] {
  const leftEdge = Date.parse(start);
  const duration = Date.parse(end) - leftEdge;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const gap = 12 / Math.max(1, trackWidth) * 100;
  const lastPosition = Array<number>(5).fill(-Infinity);
  return [...points].sort((a, b) => a.time.localeCompare(b.time) || a.badge.localeCompare(b.badge)).map(point => {
    const left = Math.max(0, Math.min(100, (Date.parse(point.time) - leftEdge) / duration * 100));
    const hash = badgeHash(point.badge);
    const preferred = hash % 5;
    const rowOrder = Array.from({ length: 5 }, (_, index) => (preferred + index) % 5);
    const row = rowOrder.find(index => left - lastPosition[index]! >= gap)
      ?? rowOrder.reduce((best, index) => lastPosition[index]! < lastPosition[best]! ? index : best);
    lastPosition[row] = left;
    // A small, stable offset within each row avoids drawing an artificial grid.
    const offset = ((hash >>> 8) % 101) / 100 * 8 - 4;
    return { ...point, left, top: 20 + row * 15 + offset };
  });
}
