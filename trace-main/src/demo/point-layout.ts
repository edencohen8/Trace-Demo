import type { TimelineGroup, TimelinePoint } from './types.ts';

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

export function layoutTimelineGroups(groups: readonly TimelineGroup[], start: string, end: string, trackWidth: number) {
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const signals = layoutTimelinePoints(groups.filter(group => group.kind !== 'activity'), start, end, trackWidth);
  const positions = new Map(signals.map(point => [point.badge, point]));
  return groups.filter(group => group.end >= start && group.time <= end).map(group => {
    const left = Math.max(0, (Date.parse(group.time) - Date.parse(start)) / duration * 100);
    const right = Math.min(100, (Date.parse(group.end) - Date.parse(start)) / duration * 100);
    return { ...group, left, width: Math.max(0, right - left),
      top: group.kind === 'activity' ? 82 : (positions.get(group.badge)?.top ?? 50) * .62 };
  });
}
