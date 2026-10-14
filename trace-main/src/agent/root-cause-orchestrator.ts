/**
 * Root Cause Orchestrator & Dynamic Main Investigator Loop
 * 
 * Implements the Main Investigator orchestrator running on top of Pi Agent Core.
 * Maintains an active InvestigationBlackboard (CTR-04).
 * Strictly given 4 coordinator tools: get_case_overview, delegate_investigation,
 * update_blackboard, and submit_findings.
 * Never executes direct SQL or queries.
 */

import { Model, Type, Static } from "@earendil-works/pi-ai";
import { AgentTool, StreamFn, type AgentEvent } from "@earendil-works/pi-agent-core";
import { Finding, FindingSchema } from "./types.js";
import { createInvestigationAgent } from "./harness.js";
import { InvestigationBlackboard, InvestigationBlackboardState, HypothesisStatus } from "./blackboard.js";
import { DelegationController } from "./delegation-controller.js";
import { SkillRegistry } from "./skills/registry.js";
import { EvidenceResolver } from './evidence-resolver.ts';

export interface CaseOverview {
  caseId: string;
  title: string;
  availableFeeds: string[];
  timeWindow: { startUtc: string; endUtc: string };
  anomalyHint: string;
  recorderDrops: number;
  missingFeeds?: string[];
  catalog?: unknown;
}

export interface RootCauseOrchestratorOptions {
  responseInstructions?: string;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  validateFindings?: (findings: Finding[], answer?: string) => Promise<void>;
  investigationId: string;
  goal: string;
  model: Model<any>;
  streamFn: StreamFn;
  delegationController: DelegationController;
  skillRegistry: SkillRegistry;
  caseOverviewProvider: (caseId: string) => Promise<CaseOverview>;
  maxTurns?: number; // Safety cutoff (default 15)
}

// =========================================================================
// Tool Parameter Schemas
// =========================================================================

const GetCaseOverviewParamsSchema = Type.Object({
  case_id: Type.String({ description: "The investigation case ID (e.g. 'case_002')" }),
});
type GetCaseOverviewParams = Static<typeof GetCaseOverviewParamsSchema>;

const DelegateInvestigationParamsSchema = Type.Object({
  task_id: Type.String({ description: "Unique task identifier (e.g. 'task_pos_jump')" }),
  question: Type.String({ description: "Specific testable question for the worker sub-agent" }),
  hypothesis: Type.String({ description: "The hypothesis being tested or explored" }),
  time_window: Type.Optional(
    Type.Object({
      start_utc: Type.Optional(Type.String()),
      end_utc: Type.Optional(Type.String()),
    })
  ),
  allowed_tools: Type.Array(Type.String(), {
    description: "Data tools the worker may use: get_case_overview (catalog/coverage), analyze_fields, search_text, query_events, get_evidence, trace_request (cross-source request ID), reconstruct_state (effective/display at time), inspect_region (report geometry, detection counts and coverage).",
  }),
  budget: Type.Optional(
    Type.Object({
      max_tool_calls: Type.Integer({ default: 8 }),
      max_rows: Type.Integer({ default: 50 }),
      max_tokens: Type.Integer({ default: 4000 }),
    })
  ),
});
type DelegateInvestigationParams = Static<typeof DelegateInvestigationParamsSchema>;

const UpdateBlackboardParamsSchema = Type.Object({
  action: Type.Union([
    Type.Literal("add_fact"),
    Type.Literal("propose_hypothesis"),
    Type.Literal("update_hypothesis"),
    Type.Literal("add_lead"),
    Type.Literal("mark_exhausted"),
  ]),
  fact: Type.Optional(
    Type.Object({
      claim: Type.String(),
      badge: Type.String({ description: "CTR-05 badge syntax e.g. [sniffer.csv:L1420]" }),
      source: Type.String(),
    })
  ),
  hypothesis: Type.Optional(
    Type.Object({
      id: Type.String(),
      description: Type.Optional(Type.String()),
      status: Type.Optional(
        Type.Union([
          Type.Literal("PROPOSED"),
          Type.Literal("SUPPORTED"),
          Type.Literal("REFUTED"),
          Type.Literal("DISCARDED"),
        ])
      ),
      evidence_badge: Type.Optional(Type.String()),
    })
  ),
  lead: Type.Optional(Type.String()),
  exhausted_source: Type.Optional(Type.String()),
});
type UpdateBlackboardParams = Static<typeof UpdateBlackboardParamsSchema>;

