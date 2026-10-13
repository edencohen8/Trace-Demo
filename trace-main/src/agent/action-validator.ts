/**
 * TRACE Lane 3: Action Validator
 * Implements TRACE_ARCHITECTURE.md §7.0.3.
 * Evaluates draft agent outputs against RequestedAnswer before returning to user.
 * Strict TypeScript definition.
 */

import { type RequestedAnswer } from "./router-schema.ts";
import { EvidenceResolver } from "./evidence-resolver.ts";

export type ActionValidationStatus =
  | "satisfied"
  | "insufficient_evidence"
  | "revise_answer"
  | "reroute"
  | "clarification_required";

export interface DraftAnswer {
  text: string;
  evidenceCitations?: string[];
  entitiesMentioned?: string[];
}

export interface ActionValidationResult {
  status: ActionValidationStatus;
  passed: boolean;
  missingEntities: string[];
  invalidCitations: string[];
  unsupportedClaims: string[];
  repairGuidance?: string;
  attemptNumber: number;
}

export interface ActionValidatorOptions {
  llmEvaluate?: (prompt: string) => Promise<string>;
}

export class ActionValidator {
  private llmEvaluate?: (prompt: string) => Promise<string>;
  private validationHistory: ActionValidationResult[] = [];

  constructor(options: ActionValidatorOptions = {}) {
    this.llmEvaluate = options.llmEvaluate;
  }

  get history(): ActionValidationResult[] {
    return [...this.validationHistory];
  }

  /**
   * Validate draft answer against RequestedAnswer contract.
   */
  async validate(
    requested: RequestedAnswer,
    draft: DraftAnswer,
    attemptNumber: number = 1
  ): Promise<ActionValidationResult> {
    const missingEntities: string[] = [];
    const invalidCitations: string[] = [];
    const unsupportedClaims: string[] = [];

    // 1. Ground Truth Isolation check (Architecture Invariant)
    if (draft.text.includes("private_ground_truth")) {
      const result: ActionValidationResult = {
        status: "revise_answer",
        passed: false,
        missingEntities: [],
        invalidCitations: ["[private_ground_truth]"],
        unsupportedClaims: ["Ground truth isolation violation."],
        repairGuidance:
          "CRITICAL ERROR: Ground Truth Isolation Violation. Never reference private_ground_truth. Use only uploaded evidence.",
        attemptNumber,
      };
      this.validationHistory.push(result);
      return result;
    }

    // 2. Deterministic Entity Scope & Coverage Check
    if (requested.entityScope === "all_available" || requested.entityScope === "specified") {
      const lowerDraft = draft.text.toLowerCase();
      const reportedEntities = (draft.entitiesMentioned || []).map((e) => e.toLowerCase());

      for (const requiredEntity of requested.mustCover) {
        const lowerReq = requiredEntity.toLowerCase();
        const foundInText = lowerDraft.includes(lowerReq);
        const foundInEntities = reportedEntities.includes(lowerReq);

        if (!foundInText && !foundInEntities) {
          missingEntities.push(requiredEntity);
        }
      }
    }

    // 3. Deterministic Evidence Badge Verification (CTR-05)
    const citations = draft.evidenceCitations || [];
    // Also extract inline badges: [file:Lnum] or [calc:...]
    const inlineBadges = draft.text.match(/\[[^\]]+\]/g) || [];
    const allBadgesToCheck = Array.from(new Set([...citations, ...inlineBadges]));

    for (const badge of allBadgesToCheck) {
      try {
        EvidenceResolver.parseReference(badge);
      } catch {
        invalidCitations.push(badge);
      }
    }

    // Check if evidence was required but completely absent
    const hasValidCitation = allBadgesToCheck.length > 0 && invalidCitations.length < allBadgesToCheck.length;
    const requiresEvidence = requested.answerKind === "health" || requested.answerKind === "signal" || requested.answerKind === "cause";

    if (requiresEvidence && !hasValidCitation && allBadgesToCheck.length === 0) {
      unsupportedClaims.push("No CTR-05 evidence citations provided for claims.");
    }

    // 4. Synthesize Validation Outcome & Repair Guidance
    if (missingEntities.length > 0) {
      const guidance = `Validation Alert (Attempt ${attemptNumber}): Your draft failed entity coverage. You must query and report the status of the following missing entities: [${missingEntities.join(
        ", "
      )}] before concluding.`;

      const result: ActionValidationResult = {
        status: "revise_answer",
        passed: false,
        missingEntities,
        invalidCitations,
        unsupportedClaims,
        repairGuidance: guidance,
        attemptNumber,
      };
      this.validationHistory.push(result);
      return result;
    }

    if (invalidCitations.length > 0) {
      const guidance = `Validation Alert (Attempt ${attemptNumber}): Found invalid evidence citations: [${invalidCitations.join(
        ", "
      )}]. Ensure citations use standard CTR-05 badges like [sniffer.csv:L1420] or [external_position_adapter.txt:L88].`;

      const result: ActionValidationResult = {
        status: "revise_answer",
        passed: false,
        missingEntities,
        invalidCitations,
        unsupportedClaims,
        repairGuidance: guidance,
        attemptNumber,
      };
      this.validationHistory.push(result);
      return result;
    }

    if (unsupportedClaims.length > 0) {
      const guidance = `Validation Alert (Attempt ${attemptNumber}): Your answer makes assertions without supporting evidence citations. Cite exact log line or sniffer row badges for your findings.`;

      const result: ActionValidationResult = {
        status: "insufficient_evidence",
        passed: false,
        missingEntities,
        invalidCitations,
        unsupportedClaims,
        repairGuidance: guidance,
        attemptNumber,
      };
      this.validationHistory.push(result);
      return result;
    }

    // 5. LLM Semantic Evaluation (if provider supplied)
    if (this.llmEvaluate) {
      const evalPrompt = `
You are the TRACE Validation Auditor.
Evaluate if the following draft answer accurately and thoroughly satisfies the user's requested scope without contradiction:

Original Question: "${requested.originalQuestion}"
Required Coverage: [${requested.mustCover.join(", ")}]
Draft Answer:
"${draft.text}"

Does the draft answer satisfy the question? Respond with JSON:
{
  "satisfied": boolean,
  "status": "satisfied" | "revise_answer" | "insufficient_evidence",
  "guidance": "string explanation if not satisfied"
}
`.trim();

      try {
        const rawEval = await this.llmEvaluate(evalPrompt);
        const evalJson = JSON.parse(rawEval);
        if (!evalJson.satisfied) {
          const result: ActionValidationResult = {
            status: evalJson.status || "revise_answer",
            passed: false,
            missingEntities,
            invalidCitations,
            unsupportedClaims: [evalJson.guidance || "Semantic validation flagged issue."],
            repairGuidance: evalJson.guidance,
            attemptNumber,
          };
          this.validationHistory.push(result);
          return result;
        }
      } catch {
        // Fall back to deterministic approval if LLM eval fails
      }
    }

    // All validation criteria satisfied
    const result: ActionValidationResult = {
      status: "satisfied",
      passed: true,
      missingEntities: [],
      invalidCitations: [],
      unsupportedClaims: [],
      attemptNumber,
    };
    this.validationHistory.push(result);
    return result;
  }
}
