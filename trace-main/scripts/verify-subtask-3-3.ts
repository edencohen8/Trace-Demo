/**
 * Verification Script for Sub-task 3.3:
 * Intent Router & Chat Scope Lifecycle Manager
 *
 * Verifies:
 * 1. LLM routing accuracy across all 4 skills with entityScope extraction.
 * 2. Ambiguity detection and clarification prompting.
 * 3. ChatScopeManager context lifecycle: active skill replacement without text accumulation.
 * 4. Threshold-based smart context compaction: preserves citations and shrinks token usage.
 */

import { strict as assert } from "node:assert";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  IntentRouter,
  type ChatSessionScope,
  ChatScopeManager,
} from "../src/agent/index.ts";

async function main() {
  console.log("=== TRACE Lane 3: Verifying Sub-task 3.3 ===");

  // 1. LLM Routing Simulation Provider
  // Simulates the structured output from the LLM based on prompt instructions
  const mockLlmComplete = async (prompt: string): Promise<string> => {
    if (prompt.includes("Was sensor-gps-01 working at 14:03?")) {
      return JSON.stringify({
        originalQuestion: "Was sensor-gps-01 working at 14:03?",
        investigationId: "case_002",
        requestedTime: { start: "14:02:00Z", end: "14:04:00Z" },
        requestedEntities: ["sensor-gps-01"],
        entityScope: "single",
        answerKind: "health",
        mustCover: ["sensor-gps-01"],
        selectedSkillIds: ["health-status"],
        requiresClarification: false,
        confidence: 0.95,
      });
    }

    if (prompt.includes("Which systems were down between 14:00 and 14:10?")) {
      return JSON.stringify({
        originalQuestion: "Which systems were down between 14:00 and 14:10?",
        investigationId: "case_002",
        requestedTime: { start: "14:00:00Z", end: "14:10:00Z" },
        requestedEntities: [],
        entityScope: "all_available",
        answerKind: "health",
        mustCover: ["sensor-gps-01", "sensor-psr-01", "radar-dsp", "alert-router"],
        selectedSkillIds: ["health-status"],
        requiresClarification: false,
        confidence: 0.98,
      });
    }

    if (prompt.includes("What happened between 14:00 and 14:05 UTC?")) {
      return JSON.stringify({
        originalQuestion: "What happened between 14:00 and 14:05 UTC?",
        investigationId: "case_002",
        requestedTime: { start: "14:00:00Z", end: "14:05:00Z" },
        entityScope: "all_available",
        answerKind: "timeline",
        mustCover: ["timeline_sequence"],
        selectedSkillIds: ["timeline-summary"],
        requiresClarification: false,
        confidence: 0.94,
      });
    }

    if (prompt.includes("Did the external position jump relative to GPS in case_002?")) {
      return JSON.stringify({
        originalQuestion: "Did the external position jump relative to GPS in case_002?",
        investigationId: "case_002",
        requestedEntities: ["site_external_lat", "site_gps_lat"],
        entityScope: "specified",
        answerKind: "signal",
        mustCover: ["delta_calculation", "jump_threshold"],
        selectedSkillIds: ["signal-analysis"],
        requiresClarification: false,
        confidence: 0.96,
      });
    }

    if (prompt.includes("Why did the radar miss the target between 10:15 and 11:45?")) {
      return JSON.stringify({
        originalQuestion: "Why did the radar miss the target between 10:15 and 11:45?",
        investigationId: "case_002",
        requestedTime: { start: "10:15:00Z", end: "11:45:00Z" },
        requestedEntities: ["target_14", "radar-dsp"],
        entityScope: "specified",
        answerKind: "cause",
        mustCover: ["competing_hypotheses", "log_corroboration"],
        selectedSkillIds: ["root-cause-investigation"],
        requiresClarification: false,
        confidence: 0.97,
      });
    }

    throw new Error(`Unexpected prompt in mock: ${prompt}`);
  };

  const router = new IntentRouter({ llmComplete: mockLlmComplete });
  const session: ChatSessionScope = {
    caseId: "case_002",
    knownEntities: ["sensor-gps-01", "sensor-psr-01", "radar-dsp", "alert-router"],
  };

  console.log("\n[1/4] Verifying LLM Routing across 4 Skills...");

  // Health Single
  const r1 = await router.route("Was sensor-gps-01 working at 14:03?", session);
  assert.deepEqual(r1.selectedSkillIds, ["health-status"]);
  assert.equal(r1.entityScope, "single");
  assert.equal(r1.answerKind, "health");
  assert.deepEqual(r1.requestedEntities, ["sensor-gps-01"]);
  console.log("  ✓ Routed to health-status (single sensor)");

  // Health All Available
  const r2 = await router.route("Which systems were down between 14:00 and 14:10?", session);
  assert.deepEqual(r2.selectedSkillIds, ["health-status"]);
  assert.equal(r2.entityScope, "all_available");
  assert.equal(r2.mustCover.length, 4);
  console.log("  ✓ Routed to health-status (all_available systems)");

  // Timeline Summary
  const r3 = await router.route("What happened between 14:00 and 14:05 UTC?", session);
  assert.deepEqual(r3.selectedSkillIds, ["timeline-summary"]);
  assert.equal(r3.answerKind, "timeline");
  console.log("  ✓ Routed to timeline-summary");

  // Signal Analysis
  const r4 = await router.route("Did the external position jump relative to GPS in case_002?", session);
  assert.deepEqual(r4.selectedSkillIds, ["signal-analysis"]);
  assert.equal(r4.answerKind, "signal");
  console.log("  ✓ Routed to signal-analysis");

  // Root Cause Investigation
  const r5 = await router.route("Why did the radar miss the target between 10:15 and 11:45?", session);
  assert.deepEqual(r5.selectedSkillIds, ["root-cause-investigation"]);
  assert.equal(r5.answerKind, "cause");
  console.log("  ✓ Routed to root-cause-investigation");

  // 2. Ambiguity & Clarification Detection
  console.log("\n[2/4] Verifying Ambiguity & Clarification Handling...");
  const rAmbiguous = await router.route("help", session);
  assert.equal(rAmbiguous.requiresClarification, true);
  assert.ok(rAmbiguous.clarificationPrompt?.includes("Please specify"));
  console.log("  ✓ Ambiguous query triggered requiresClarification: true");

  // 3. ChatScopeManager: Context Lifecycle & Skill Instruction Eviction
  console.log("\n[3/4] Verifying Context Lifecycle & Instruction Eviction...");
  const chatScope = new ChatScopeManager({
    caseId: "case_002",
    compactionThresholdTokens: 250, // set low threshold for verification
    knownEntities: ["sensor-gps-01", "radar-dsp"],
  });

  // Turn 1: health-status
  chatScope.recordTurn({
    skillId: "health-status",
    question: "Was sensor-gps-01 working at 14:03?",
    answer: "Sensor sensor-gps-01 was HEALTHY with nominal heartbeats.",
    evidenceBadges: ["[sniffer.csv:L1420]"],
  });

  // Next turn prompt switches to root-cause-investigation
  const promptTurn2 = chatScope.buildSystemPrompt("root-cause-investigation");
  assert.ok(promptTurn2.includes('CURRENT ACTIVE SKILL: "root-cause-investigation"'));
  assert.ok(promptTurn2.includes("ESTABLISHED FINDINGS FROM PRIOR TURNS:"));
  assert.ok(promptTurn2.includes("[sniffer.csv:L1420]"));
  // Assert old health-status manual instructions are evicted
  assert.ok(
    !promptTurn2.includes('CURRENT ACTIVE SKILL: "health-status"'),
    "Old health-status instructions must be evicted"
  );
  console.log("  ✓ Mode switch cleanly swapped skill instructions and retained prior citation badge");

  // 4. Threshold-Based Context Compaction
  console.log("\n[4/4] Verifying Threshold-Based Smart Compaction...");
  const transformHook = chatScope.createTransformContextHook();

  // Test Under Threshold (should not compact)
  const shortMessages: AgentMessage[] = [
    { role: "system", content: "System header" } as unknown as AgentMessage,
    { role: "user", content: "Question 1" } as unknown as AgentMessage,
    { role: "assistant", content: "Answer 1" } as unknown as AgentMessage,
  ];
  const shortResult = await transformHook(shortMessages);
  assert.equal(shortResult.length, shortMessages.length, "Under threshold must NOT compact");
  console.log("  ✓ Messages under threshold preserved 100% intact");

  // Test Over Threshold (should compact earlier turns, preserving citations)
  const longMessages: AgentMessage[] = [
    { role: "system", content: "System header" } as unknown as AgentMessage,
    {
      role: "user",
      content:
        "Tell me about the anomaly history in detail with lots of background information that takes up significant context space. ".repeat(
          10
        ),
    } as unknown as AgentMessage,
    {
      role: "assistant",
      content:
        "Here are previous findings referencing [sniffer.csv:L1420] and also [external_position_adapter.txt:L88] with lengthy analytical reasoning. ".repeat(
          15
        ),
    } as unknown as AgentMessage,
    { role: "user", content: "Now why did the secondary filter fail?" } as unknown as AgentMessage,
    { role: "assistant", content: "Investigating secondary filter..." } as unknown as AgentMessage,
  ];

  const beforeTokens = ChatScopeManager.estimateTokens(longMessages);
  assert.ok(beforeTokens > 250, `Long messages must exceed threshold (${beforeTokens} > 250)`);

  const compactedResult = await transformHook(longMessages);
  const afterTokens = ChatScopeManager.estimateTokens(compactedResult);

  assert.ok(
    compactedResult.length < longMessages.length,
    "Compaction must reduce message array length"
  );
  assert.ok(
    afterTokens < beforeTokens,
    `Tokens must decrease after compaction (${afterTokens} < ${beforeTokens})`
  );

  // Assert preserved evidence citations in summary
  const summaryMsg = compactedResult[1];
  assert.equal(summaryMsg.role, "system");
  const summaryContent = typeof summaryMsg.content === "string" ? summaryMsg.content : "";
  assert.ok(
    summaryContent.includes("[sniffer.csv:L1420]"),
    "Compaction must preserve evidence citation [sniffer.csv:L1420]"
  );
  assert.ok(
    summaryContent.includes("[external_position_adapter.txt:L88]"),
    "Compaction must preserve evidence citation [external_position_adapter.txt:L88]"
  );
  console.log(
    `  ✓ Compaction triggered: tokens shrunk from ${beforeTokens} to ${afterTokens} while preserving citations`
  );

  console.log("\n✅ Sub-task 3.3 verification SUCCEEDED with 0 errors!");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
