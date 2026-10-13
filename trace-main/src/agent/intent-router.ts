/**
 * TRACE Lane 3: Intent Router
 * Implements TRACE_ARCHITECTURE.md §7.0.2.
 * LLM-driven intent classification mapping user questions to RequestedAnswer.
 * Strict TypeScript definition.
 */

import { type Model, type Api } from "@earendil-works/pi-ai";
import { defaultSkillRegistry } from "./skills/registry.ts";
import {
  type RequestedAnswer,
  type TimeWindow,
  RequestedAnswerSchema,
} from "./router-schema.ts";

export interface ChatSessionScope {
  caseId: string;
  lastTimeWindow?: TimeWindow;
  knownEntities?: string[];
}

export interface IntentRouterOptions {
  model?: Model<Api>;
  llmComplete?: (prompt: string) => Promise<string>;
}

export class IntentRouter {
  private llmComplete?: (prompt: string) => Promise<string>;

  constructor(options: IntentRouterOptions = {}) {
    this.llmComplete = options.llmComplete;
  }

  /**
   * Route user query into a validated RequestedAnswer.
   */
  async route(
    userQuery: string,
    session: ChatSessionScope
  ): Promise<RequestedAnswer> {
    const trimmed = userQuery.trim();

    // Check for essential ambiguity / empty queries
    if (!trimmed || trimmed.length < 5 || /^(tell me|hello|help|hi|hey)$/i.test(trimmed)) {
      return {
        originalQuestion: userQuery,
        investigationId: session.caseId,
        entityScope: "single",
        answerKind: "health",
        mustCover: [],
        selectedSkillIds: ["health-status"],
        requiresClarification: true,
        clarificationPrompt:
          "Please specify what you would like to investigate or inspect (e.g., check component health, summarize timeline, analyze signal deltas, or investigate an incident).",
        confidence: 0.1,
      };
    }

    const skills = defaultSkillRegistry.getAllSkills();
    const skillsCatalog = skills
      .map((s) => `- ${s.id}: ${s.description}`)
      .join("\n");

    const prompt = `
You are the TRACE Intent Router for telemetry and radar incident analysis.
Your job is to analyze the user's inquiry and classify it into an exact RequestedAnswer JSON object.

Available Approved Skills:
${skillsCatalog}

Current Investigation Context:
- Active Case ID: "${session.caseId}"
- Known Entities in Case: [${(session.knownEntities || []).join(", ")}]
- Last Time Window: ${
      session.lastTimeWindow
        ? `${session.lastTimeWindow.start} to ${session.lastTimeWindow.end}`
        : "None specified"
    }

Routing Rules:
1. "health-status":
   - Use when user asks about component operational state, errors, or if something was working/down/healthy.
   - Set entityScope:
     * "single": Asking about one component (e.g. "Was sensor A working at 14:03?")
     * "specified": Asking about a listed subset (e.g. "Were radar-dsp and gps healthy?")
     * "all_available": Asking across all systems (e.g. "Which systems were unhealthy?", "List all failed components")
   - answerKind: "health"

2. "timeline-summary":
   - Use when user asks for a chronological sequence of events, transitions, or what happened in a time window.
   - answerKind: "timeline"

3. "signal-analysis":
   - Use when user asks to compare numerical values, find jumps/deltas, analyze coordinate differences, or check sampling statistics.
   - answerKind: "signal"

4. "root-cause-investigation":
   - Use ONLY when user asks for causal explanation, why an anomaly/drop occurred, or root-cause diagnostics.
   - answerKind: "cause"

5. If critical time or target scope is completely missing and makes answering impossible, set "requiresClarification: true" and provide a "clarificationPrompt".

User Inquiry:
"${trimmed}"

Respond ONLY with a valid JSON object matching this schema:
Do not repeat the user's question or case context. The server retains the original question and case ID.
{
  "requestedTime": { "start": "string", "end": "string" } | null,
  "requestedEntities": ["string"],
  "entityScope": "single" | "specified" | "all_available",
  "answerKind": "health" | "timeline" | "signal" | "cause" | "evidence_followup",
  "mustCover": ["string"],
  "selectedSkillIds": ["health-status" | "timeline-summary" | "signal-analysis" | "root-cause-investigation"],
  "requiresClarification": boolean,
  "clarificationPrompt": string | null,
  "confidence": number (between 0.0 and 1.0)
}
`.trim();

    let rawResponse: string;
    if (this.llmComplete) {
      rawResponse = await this.llmComplete(prompt);
    } else {
      throw new Error(
        "IntentRouter: No LLM completion provider configured. Provide llmComplete or configure model."
      );
    }

    try {
      // Extract JSON if model wrapped in markdown fences
      const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        rawResponse,
      ];
      const parsed = JSON.parse(jsonMatch[1] || rawResponse);

      // Clean up nulls to match optional fields
      const result: RequestedAnswer = {
        originalQuestion: userQuery,
        investigationId: session.caseId,
        entityScope: parsed.entityScope || "single",
        answerKind: parsed.answerKind || "health",
        mustCover: Array.isArray(parsed.mustCover) ? parsed.mustCover : [],
        selectedSkillIds: Array.isArray(parsed.selectedSkillIds)
          ? parsed.selectedSkillIds
          : ["health-status"],
        requiresClarification: Boolean(parsed.requiresClarification),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
      };

      if (parsed.requestedTime?.start && parsed.requestedTime?.end) {
        result.requestedTime = {
          start: parsed.requestedTime.start,
          end: parsed.requestedTime.end,
        };
      } else if (session.lastTimeWindow) {
        result.requestedTime = { ...session.lastTimeWindow };
      }

      if (Array.isArray(parsed.requestedEntities) && parsed.requestedEntities.length > 0) {
        result.requestedEntities = parsed.requestedEntities;
      }

      if (parsed.clarificationPrompt) {
        result.clarificationPrompt = parsed.clarificationPrompt;
      }

      return result;
    } catch (err) {
      throw new Error(
        `IntentRouter: Failed to parse router JSON response: ${err instanceof Error ? err.message : String(err)}\nRaw response: ${rawResponse}`
      );
    }
  }
}
