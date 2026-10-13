/**
 * TRACE Lane 3: Backend-Enforced Tool Profiles & Permission Controller
 * Implements TRACE_ARCHITECTURE.md §7.0.4.
 * Tool permissions are set and enforced by the controller, never conferred
 * simply because a skill text requests them.
 * Strict TypeScript definition.
 */

import { type SkillId } from "./skills/types.ts";

export interface ToolProfile {
  skillId: SkillId;
  allowedToolNames: string[];
  maxToolCalls: number;
  maxRowsPerCall: number;
  readOnly: boolean;
  allowsDelegation: boolean;
}

const TOOL_PROFILES: Record<SkillId, ToolProfile> = {
  "health-status": {
    skillId: "health-status",
    allowedToolNames: ["query_events", "search_text", "get_evidence", "get_case_overview"],
    maxToolCalls: 4,
    maxRowsPerCall: 50,
    readOnly: true,
    allowsDelegation: false,
  },
  "timeline-summary": {
    skillId: "timeline-summary",
    allowedToolNames: ["query_events", "get_evidence", "get_case_overview"],
    maxToolCalls: 4,
    maxRowsPerCall: 100,
    readOnly: true,
    allowsDelegation: false,
  },
  "signal-analysis": {
    skillId: "signal-analysis",
    allowedToolNames: ["analyze_fields", "get_evidence", "get_case_overview"],
    maxToolCalls: 4,
    maxRowsPerCall: 50,
    readOnly: true,
    allowsDelegation: false,
  },
  "root-cause-investigation": {
    skillId: "root-cause-investigation",
    allowedToolNames: ["get_case_overview", "delegate_investigation", "submit_findings"],
    maxToolCalls: 8,
    maxRowsPerCall: 50,
    readOnly: true,
    allowsDelegation: true,
  },
};

export class ToolProfileManager {
  static getProfile(skillId: SkillId): ToolProfile {
    const profile = TOOL_PROFILES[skillId];
    if (!profile) {
      throw new Error(`ToolProfileManager: No profile defined for skill '${skillId}'.`);
    }
    return { ...profile, allowedToolNames: [...profile.allowedToolNames] };
  }

  static isToolAllowed(skillId: SkillId, toolName: string): boolean {
    const profile = TOOL_PROFILES[skillId];
    if (!profile) return false;
    return profile.allowedToolNames.includes(toolName);
  }

  static assertToolAllowed(skillId: SkillId, toolName: string): void {
    if (!this.isToolAllowed(skillId, toolName)) {
      throw new Error(
        `ToolProfileManager: Tool '${toolName}' is forbidden for skill '${skillId}'. Permitted: [${TOOL_PROFILES[skillId]?.allowedToolNames.join(", ")}]`
      );
    }
  }

  static filterAllowedTools<T extends { name: string }>(
    skillId: SkillId,
    tools: T[]
  ): T[] {
    const profile = TOOL_PROFILES[skillId];
    if (!profile) return [];
    return tools.filter((t) => profile.allowedToolNames.includes(t.name));
  }
}
