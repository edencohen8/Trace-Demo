/**
 * Verification Script for Sub-task 3.1:
 * Pi Agent Core & LiteLLM Model Provider Bootstrap
 * Strict TypeScript implementation.
 *
 * Verifies:
 * 1. LiteLLM model provider initialization and configuration.
 * 2. Pi Agent Core instance setup with custom tools.
 * 3. Tool execution loop: prompt -> assistant tool call -> tool execution -> tool result -> assistant response.
 * 4. Conversational state and transcript verification.
 */

import assert from "node:assert/strict";
import { Type, type Static } from "typebox";
import { fauxAssistantMessage, fauxToolCall, fauxText } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { initModelRegistry, createLiteLLMProvider } from "../src/agent/provider.ts";
import { createInvestigationAgent } from "../src/agent/harness.ts";

async function main(): Promise<void> {
  console.log("=== [TRACE Lane 3] Sub-task 3.1 Verification (TypeScript) ===");

  // 1. Verify LiteLLM Provider Configuration
  console.log("\n[Step 1] Verifying LiteLLM Provider Setup...");
  const litellmProvider = createLiteLLMProvider({
    baseUrl: "http://localhost:4000/v1",
    apiKey: "sk-agentInfra-local",
    modelId: "gemini-2.5-flash",
  });
  const modelsList = litellmProvider.getModels();
  assert.equal(litellmProvider.id, "litellm", "Provider ID must be 'litellm'");
  assert.equal(modelsList.length, 1, "Should have 1 configured model");
  assert.equal(modelsList[0].id, "gemini-2.5-flash", "Model ID must match");
  console.log("✓ LiteLLM provider configuration verified successfully.");

  // 2. Initialize Model Registry with Faux provider for hermetic testing
  console.log("\n[Step 2] Initializing Pi AI Model Registry...");
  const registry = initModelRegistry({ useFaux: true });
  const model = registry.getModel();
  const faux = registry.fauxInstance;
  assert.ok(model, "Model instance must be initialized");
  assert.ok(faux, "Faux instance must be available for testing");
  console.log(`✓ Model registry initialized with model: ${model.id}`);

  // 3. Define Mock Investigation Tool (CTR-03 signature pattern)
  console.log("\n[Step 3] Defining mock investigation tool...");
  let toolExecuted = false;
  let receivedArgs: unknown = null;

  const AnalyzeParamsSchema = Type.Object({
    investigation_id: Type.String(),
    message_type: Type.String(),
    field_a: Type.String(),
  });

  type AnalyzeParams = Static<typeof AnalyzeParamsSchema>;

  const mockAnalyzeTool: AgentTool<typeof AnalyzeParamsSchema> = {
    name: "analyze_fields",
    label: "Analyze Fields Anomaly Detector",
    description: "Computes deltas and anomalies over case data",
    parameters: AnalyzeParamsSchema,
    execute: async (toolCallId: string, params: AnalyzeParams) => {
      toolExecuted = true;
      receivedArgs = params;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              investigation_id: params.investigation_id,
              operation: "delta",
              anomaly_detected: true,
              max_delta: 0.0542,
              evidence_references: [
                { type: "source_locator", file: "sniffer.csv", row: 1420 },
              ],
            }),
          },
        ],
        details: { max_delta: 0.0542 },
      };
    },
  };

  // 4. Script Faux Model Responses for Tool Execution Loop
  faux.setResponses([
    fauxAssistantMessage(
      [
        fauxToolCall("analyze_fields", {
          investigation_id: "case_002",
          message_type: "PositionReport",
          field_a: "site_external_lat",
        }),
      ],
      { stopReason: "toolUse" }
    ),
    fauxAssistantMessage(
      [
        fauxText(
          "Analysis complete: Detected position jump delta 0.0542 citing sniffer.csv:L1420."
        ),
      ],
      { stopReason: "stop" }
    ),
  ]);

  // 5. Create Investigation Agent Instance
  console.log("\n[Step 4] Creating Investigation Agent instance...");
  const agentController = createInvestigationAgent({
    systemPrompt: "You are the TRACE Main Investigator.",
    tools: [mockAnalyzeTool],
    model,
    streamFn: registry.streamFn,
    sessionId: "verify-subtask-3-1",
  });

  // 6. Execute Prompt & Tool Calling Loop
  console.log("\n[Step 5] Executing agent prompt loop...");
  await agentController.prompt("Investigate position reports for case_002");

  // 7. Verify Assertions
  console.log("\n[Step 6] Validating verification assertions...");

  // Assert tool execution
  assert.equal(toolExecuted, true, "Tool must have been executed by the agent loop");
  assert.deepEqual(
    receivedArgs,
    {
      investigation_id: "case_002",
      message_type: "PositionReport",
      field_a: "site_external_lat",
    },
    "Tool received expected arguments from assistant"
  );
  console.log("✓ Tool execution verified with correct arguments.");

  // Assert events
  const events = agentController.getEvents();
  const eventTypes = events.map((e) => e.type);
  console.log("Emitted lifecycle events:", eventTypes.join(" -> "));

  assert.ok(eventTypes.includes("agent_start"), "Should emit agent_start");
  assert.ok(eventTypes.includes("tool_execution_start"), "Should emit tool_execution_start");
  assert.ok(eventTypes.includes("tool_execution_end"), "Should emit tool_execution_end");
  assert.ok(eventTypes.includes("turn_end"), "Should emit turn_end");
  assert.ok(eventTypes.includes("agent_end"), "Should emit agent_end");
  console.log("✓ Event lifecycle verified.");

  // Assert conversational state & messages
  const messages = agentController.getMessages();
  console.log(`Total messages in transcript: ${messages.length}`);
  assert.ok(messages.length >= 4, "Transcript should include user, toolCall, toolResult, assistant");

  const lastMessage = messages[messages.length - 1];
  assert.equal(lastMessage.role, "assistant", "Final message must be from assistant");
  assert.equal(lastMessage.stopReason, "stop", "Final stop reason must be 'stop'");
  assert.ok(
    (lastMessage.content[0] as { type: "text"; text: string }).text.includes(
      "Detected position jump delta 0.0542"
    ),
    "Assistant response must synthesize tool results"
  );
  console.log(
    `✓ Final assistant response: "${(lastMessage.content[0] as { type: "text"; text: string }).text}"`
  );

  console.log("\n🎉 [SUB-TASK 3.1 VERIFICATION (TYPESCRIPT) PASSED]");
}

main().catch((err) => {
  console.error("\n❌ [SUB-TASK 3.1 VERIFICATION FAILED]:", err);
  process.exit(1);
});
