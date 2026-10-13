/**
 * TRACE Lane 3: Chat Scope & Smart Context Lifecycle Manager
 * Implements TRACE_ARCHITECTURE.md §7.0.2 and user-directed threshold compaction.
 * Strict TypeScript definition.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { type SkillId } from "./skills/types.ts";
import { defaultSkillRegistry } from "./skills/registry.ts";
import { type TimeWindow } from "./router-schema.ts";

export interface TurnRecord {
  turnIndex: number;
  skillId: SkillId;
  question: string;
  answer: string;
  evidenceBadges: string[];
}

export interface ChatScopeOptions {
  caseId: string;
  compactionThresholdTokens?: number; // default: 3000 tokens
  knownEntities?: string[];
}

export class ChatScopeManager {
  readonly caseId: string;
  readonly compactionThresholdTokens: number;
  private knownEntities: Set<string>;
  private lastTimeWindow?: TimeWindow;
  private turns: TurnRecord[] = [];
  private activeSkillId?: SkillId;

  constructor(options: ChatScopeOptions) {
    this.caseId = options.caseId;
    this.compactionThresholdTokens = options.compactionThresholdTokens ?? 3000;
    this.knownEntities = new Set(options.knownEntities || []);
  }

  get activeSkill(): SkillId | undefined {
    return this.activeSkillId;
  }

  get timeWindow(): TimeWindow | undefined {
    return this.lastTimeWindow ? { ...this.lastTimeWindow } : undefined;
  }

  get entities(): string[] {
    return Array.from(this.knownEntities);
  }

  get history(): TurnRecord[] {
    return [...this.turns];
  }

  setTimeWindow(window: TimeWindow): void {
    this.lastTimeWindow = { ...window };
  }

  addEntities(entities: string[]): void {
    for (const ent of entities) {
      this.knownEntities.add(ent);
    }
  }

  setActiveSkill(skillId: SkillId): void {
    this.activeSkillId = skillId;
  }

  recordTurn(turn: Omit<TurnRecord, "turnIndex">): void {
    const turnIndex = this.turns.length + 1;
    this.turns.push({ ...turn, turnIndex });
    this.activeSkillId = turn.skillId;
  }

  /**
   * Builds the system prompt for the current turn.
   * Injects the active skill instructions while evicting old skill playbooks,
   * retaining only established facts and evidence badges from prior turns.
   */
  buildSystemPrompt(skillId: SkillId): string {
    this.activeSkillId = skillId;
    const skill = defaultSkillRegistry.loadSkill(skillId);

    const baseHeader = `
You are TRACE (Timeline Reconstruction, Analysis, Correlation & Explanation),
an expert AI forensic investigator for radar, telemetry, and distributed mission systems.

GROUND TRUTH ISOLATION RULE:
Never reference or attempt to access 'private_ground_truth'. All observations must be
backed by uploaded source locators ([file:Lnum]) or deterministic analytical calculations ([calc:...]).

CURRENT ACTIVE SKILL: "${skill.skillId}" (v${skill.version})
${skill.instructions}
`.trim();

    let contextSection = `\n\nINVESTIGATION CONTEXT:\n- Active Case: "${this.caseId}"`;
    if (this.lastTimeWindow) {
      contextSection += `\n- Current Time Interval: ${this.lastTimeWindow.start} to ${this.lastTimeWindow.end}`;
    }
    if (this.knownEntities.size > 0) {
      contextSection += `\n- Known Entities: [${Array.from(this.knownEntities).join(", ")}]`;
    }

    if (this.turns.length > 0) {
      contextSection += `\n\nESTABLISHED FINDINGS FROM PRIOR TURNS:`;
      for (const t of this.turns) {
        const citations =
          t.evidenceBadges.length > 0
            ? ` (Evidence: ${t.evidenceBadges.join(", ")})`
            : "";
        contextSection += `\n- Turn ${t.turnIndex} [${t.skillId}]: ${t.answer}${citations}`;
      }
    }

    return baseHeader + contextSection;
  }

  /**
   * Estimate token count from messages (approx 4 chars per token).
   */
  static estimateTokens(messages: AgentMessage[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      if ("content" in msg) {
        if (typeof msg.content === "string") {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if ("text" in block && typeof block.text === "string") {
              totalChars += block.text.length;
            }
          }
        }
      }
    }
    return Math.ceil(totalChars / 4);
  }

  /**
   * Provides the transformContext hook for AgentOptions.
   * Preserves full history while under threshold; triggers smart compaction
   * once tokens exceed compactionThresholdTokens.
   */
  createTransformContextHook(): (
    messages: AgentMessage[],
    signal?: AbortSignal
  ) => Promise<AgentMessage[]> {
    return async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
      const currentTokens = ChatScopeManager.estimateTokens(messages);

      // If under threshold, preserve 100% of information
      if (currentTokens <= this.compactionThresholdTokens || messages.length <= 4) {
        return messages;
      }

      // Compact earlier turns: retain first system prompt + compact summary + latest 2 messages
      const systemMessage = messages[0];
      const recentMessages = messages.slice(-2);
      const intermediateMessages = messages.slice(1, -2);

      // Extract key facts and citations from intermediate messages
      const intermediateText = intermediateMessages
        .map((m) => {
          if ("content" in m && typeof m.content === "string") return m.content;
          return "";
        })
        .join(" ");

      // Extract all citations like [file.ext:L123] or [calc:...]
      const citationMatches =
        intermediateText.match(/\[(?:[a-zA-Z0-9_\-./]+:L?\d+|calc:[^\]]+)\]/g) || [];
      const uniqueCitations = Array.from(new Set(citationMatches));

      const compactedSummaryMessage: AgentMessage = {
        role: "system",
        content: `[Compacted Context: Earlier conversation turns summarized to maintain context bounds. Preserved evidence citations: ${
          uniqueCitations.length > 0 ? uniqueCitations.join(", ") : "None"
        }. Full details logged in PostgreSQL.]`,
      } as AgentMessage;

      return [systemMessage, compactedSummaryMessage, ...recentMessages];
    };
  }
}
