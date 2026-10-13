/**
 * TRACE Lane 3: Action Repair Controller
 * Implements TRACE_ARCHITECTURE.md §7.0.3 with user-specified max 4 repair attempts.
 * Controls the bounded interaction loop between the Main Agent and Validator Agent.
 * Strict TypeScript definition.
 */

import { type RequestedAnswer } from "./router-schema.ts";
import {
  ActionValidator,
  type DraftAnswer,
  type ActionValidationResult,
} from "./action-validator.ts";

export interface RepairControllerOptions {
  maxAttempts?: number; // Defaults to 4 (per user instruction: attempts <= 4)
  validator?: ActionValidator;
}

export interface FinalAnswerResult {
  success: boolean;
  attempts: number;
  answerText: string;
  degradedConfidence: boolean;
  degradedNotice?: string;
  validationHistory: ActionValidationResult[];
}

export class ActionRepairController {
  readonly maxAttempts: number;
  readonly validator: ActionValidator;

  constructor(options: RepairControllerOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 4;
    this.validator = options.validator ?? new ActionValidator();
  }

  /**
   * Run the bounded agent turn execution with automated repair guidance.
   * If validation fails, injects specific instructions and re-runs up to maxAttempts.
   * Halts cleanly if maxAttempts is reached without infinite looping.
   */
  async executeWithRepair(
    requested: RequestedAnswer,
    agentStep: (attempt: number, guidance?: string) => Promise<DraftAnswer>
  ): Promise<FinalAnswerResult> {
    let currentGuidance: string | undefined;
    let lastDraft: DraftAnswer = { text: "" };
    let lastValidation: ActionValidationResult | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      // 1. Run agent turn step (with repair guidance if attempt > 1)
      lastDraft = await agentStep(attempt, currentGuidance);

      // 2. Validate draft with ActionValidator
      lastValidation = await this.validator.validate(requested, lastDraft, attempt);

      // 3. If validation satisfied, return immediately
      if (lastValidation.passed) {
        return {
          success: true,
          attempts: attempt,
          answerText: lastDraft.text,
          degradedConfidence: false,
          validationHistory: this.validator.history,
        };
      }

      // 4. If not satisfied and attempts remain, set guidance for next attempt
      if (attempt < this.maxAttempts) {
        currentGuidance = lastValidation.repairGuidance;
      }
    }

    // 5. Exceeded maxAttempts: Bounded stop with degraded confidence notice
    const missing = lastValidation?.missingEntities || [];
    const missingNotice =
      missing.length > 0 ? ` Missing coverage for: [${missing.join(", ")}].` : "";
    const degradedNotice = `\n\n⚠️ [Partial Answer / Degraded Confidence]: Maximum validation attempts (${this.maxAttempts}) reached.${missingNotice} Full findings logged in PostgreSQL.`;

    return {
      success: false,
      attempts: this.maxAttempts,
      answerText: lastDraft.text + degradedNotice,
      degradedConfidence: true,
      degradedNotice,
      validationHistory: this.validator.history,
    };
  }
}
