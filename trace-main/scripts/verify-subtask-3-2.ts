/**
 * Verification Script for Sub-task 3.2:
 * Skill Registry, Tool Profiles & Shared Evidence Resolver
 *
 * Verifies:
 * 1. SkillRegistry loads all 4 approved skills within token limits.
 * 2. ToolProfileManager strictly enforces tool allowlists and blocks unauthorized tools per mode.
 * 3. EvidenceResolver parses and formats CTR-05 badges and enforces Ground Truth Isolation.
 */

import { strict as assert } from "node:assert";
import {
  SkillRegistry,
  defaultSkillRegistry,
  APPROVED_SKILL_IDS,
} from "../src/agent/skills/index.ts";
import { ToolProfileManager } from "../src/agent/tool-profiles.ts";
import { EvidenceResolver } from "../src/agent/evidence-resolver.ts";

async function main() {
  console.log("=== TRACE Lane 3: Verifying Sub-task 3.2 ===");

  // 1. Skill Registry Verification
  console.log("\n[1/3] Verifying SkillRegistry...");
  assert.equal(APPROVED_SKILL_IDS.length, 4, "Must have exactly 4 approved skill IDs");

  for (const skillId of APPROVED_SKILL_IDS) {
    const skill = defaultSkillRegistry.getSkill(skillId);
    assert.ok(skill, `Skill '${skillId}' must be registered`);
    assert.equal(skill.version, "1.0.0", `Skill '${skillId}' must be version 1.0.0`);
    assert.ok(skill.instructions.length > 50, `Skill '${skillId}' must have non-empty instructions`);

    const loaded = defaultSkillRegistry.loadSkill(skillId);
    assert.equal(loaded.skillId, skillId);
    assert.ok(loaded.estimatedTokens > 0, "Estimated tokens must be positive");
    assert.ok(
      loaded.estimatedTokens <= skill.defaultBudget.maxTokens,
      `Loaded tokens (${loaded.estimatedTokens}) must not exceed budget (${skill.defaultBudget.maxTokens})`
    );
    console.log(`  ✓ Loaded skill '${skillId}' (v${loaded.version}, ~${loaded.estimatedTokens} tokens)`);
  }

  // Reject unrecognized skill
  assert.throws(
    () => defaultSkillRegistry.loadSkill("unknown-skill" as any),
    /Unknown skill 'unknown-skill'/,
    "Must throw when loading unknown skill"
  );
  console.log("  ✓ Correctly rejected unknown skill request");

  // 2. Tool Profile Manager Verification
  console.log("\n[2/3] Verifying ToolProfileManager...");

  // Health-status must NOT allow delegation
  const healthProfile = ToolProfileManager.getProfile("health-status");
  assert.equal(healthProfile.allowsDelegation, false, "health-status must not allow delegation");
  assert.ok(
    ToolProfileManager.isToolAllowed("health-status", "query_events"),
    "health-status should allow query_events"
  );
  assert.ok(
    !ToolProfileManager.isToolAllowed("health-status", "delegate_investigation"),
    "health-status MUST NOT allow delegate_investigation"
  );
  assert.throws(
    () => ToolProfileManager.assertToolAllowed("health-status", "delegate_investigation"),
    /Tool 'delegate_investigation' is forbidden for skill 'health-status'/,
    "Must throw when attempting to invoke forbidden tool"
  );
  console.log("  ✓ health-status profile permits read-only lookup and blocks delegation");

  // Root-cause-investigation MUST allow delegation but BLOCK direct query_events
  const rcProfile = ToolProfileManager.getProfile("root-cause-investigation");
  assert.equal(rcProfile.allowsDelegation, true, "root-cause-investigation must allow delegation");
  assert.ok(
    ToolProfileManager.isToolAllowed("root-cause-investigation", "delegate_investigation"),
    "root-cause-investigation must allow delegate_investigation"
  );
  assert.ok(
    !ToolProfileManager.isToolAllowed("root-cause-investigation", "query_events"),
    "root-cause-investigation MUST NOT have direct DB tool query_events"
  );
  console.log("  ✓ root-cause-investigation permits delegation and blocks direct query tools");

  // Filter tools test
  const candidateTools = [
    { name: "get_case_overview" },
    { name: "delegate_investigation" },
    { name: "query_events" },
    { name: "unrestricted_sql" },
  ];
  const filteredForHealth = ToolProfileManager.filterAllowedTools("health-status", candidateTools);
  assert.deepEqual(
    filteredForHealth.map((t) => t.name),
    ["get_case_overview", "query_events"]
  );
  console.log("  ✓ filterAllowedTools correctly stripped disallowed tools");

  // 3. Shared Evidence Resolver Verification
  console.log("\n[3/3] Verifying EvidenceResolver...");

  // CSV Sniffer row locator
  const snifferRef = EvidenceResolver.parseReference("[sniffer.csv:L1420]");
  assert.equal(snifferRef.kind, "source_locator");
  assert.equal(snifferRef.badge, "[sniffer.csv:L1420]");
  assert.equal(snifferRef.locator?.source_family, "sniffer");
  assert.equal(snifferRef.locator?.row, 1420);
  console.log("  ✓ Parsed Sniffer CSV locator badge: [sniffer.csv:L1420]");

  // TXT Log line locator
  const logRef = EvidenceResolver.parseReference("external_position_adapter.txt:88");
  assert.equal(logRef.kind, "source_locator");
  assert.equal(logRef.badge, "[external_position_adapter.txt:L88]");
  assert.equal(logRef.locator?.source_family, "component_log");
  assert.equal(logRef.locator?.line, 88);
  console.log("  ✓ Parsed component log locator: [external_position_adapter.txt:L88]");

  // Calculation badge
  const calcRef = EvidenceResolver.parseReference("[calc:pos_delta:case_002:81422]");
  assert.equal(calcRef.kind, "calculation");
  assert.equal(calcRef.calculationKey, "calc:pos_delta:case_002:81422");
  console.log("  ✓ Parsed calculation badge: [calc:pos_delta:case_002:81422]");

  // Format badge from SourceLocator
  const formatted = EvidenceResolver.formatBadge({
    source_family: "component_log",
    source_file: "alert_router.txt",
    line: 42,
  });
  assert.equal(formatted, "[alert_router.txt:L42]");
  console.log("  ✓ Formatted SourceLocator to CTR-05 badge: [alert_router.txt:L42]");

  // Resolution with mock provider
  const resolved = await EvidenceResolver.resolve(
    "[external_position_adapter.txt:L88]",
    (file, line) => `WARN: External delta threshold exceeded at line ${line}`
  );
  assert.equal(resolved.verified, true);
  assert.equal(resolved.lineOrRow, 88);
  assert.ok(resolved.contentSnippet?.includes("External delta threshold exceeded"));
  console.log("  ✓ Resolved evidence with provenance verification");

  // Ground Truth Isolation security check
  assert.throws(
    () => EvidenceResolver.parseReference("[private_ground_truth/incident_log.txt:L10]"),
    /Ground Truth Isolation Violation/,
    "Must throw security error when accessing private_ground_truth"
  );
  console.log("  ✓ Security: Ground Truth Isolation strictly enforced");

  console.log("\n✅ Sub-task 3.2 verification SUCCEEDED with 0 errors!");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
