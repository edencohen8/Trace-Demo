/**
 * TRACE Lane 3: Versioned Skill Registry & Loader
 * Implements TRACE_ARCHITECTURE.md §7.0.1 and §7.0.4.
 * Strict TypeScript definition.
 */

import {
  APPROVED_SKILL_IDS,
  type SkillId,
  type SkillDefinition,
  type LoadedSkillContext,
} from "./types.ts";
import { readFileSync } from 'node:fs';

export const SKILL_VERSION = "1.0.0";

const HEALTH_STATUS_INSTRUCTIONS = `
# Health Status Skill
- Method: Look up observed component health, errors, and transitions across requested scope.
- Entity Scope: Distinguish single component vs specified list vs all available components.
- States: Evaluate and report HEALTHY, DEGRADED, DOWN, or UNKNOWN/UNOBSERVED.
- Constraints: Do not form root-cause hypotheses. Do not delegate to sub-agents. Do not equate missing logs with healthy state without positive telemetry.
- Evidence: Cite exact source locators for every state transition or error observed.
`.trim();

const TIMELINE_SUMMARY_INSTRUCTIONS = `
# Timeline Summary Skill
- Method: Generate an evidence-backed chronological sequence of intervals and noteworthy events in the requested window.
- Constraints: Explain transitions without asserting causality merely due to temporal proximity.
- Summarization: Aggregate high-frequency data into chronological buckets; do not dump thousands of raw rows.
- Evidence: Cite exact source locators for each significant state transition, alert, or gap.
`.trim();

const SIGNAL_ANALYSIS_INSTRUCTIONS = `
# Signal Analysis Skill
- Method: Perform deterministic numerical calculations, time-series alignment, and jump/delta detection using DuckDB Parquet analytics.
- Units: Validate coordinate systems and units (WGS84 lat/lon vs synthetic local km) before comparing.
- Calculations: Generate reproducible calculation handles (e.g. [calc:pos_delta:case_002:81422]).
- Evidence: Cite exact source locators for peak deltas, anomalies, or transition timestamps.
`.trim();

// The loaded playbook is the same versioned document that maintainers edit.
const ROOT_CAUSE_INVESTIGATION_INSTRUCTIONS = readFileSync(new URL('../../skills/root-cause-investigation/SKILL.md', import.meta.url), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();

const BUILTIN_SKILLS: Record<SkillId, SkillDefinition> = {
  "health-status": {
    id: "health-status",
    name: "Component Health Status & Transitions",
    version: SKILL_VERSION,
    description:
      "Inspect component health, error logs, and state transitions across single, specified, or all available components without root-cause investigation.",
    instructions: HEALTH_STATUS_INSTRUCTIONS,
    allowedTools: ["query_events", "search_text", "get_evidence", "get_case_overview"],
    defaultBudget: { maxTokens: 1500, maxToolCalls: 4 },
    defaultEntityScope: "single",
  },
  "timeline-summary": {
    id: "timeline-summary",
    name: "Evidence-Backed Timeline Chronology",
    version: SKILL_VERSION,
    description:
      "Generate an evidence-backed chronological timeline across selected sources without asserting unverified causal links.",
    instructions: TIMELINE_SUMMARY_INSTRUCTIONS,
    allowedTools: ["query_events", "get_evidence", "get_case_overview"],
    defaultBudget: { maxTokens: 2000, maxToolCalls: 4 },
  },
  "signal-analysis": {
    id: "signal-analysis",
    name: "Deterministic Signal & Numerical Analysis",
    version: SKILL_VERSION,
    description:
      "Discover typed fields and units, align time series, and compute deterministic numerical comparisons, statistics, and anomaly checks.",
    instructions: SIGNAL_ANALYSIS_INSTRUCTIONS,
    allowedTools: ["analyze_fields", "get_evidence", "get_case_overview"],
    defaultBudget: { maxTokens: 2000, maxToolCalls: 4 },
  },
  "root-cause-investigation": {
    id: "root-cause-investigation",
    name: "Root-Cause Anomaly & Incident Investigation",
    version: SKILL_VERSION,
    description:
      "Form competing hypotheses, delegate bounded tasks to isolated Pi sub-agents, cross-correlate telemetry with logs, and conclude or abstain.",
    instructions: ROOT_CAUSE_INVESTIGATION_INSTRUCTIONS,
    allowedTools: ["get_case_overview", "delegate_investigation", "submit_findings"],
    defaultBudget: { maxTokens: 4000, maxToolCalls: 8 },
  },
};

export class SkillRegistry {
  private skills: Map<SkillId, SkillDefinition> = new Map();

  constructor() {
    for (const [id, def] of Object.entries(BUILTIN_SKILLS)) {
      this.skills.set(id as SkillId, { ...def });
    }
  }

  isApprovedSkillId(id: string): id is SkillId {
    return APPROVED_SKILL_IDS.includes(id as SkillId);
  }

  getSkill(id: SkillId): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  loadSkill(
    id: SkillId,
    options: { maxTokens?: number } = {}
  ): LoadedSkillContext {
    const skill = this.skills.get(id);
    if (!skill) {
      throw new Error(`SkillRegistry: Unknown skill '${id}'.`);
    }

    const maxTokens = options.maxTokens || skill.defaultBudget.maxTokens;
    // Simple heuristic token count (approx. 4 chars per token)
    const estimatedTokens = Math.ceil(skill.instructions.length / 4);

    if (estimatedTokens > maxTokens) {
      throw new Error(
        `SkillRegistry: Skill '${id}' instructions exceed token budget (${estimatedTokens} > ${maxTokens}).`
      );
    }

    return {
      skillId: skill.id,
      version: skill.version,
      instructions: skill.instructions,
      allowedTools: [...skill.allowedTools],
      estimatedTokens,
    };
  }
}

export const defaultSkillRegistry = new SkillRegistry();
