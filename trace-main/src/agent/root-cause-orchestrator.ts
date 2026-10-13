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

export interface CaseOverview {
  caseId: string;
  title: string;
  availableFeeds: string[];
  timeWindow: { startUtc: string; endUtc: string };
  anomalyHint: string;
  recorderDrops: number;
  missingFeeds?: string[];
}

export interface RootCauseOrchestratorOptions {
  responseInstructions?: string;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  validateFindings?: (findings: Finding[]) => Promise<void>;
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
    description: "Data tools the worker may use: 'analyze_fields', 'search_text', 'query_events', 'get_evidence'",
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
  answer: Type.Optional(Type.String({ description: 'Concise user-facing answer in the requested language, with source citations and uncertainty. Keep detailed reasoning in findings.' })),
  findings: Type.Array(FindingSchema),
  rationale: Type.String(),
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
        if (params.findings.some((finding) => finding.investigation_id !== this.investigationId)) throw new Error('Finding case mismatch');
        await this.options.validateFindings?.(params.findings);
        this.finalFindings = params.findings;
        this.finalAnswer = params.answer;
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
When calling submit_findings, put the concise final reply in answer. Cite source badges in that reply.
Keep supporting detail in findings. Do not repeat all findings and their rationales in answer.

=== YOUR WORKING MEMORY (INVESTIGATION BLACKBOARD) ===
${this.blackboard.getSummaryForPrompt()}

=== STRICT RULES FOR THE MAIN INVESTIGATOR ===
1. You have EXACTLY 4 tools: get_case_overview, delegate_investigation, update_blackboard, submit_findings.
2. NEVER execute direct SQL, DuckDB queries, or raw log file dumps directly; all data exploration MUST be delegated to isolated worker sub-agents via delegate_investigation.
3. Iterative Fact-Finding: If you do not have sufficient baseline empirical facts, DO NOT guess hypotheses. Call get_case_overview and delegate an initial scan.
4. Living Hypotheses: Propose at least two competing hypotheses (H1 vs H2) using update_blackboard only after observing baseline symptoms.
5. Dynamic Re-evaluation: If an observation disproves a hypothesis, update the blackboard and pursue open leads.
6. Stopping / Abstention Rule: Conclude via submit_findings with dual-source citations (e.g. sniffer.csv:row and log:line). If required feeds were filtered out of capture (e.g. case_004), submit an ABSTENTION finding.`;
  }
}