const SubmitFindingsParamsSchema = Type.Object({
  summary_finding_ids: Type.Optional(Type.Array(Type.String(), { minItems: 1, maxItems: 4, description: 'Preferred answer: select 1–4 finding IDs in user-facing order. Their concise claims and their own evidence citations form the answer. Put the symptom explanation first, then cause and comparison. This avoids rewriting claims with mismatched citations.' })),
  answer: Type.Optional(Type.String({ description: 'Legacy alternative when summary_finding_ids is absent: concise answer with exact source citations next to each claim.' })),
  findings: Type.Optional(Type.Array(FindingSchema, { description: 'Full findings for the first submission. On a review retry, use corrections to keep other findings unchanged.' })),
  corrections: Type.Optional(Type.Array(Type.Object({
    finding_id: Type.String(), claim: Type.Optional(Type.String()), rationale: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()), evidence_citations: Type.Optional(FindingSchema.properties.evidence_citations),
    status: Type.Optional(FindingSchema.properties.status), confidence: Type.Optional(FindingSchema.properties.confidence),
    missing_coverage_flag: Type.Optional(Type.Boolean()),
  }), { description: 'After a rejected submission, update only the named finding fields. All omitted fields and other findings remain unchanged. Evidence lists replace that finding’s list, so retain its existing relevant sources.' })),
  rationale: Type.Optional(Type.String()),
});
type SubmitFindingsParams = Static<typeof SubmitFindingsParamsSchema>;

// =========================================================================
// Main Orchestrator Class
// =========================================================================

export class RootCauseOrchestrator {
  private options: RootCauseOrchestratorOptions;
  private readonly investigationId: string;
  private readonly goal: string;
  private readonly model: Model<any>;
  private readonly streamFn: StreamFn;
  private readonly delegationController: DelegationController;
  private readonly skillRegistry: SkillRegistry;
  private readonly caseOverviewProvider: (caseId: string) => Promise<CaseOverview>;
  private readonly blackboard: InvestigationBlackboard;
  private readonly maxTurns: number;

  private finalFindings: Finding[] = [];
  private finalAnswer?: string;
  private candidateFindings: Finding[] = [];
  private candidateSummary?: string[];
  private candidateAnswer?: string;
  private isConcluded = false;

  constructor(options: RootCauseOrchestratorOptions) {
    this.options = options;
    this.investigationId = options.investigationId;
    this.goal = options.goal;
    this.model = options.model;
    this.streamFn = options.streamFn;
    this.delegationController = options.delegationController;
    this.skillRegistry = options.skillRegistry;
    this.caseOverviewProvider = options.caseOverviewProvider;
    this.blackboard = new InvestigationBlackboard(options.investigationId, options.goal);
    this.maxTurns = options.maxTurns ?? 15;
  }

  public getBlackboard(): InvestigationBlackboard {
    return this.blackboard;
  }

  public getFinalFindings(): Finding[] {
    return this.finalFindings;
  }

  public isInvestigationConcluded(): boolean {
    return this.isConcluded;
  }

