/**
 * TRACE Lane 3: Skill Types & Schemas
 * Implements TRACE_ARCHITECTURE.md §7.0.1 - §7.0.4.
 * Strict TypeScript definition.
 */

export const APPROVED_SKILL_IDS = [
  "health-status",
  "timeline-summary",
  "signal-analysis",
  "root-cause-investigation",
] as const;

export type SkillId = (typeof APPROVED_SKILL_IDS)[number];

export type EntityScope = "single" | "specified" | "all_available";

export interface SkillBudget {
  maxTokens: number;
  maxToolCalls?: number;
  maxRowsPerCall?: number;
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  version: string;
  description: string;
  instructions: string;
  allowedTools: string[];
  defaultBudget: SkillBudget;
  defaultEntityScope?: EntityScope;
}

export interface LoadedSkillContext {
  skillId: SkillId;
  version: string;
  instructions: string;
  allowedTools: string[];
  estimatedTokens: number;
}
