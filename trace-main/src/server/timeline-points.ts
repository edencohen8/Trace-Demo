import type { EvidenceEvent, TimelinePoint, TimelinePoints } from '../demo/types.ts';
import { TIMELINE_SYSTEMS } from '../demo/systems.ts';

const MAX_POINTS_PER_SYSTEM = 300;
const sourceSystems = new Map(TIMELINE_SYSTEMS.flatMap(system => system.sources.map(source => [source, system.id] as const)));
const priority = (event: Pick<EvidenceEvent, 'severity'> & { diary: boolean }) =>
  event.severity === 'ERROR' ? 3 : event.severity === 'WARN' ? 2 : event.diary ? 1 : 0;

// Sample real records at wide zoom levels. Never shift their timestamps to a grid.
function sample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 0) return [];
  if (limit === 1) return [items[0]!];
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * (items.length - 1) / (limit - 1))]!);
}

export function buildTimelinePoints(events: readonly EvidenceEvent[]): TimelinePoints {
  const groups = new Map<string, TimelinePoint>();
  for (const event of events) {
    const system = sourceSystems.get(event.source);
    if (!system) throw new Error(`No timeline system for source: ${event.source}`);
    const key = `${system}:${event.time}`;
    const candidate: TimelinePoint = { system, time: event.time, badge: event.badge,
      source: event.source, type: event.type, severity: event.severity, count: 1,
      diary: event.family === 'operator_diary' };
    const previous = groups.get(key);
    if (!previous) groups.set(key, candidate);
    else {
      const count = previous.count + 1;
      if (priority(candidate) > priority(previous)) groups.set(key, { ...candidate, count });
      else previous.count = count;
    }
  }
  const ordered = [...groups.values()].sort((a, b) => a.time.localeCompare(b.time) || a.badge.localeCompare(b.badge));
  const points = TIMELINE_SYSTEMS.flatMap(system => {
    const lane = ordered.filter(point => point.system === system.id);
    if (lane.length <= MAX_POINTS_PER_SYSTEM) return lane;
    const important = lane.filter(point => priority(point) > 0);
    const routine = lane.filter(point => priority(point) === 0);
    return [...sample(important, MAX_POINTS_PER_SYSTEM), ...sample(routine, Math.max(0, MAX_POINTS_PER_SYSTEM - important.length))]
      .sort((a, b) => a.time.localeCompare(b.time));
  });
  return { points, totalPoints: groups.size, totalRecords: events.length, truncated: points.length < groups.size };
}
