/**
 * Verification Script for Sub-task 3.4:
 * Action Validator & Bounded Repair Controller
 *
 * Verifies:
 * 1. ActionValidator detects under-scoped drafts and flags missing entities.
 * 2. ActionRepairController guides the agent to repair and succeeds within attempt budget.
 * 3. Bounded loop strictly halts at maxAttempts (4) when unresolvable, returning degraded notice.
 * 4. Ground Truth Isolation and CTR-05 evidence badge validation are strictly enforced.
 */

import { strict as assert } from "node:assert";
import {
  ActionValidator,
  ActionRepairController,
  type RequestedAnswer,
  type DraftAnswer,
} from "../src/agent/index.ts";

async function main() {
  console.log("=== TRACE Lane 3: Verifying Sub-task 3.4 ===");

  const requestedAllSystems: RequestedAnswer = {
    originalQuestion: "Which systems were unhealthy at 14:03?",
    investigationId: "case_002",
    requestedTime: { start: "14:00:00Z", end: "14:10:00Z" },
    entityScope: "all_available",
    answerKind: "health",
    mustCover: ["sensor-gps-01", "sensor-psr-01", "radar-dsp", "alert-router"],
    selectedSkillIds: ["health-status"],
    requiresClarification: false,
    confidence: 0.95,
  };

  // 1. Under-scoped draft validation
  console.log("\n[1/4] Verifying Detection of Under-Scoped Draft...");
  const validator = new ActionValidator();
  const partialDraft: DraftAnswer = {
    text: "I checked sensor-gps-01 at 14:03 and it was HEALTHY [sniffer.csv:L1420].",
    evidenceCitations: ["[sniffer.csv:L1420]"],
  };

  const valResult1 = await validator.validate(requestedAllSystems, partialDraft, 1);
  assert.equal(valResult1.passed, false, "Under-scoped draft must fail validation");
  assert.equal(valResult1.status, "revise_answer");
  assert.equal(valResult1.missingEntities.length, 3);
  assert.ok(valResult1.missingEntities.includes("sensor-psr-01"));
  assert.ok(valResult1.missingEntities.includes("radar-dsp"));
  assert.ok(valResult1.missingEntities.includes("alert-router"));
  assert.ok(valResult1.repairGuidance?.includes("failed entity coverage"));
  console.log("  ✓ Under-scoped draft caught; missing entities correctly identified");

  // 2. Automated repair loop with recovery (Attempt 1 fails -> Attempt 2 succeeds)
  console.log("\n[2/4] Verifying Automated Repair Loop Recovery...");
  const repairController = new ActionRepairController({ maxAttempts: 4 });

  let attemptRecorded = 0;
  const simulatedAgentStep = async (attempt: number, guidance?: string): Promise<DraftAnswer> => {
    attemptRecorded = attempt;
    if (attempt === 1) {
      // First attempt is under-scoped
      return {
        text: "Sensor sensor-gps-01 was nominal at 14:03 [sniffer.csv:L1420].",
        evidenceCitations: ["[sniffer.csv:L1420]"],
      };
    }

    // Second attempt receives guidance and supplies complete answer
    assert.ok(guidance?.includes("failed entity coverage"), "Guidance must instruct agent on missing entities");
    return {
      text: "Comprehensive status:\n- sensor-gps-01: HEALTHY [sniffer.csv:L1420]\n- sensor-psr-01: HEALTHY [sniffer.csv:L1425]\n- radar-dsp: DOWN [external_position_adapter.txt:L88]\n- alert-router: HEALTHY [alert_router.txt:L42]",
      evidenceCitations: [
        "[sniffer.csv:L1420]",
        "[sniffer.csv:L1425]",
        "[external_position_adapter.txt:L88]",
        "[alert_router.txt:L42]",
      ],
    };
  };

  const finalResult = await repairController.executeWithRepair(
    requestedAllSystems,
    simulatedAgentStep
  );

  assert.equal(finalResult.success, true, "Repair loop should succeed on attempt 2");
  assert.equal(finalResult.attempts, 2, "Should succeed in exactly 2 attempts");
  assert.equal(finalResult.degradedConfidence, false, "Confidence should not be degraded");
  assert.ok(finalResult.answerText.includes("radar-dsp: DOWN"));
  console.log("  ✓ Agent successfully repaired under-scoped answer on Attempt 2");

  // 3. Hard bound of <= 4 attempts for unresolvable data gap
  console.log("\n[3/4] Verifying Bounded Stop at <= 4 Attempts (No Infinite Loop)...");
  const unresolvableController = new ActionRepairController({ maxAttempts: 4 });

  let stubbornAttempts = 0;
  const stubbornAgentStep = async (attempt: number): Promise<DraftAnswer> => {
    stubbornAttempts = attempt;
    // Always returns incomplete answer omitting alert-router
    return {
      text: `Attempt ${attempt}: Verified sensor-gps-01, sensor-psr-01, radar-dsp [sniffer.csv:L1420].`,
      evidenceCitations: ["[sniffer.csv:L1420]"],
    };
  };

  const stubbornResult = await unresolvableController.executeWithRepair(
    requestedAllSystems,
    stubbornAgentStep
  );

  assert.equal(stubbornResult.success, false, "Unresolvable gap must not succeed");
  assert.equal(stubbornAttempts, 4, "Must execute exactly 4 attempts before halting");
  assert.equal(stubbornResult.attempts, 4, "Result must report 4 attempts");
  assert.equal(stubbornResult.degradedConfidence, true, "Must flag degraded confidence");
  assert.ok(
    stubbornResult.answerText.includes("Partial Answer / Degraded Confidence"),
    "Must include degraded confidence disclaimer in answer"
  );
  assert.ok(
    stubbornResult.answerText.includes("alert-router"),
    "Must cite missing entity alert-router in disclaimer"
  );
  console.log("  ✓ Strictly halted at attempt 4 with partial answer & degraded confidence note");

  // 4. Citation and Ground Truth Isolation enforcement
  console.log("\n[4/4] Verifying Citation & Ground Truth Isolation Checks...");
  const invalidCitationDraft: DraftAnswer = {
    text: "sensor-gps-01 was down [invalid_badge_no_line].",
    evidenceCitations: ["[invalid_badge_no_line]"],
  };
  const valResultInvalid = await validator.validate(requestedAllSystems, invalidCitationDraft, 1);
  assert.equal(valResultInvalid.passed, false);
  assert.ok(valResultInvalid.invalidCitations.includes("[invalid_badge_no_line]"));
  console.log("  ✓ Invalid evidence badge format correctly caught and rejected");

  const gtViolationDraft: DraftAnswer = {
    text: "According to private_ground_truth/incident.json, the fault occurred at 14:03.",
  };
  const valResultGt = await validator.validate(requestedAllSystems, gtViolationDraft, 1);
  assert.equal(valResultGt.passed, false);
  assert.ok(valResultGt.repairGuidance?.includes("Ground Truth Isolation Violation"));
  console.log("  ✓ Security: Ground Truth Isolation violation immediately caught");

  console.log("\n✅ Sub-task 3.4 verification SUCCEEDED with 0 errors!");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
