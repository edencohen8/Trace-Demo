import type { InvestigationStep } from './types.ts';

export function visibleInvestigationSteps(steps: InvestigationStep[], running: boolean, expanded: boolean): InvestigationStep[] {
  const completed = steps.filter((step) => step.state !== 'running')
    .sort((a, b) => (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt)
      || (a.completionOrder ?? 0) - (b.completionOrder ?? 0));
  const pending = steps.filter((step) => step.state === 'running')
    .sort((a, b) => a.startedAt - b.startedAt);
  // Canceled steps remain visible as unfinished, never as completed checks.
  if (!running) return [...completed, ...pending];
  const activeTools = pending.filter((step) => step.id.startsWith('tool:'));
  const current = (activeTools.length ? activeTools : pending).at(-1);
  // One live row stays below the history. Outer phases do not add spinners.
  return [...(expanded ? completed : completed.slice(-3)), ...(current ? [current] : [])];
}