  /**
   * Executes the full root-cause investigation cycle.
   */
  public async run(): Promise<{
    blackboardState: InvestigationBlackboardState;
    findings: Finding[];
    answer?: string;
    concluded: boolean;
  }> {
    // 1. Load the root-cause-investigation skill playbook
    const skillContext = await this.skillRegistry.loadSkill("root-cause-investigation");

    // 2. Build the 4 Coordinator Tools
    const tools: AgentTool<any>[] = [
      this.createGetCaseOverviewTool(),
      this.createDelegateInvestigationTool(),
      this.createUpdateBlackboardTool(),
      this.createSubmitFindingsTool(),
    ];

    // 3. Instantiate Main Investigator Pi Agent
    const agent = createInvestigationAgent({
      signal: this.options.signal,
      maxTurns: this.maxTurns,
      onEvent: this.options.onEvent,
      sessionId: `orchestrator-${this.investigationId}-${Date.now()}`,
      model: this.model,
      streamFn: this.streamFn,
      systemPrompt: this.buildOrchestratorPrompt(skillContext.instructions),
      tools,
      beforeToolCall: async () => {
        this.options.signal?.throwIfAborted();
        this.blackboard.incrementIteration();
        return undefined;
      },
      afterToolCall: async () => this.isConcluded ? { terminate: true } : undefined,
    });

    // 4. Initial prompt triggering the forensic investigation
    const initialPrompt = `Begin root-cause investigation for Case ${this.investigationId}.
Investigation Goal: ${this.goal}

Operational Protocol:
1. Fact-Finding First: Call get_case_overview to inspect available feeds and anomaly window. If facts are thin, delegate an initial scan before hypothesizing.
2. Grounded Competing Hypotheses: Propose at least two candidate causes (H1 vs H2) based on the observed symptoms using update_blackboard.
3. Targeted Delegation: Dispatch worker sub-agents with delegate_investigation to test each hypothesis.
4. Dynamic Re-evaluation & Backtracking: If evidence refutes a hypothesis, update the blackboard and pursue open leads.
5. Conclude: Once the root cause is corroborated with dual-source citations (or if feeds are exhausted), conclude with submit_findings.`;

    await agent.prompt(initialPrompt);

    return {
      blackboardState: this.blackboard.getState(),
      findings: this.finalFindings,
      answer: this.finalAnswer,
      concluded: this.isConcluded,
    };
  }

  private createGetCaseOverviewTool(): AgentTool<typeof GetCaseOverviewParamsSchema> {
    return {
      name: "get_case_overview",
      label: "Get Case Overview",
      description: "Returns case orientation metadata: available data feeds, capture window, drop counters, and anomaly hints.",
      parameters: GetCaseOverviewParamsSchema,
      execute: async (_callId: string, params: GetCaseOverviewParams) => {
        if (params.case_id !== this.investigationId) throw new Error('Cross-case access denied');
        const overview = await this.caseOverviewProvider(params.case_id);
        const result = {
          case_id: overview.caseId,
          title: overview.title,
          available_feeds: overview.availableFeeds,
          time_window: overview.timeWindow,
          anomaly_hint: overview.anomalyHint,
          recorder_drops: overview.recorderDrops,
          missing_feeds: overview.missingFeeds ?? [],
          catalog: overview.catalog,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          details: result,
        };
      },
    };
  }

