// Display groups for the five-system timeline. Evidence retains its source IDs.
export interface TimelineSystem {
  id: string;
  name: string;
  sources: readonly string[];
}

export const TIMELINE_SYSTEMS: readonly TimelineSystem[] = [
  { id: 'iff', name: 'IFF System', sources: ['iff-receiver'] },
  { id: 'sensor', name: 'Sensor Controller', sources: ['radar-psr-01'] },
  { id: 'operator', name: 'Operator Station', sources: ['ui-gateway', 'operator'] },
  { id: 'services', name: 'Services Server', sources: ['track-core', 'position-bridge', 'alert-router'] },
  { id: 'radio', name: 'Radio System', sources: [] },
];

export function getTimelineSystem(id: string): TimelineSystem {
  const system = TIMELINE_SYSTEMS.find((entry) => entry.id === id);
  if (!system) throw new Error('Unknown timeline system');
  return system;
}

export function countSystemRecords(system: TimelineSystem, sources: Record<string, number>): number {
  return system.sources.reduce((total, source) => total + (sources[source] ?? 0), 0);
}