  private createDelegateInvestigationTool(): AgentTool<typeof DelegateInvestigationParamsSchema> {
    return {
      name: "delegate_investigation",
      label: "Delegate Investigation",
      description: "Dispatches a focused, isolated worker sub-agent to query telemetry (DuckDB) or search logs (PostgreSQL) within a specific time window.",
      parameters: DelegateInvestigationParamsSchema,
      execute: async (_callId: string, params: DelegateInvestigationParams) => {
        const result = await this.delegationController.executeTask({
          task_id: params.task_id,
          investigation_id: this.investigationId,
          question: params.question,
          hypothesis: params.hypothesis,
          time_window: params.time_window,
          allowed_tools: params.allowed_tools,
          budget: { max_tool_calls: Math.min(8, Math.max(1, params.budget?.max_tool_calls ?? 6)),
            max_rows: Math.min(50, Math.max(1, params.budget?.max_rows ?? 30)),
            max_tokens: Math.min(4000, Math.max(1, params.budget?.max_tokens ?? 3000)) },
        });

        const details = {
          task_id: result.task_id,
          status: result.status,
          summary: result.summary,
          findings: result.findings,
          tool_calls_count: result.tool_calls_count,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(details) }],
          details,
        };
      },
    };
  }

  private createUpdateBlackboardTool(): AgentTool<typeof UpdateBlackboardParamsSchema> {
    return {
      name: "update_blackboard",
      label: "Update Blackboard",
      description: "Updates the shared investigation working memory: record a verified empirical fact, propose or update a hypothesis status, add/remove a lead, or record an exhausted source.",
      parameters: UpdateBlackboardParamsSchema,
      execute: async (_callId: string, params: UpdateBlackboardParams) => {
        let details = { success: false, message: "Invalid update_blackboard parameters" };

        switch (params.action) {
          case "add_fact":
            if (params.fact) {
              const added = this.blackboard.addFact(
                params.fact.claim,
                params.fact.badge,
                params.fact.source
              );
              details = { success: true, message: `Fact recorded: ${added.factId}` };
            }
            break;
          case "propose_hypothesis":
            if (params.hypothesis && params.hypothesis.description) {
              const hyp = this.blackboard.proposeHypothesis(
                params.hypothesis.id,
                params.hypothesis.description
              );
              details = { success: true, message: `Hypothesis ${hyp.hypothesisId} proposed` };
            }
            break;
          case "update_hypothesis":
            if (params.hypothesis && params.hypothesis.status) {
              const updated = this.blackboard.updateHypothesis(
                params.hypothesis.id,
                params.hypothesis.status as HypothesisStatus,
                params.hypothesis.evidence_badge
              );
              details = { success: true, message: `Hypothesis ${updated.hypothesisId} updated to ${updated.status}` };
            }
            break;
          case "add_lead":
            if (params.lead) {
              this.blackboard.addLead(params.lead);
              details = { success: true, message: `Lead added: ${params.lead}` };
            }
            break;
          case "mark_exhausted":
            if (params.exhausted_source) {
              this.blackboard.markSourceExhausted(params.exhausted_source);
              details = { success: true, message: `Source marked exhausted: ${params.exhausted_source}` };
            }
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(details) }],
          details,
        };
      },
    };
  }

  private createSubmitFindingsTool(): AgentTool<typeof SubmitFindingsParamsSchema> {
    return {
      name: "submit_findings",
      label: "Submit Findings",
      description: "Concludes the investigation and submits final structured findings (CTR-04). Call this when root cause is corroborated or archive coverage is exhausted.",
      parameters: SubmitFindingsParamsSchema,
      execute: async (_callId: string, params: SubmitFindingsParams) => {
        const incoming = params.findings ?? this.candidateFindings;
        if (!incoming.length) throw new Error('First submit findings before sending corrections');
        if (incoming.some((finding) => finding.investigation_id !== this.investigationId)) throw new Error('Finding case mismatch');
        if (new Set(incoming.map((f) => f.finding_id)).size !== incoming.length) throw new Error('Finding IDs must be unique');
        const updated = incoming.map((finding) => ({ ...finding, evidence_citations: finding.evidence_citations.map((citation) => ({ ...citation })) }));
        for (const correction of params.corrections ?? []) {
          const index = updated.findIndex((finding) => finding.finding_id === correction.finding_id);
          if (index < 0) throw new Error(`Unknown correction finding: ${correction.finding_id}`);
          updated[index] = { ...updated[index]!, ...correction };
        }
        this.candidateFindings = updated;
        if (params.summary_finding_ids) this.candidateSummary = params.summary_finding_ids;
        if (params.answer !== undefined) { this.candidateAnswer = params.answer; if (!params.summary_finding_ids) this.candidateSummary = undefined; }
        const selected = this.candidateSummary?.map((id) => {
          const finding = updated.find((finding) => finding.finding_id === id);
          if (!finding) throw new Error(`Unknown summary finding: ${id}`);
          return finding;
        });
        const answer = selected?.length ? selected.map((finding) => `${finding.claim} ${[...new Set(finding.evidence_citations.map((citation) => EvidenceResolver.parseReference(citation.badge).badge))].filter((badge) => !finding.claim.includes(badge)).join(' ')}`).join('\n\n') : this.candidateAnswer;
        if (!answer?.trim()) throw new Error('Submit summary_finding_ids or a cited answer with the findings');
        try { await this.options.validateFindings?.(updated, answer); }
        catch (error) { throw new Error(`${error instanceof Error ? error.message : String(error)} Draft retained. Use submit_findings corrections to change only the affected finding fields. Keep the other findings and their citations.`); }
        this.finalFindings = updated;
        this.finalAnswer = answer;
        this.isConcluded = true;
        const details = {
          concluded: true,
          findings_count: this.finalFindings.length,
          message: "Investigation successfully concluded and structured findings submitted.",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(details) }],
          details,
        };
      },
    };
  }

  private buildOrchestratorPrompt(skillPlaybook: string): string {
    return `You are the TRACE Main Forensic Investigator & Orchestrator for incident investigation.

${skillPlaybook}

${this.options.responseInstructions ?? ''}
When calling submit_findings, select summary_finding_ids in user-facing order. The controller renders their claims with their own source citations. Omit the legacy answer field.
Write the selected claims as concise Hebrew paragraphs that directly answer the user. Put the symptom explanation first, followed by the cause and recovery comparison if relevant. Use 2–4 selected findings, up to 50 words per claim. Give the cause and misleading operator display separate findings when both need explanation. Keep additional detail in each rationale. Target 80–140 words total.
The selected claims must stand alone: include each material causal link there, not only in rationale. When software compatibility explains a failure, name the relevant component software versions and request format. When display and effective state disagree, explain the display update trigger and whether the later processing result reached it. Preserve supported uncertainty. Distinguish track-record counts from distinct track identities.
Selected claims are displayed directly. Use local +03:00 clock times in these claims, and say once that times are local. Keep source UTC timestamps in the rationale. Explain technical terms in plain Hebrew. If software compatibility is the cause, distinguish each component's software version from the request schema version.
Use evidence_citations for the actual premises of each claim, including report, coverage and catalog definitions when needed. Every claimed step needs its source. A causal claim may need more than two sources. The reviewer checks claims against those references before the summary is rendered.
Cite the returned calculation handle for counts, geometry and whole-window checks. Use kind=calculation and omit source_file for those handles. A calculation contains its own input records and coverage; do not replace it with a guessed raw row. Event claims still cite the matching original event.
Keep time claims within the checked intervals. An incident-window calculation and a later applied-state snapshot can establish the incident and recovery comparison without claiming uninterrupted state throughout the time between them. Do not add an unneeded duration that would require a new continuity check. For a recovery request, use its effective-state transition when trace_request returns it; do not substitute a later sample and call the transition unknown.
If review rejects a submission, the draft is retained. Use submit_findings corrections to change only the affected finding fields, instead of rewriting all findings. Retrieve additional evidence only if the review identifies an unresolved factual gap.

=== YOUR WORKING MEMORY (INVESTIGATION BLACKBOARD) ===
${this.blackboard.getSummaryForPrompt()}

=== STRICT RULES FOR THE MAIN INVESTIGATOR ===
1. You have EXACTLY 4 tools: get_case_overview, delegate_investigation, update_blackboard, submit_findings.
2. NEVER execute direct SQL, DuckDB queries, or raw log file dumps directly; all data exploration MUST be delegated to isolated worker sub-agents via delegate_investigation.
3. Iterative Fact-Finding: If you do not have sufficient baseline empirical facts, DO NOT guess hypotheses. Call get_case_overview and delegate an initial scan.
4. Living Hypotheses: Propose at least two competing hypotheses (H1 vs H2) using update_blackboard only after observing baseline symptoms.
5. Dynamic Re-evaluation: If an observation disproves a hypothesis, update the blackboard and pursue open leads.
6. Stopping / Abstention Rule: Conclude via submit_findings with cross-source citations. If required feeds are missing, qualify the affected finding as ABSTENTION. Resolve available evidence for material open questions before concluding.`;
  }
}
