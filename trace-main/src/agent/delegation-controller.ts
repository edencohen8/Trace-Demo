/**
 * Delegation Controller & Sub-Agent Sandbox
 * 
 * Manages spawning, sandboxing, and execution of isolated Pi worker sub-agents.
 * Enforces per-task tool allowlists, row/tool call limits, and overall turn delegation limits.
 * Compresses worker findings before returning to the Main Investigator.
 */

import { Model } from "@earendil-works/pi-ai";
import { AgentTool, StreamFn, type AgentEvent } from "@earendil-works/pi-agent-core";
import { DelegatedInvestigationTask, SubAgentResult, Finding } from "./types.js";
import { createInvestigationAgent, InvestigationAgentController } from "./harness.js";
import { EvidenceResolver } from "./evidence-resolver.js";
import { evidenceBadges } from '../demo/evidence-badges.ts';

export interface DelegationControllerOptions {
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  model: Model<any>;
  streamFn: StreamFn;
  availableWorkerTools: AgentTool<any>[];
  evidenceResolver?: EvidenceResolver;
  maxDelegationsPerInvestigation?: number; // Default: 5
}

export class DelegationController {
  private options: DelegationControllerOptions;
  private readonly model: Model<any>;
  private readonly streamFn: StreamFn;
  private readonly availableWorkerTools: Map<string, AgentTool<any>> = new Map();
  private readonly evidenceResolver?: EvidenceResolver;
  private readonly maxDelegations: number;
  private delegationCount = 0;
  private readonly activeSubAgents: InvestigationAgentController[] = [];

  // Strictly prohibited tools for worker sub-agents (prevent recursive delegation)
  private readonly FORBIDDEN_WORKER_TOOLS = new Set([
    "delegate_investigation",
    "submit_findings",
    "update_blackboard",
  ]);

  constructor(options: DelegationControllerOptions) {
    this.options = options;
    this.model = options.model;
    this.streamFn = options.streamFn;
    this.evidenceResolver = options.evidenceResolver;
    this.maxDelegations = options.maxDelegationsPerInvestigation ?? 5;

    for (const tool of options.availableWorkerTools) {
      if (!this.FORBIDDEN_WORKER_TOOLS.has(tool.name)) {
        this.availableWorkerTools.set(tool.name, tool);
      }
    }
  }

  public getDelegationCount(): number {
    return this.delegationCount;
  }

  public resetDelegationCount(): void {
    this.delegationCount = 0;
    this.activeSubAgents.length = 0;
  }

  /**
   * Dispatches a focused task to an isolated worker sub-agent.
   */
  public async executeTask(
    task: DelegatedInvestigationTask
  ): Promise<SubAgentResult> {
    // 1. Enforce overall investigation delegation budget
    if (this.delegationCount >= this.maxDelegations) {
      return {
        task_id: task.task_id,
        investigation_id: task.investigation_id,
        status: "budget_exhausted",
        summary: `Delegation budget exceeded: maximum of ${this.maxDelegations} delegations allowed per investigation turn.`,
        findings: [],
        contradictions: [],
        negative_findings: [],
        rows_inspected: 0,
        tool_calls_count: 0,
        error_message: "Max delegation budget reached",
      };
    }

    this.delegationCount += 1;

    // 2. Resolve worker tool allowlist (strictly stripping prohibited tools)
    const workerTools: AgentTool<any>[] = [];
    for (const toolName of task.allowed_tools) {
      if (this.FORBIDDEN_WORKER_TOOLS.has(toolName)) {
        continue;
      }
      const tool = this.availableWorkerTools.get(toolName);
      if (tool) {
        workerTools.push(tool);
      }
    }

    // 3. Track metrics during execution
    let toolCallsCount = 0;
    let rowsInspected = 0;
    const maxToolCalls = Math.min(8, Math.max(1, task.budget?.max_tool_calls || 8));
    const maxRows = Math.min(50, Math.max(1, task.budget?.max_rows || 50));

    // Wrap worker tools to enforce row limits and count calls
    const instrumentedTools: AgentTool<any>[] = workerTools.map((t) => ({
      name: t.name,
      label: t.label || t.name,
      description: t.description,
      parameters: t.parameters,
      execute: async (toolCallId, params, signal, onUpdate) => {
        this.options.signal?.throwIfAborted();
        if (toolCallsCount >= maxToolCalls) {
          throw new Error(`Worker tool call limit reached (${maxToolCalls})`);
        }
        toolCallsCount += 1;

        const values = params as Record<string, unknown>;
        const boundedParams = { ...values, limit: Math.min(maxRows, typeof values.limit === 'number' ? values.limit : maxRows) };
        const rawResult = await t.execute(toolCallId, boundedParams, signal, onUpdate);

        // Track rows if returned in structured output
        if (
          rawResult &&
          typeof rawResult === "object" &&
          "details" in rawResult &&
          rawResult.details &&
          typeof rawResult.details === "object" &&
          "rows" in (rawResult.details as any) &&
          Array.isArray((rawResult.details as any).rows)
        ) {
          const rowCount = (rawResult.details as any).rows.length;
          rowsInspected += Math.min(rowCount, maxRows);
        }

        return rawResult;
      },
    }));

    // 4. Create isolated worker agent instance
    const workerAgent = createInvestigationAgent({
      signal: this.options.signal,
      maxTurns: maxToolCalls + 2,
      onEvent: this.options.onEvent,
      sessionId: `worker-${task.task_id}-${Date.now()}`,
      model: this.model,
      streamFn: this.streamFn,
      systemPrompt: this.buildWorkerSystemPrompt(task, maxToolCalls, maxRows),
      tools: instrumentedTools,
    });

    this.activeSubAgents.push(workerAgent);

    // 5. Execute worker agent prompt
    try {
      const prompt = `Investigate the following focused question:
Question: ${task.question}
Hypothesis to Test: ${task.hypothesis}
Time Window: ${task.time_window ? `${task.time_window.start_utc ?? "unbounded"} to ${task.time_window.end_utc ?? "unbounded"}` : "unbounded"}

Perform necessary tool queries, analyze the evidence, and summarize your empirical observations citing specific source locators (e.g. [sniffer.csv:L1420]).`;

      await workerAgent.prompt(prompt);

      const state = workerAgent.getState();
      const lastMessage = state.messages[state.messages.length - 1];
      const assistantText =
        lastMessage?.role === "assistant" && typeof lastMessage.content === "string"
          ? lastMessage.content
          : Array.isArray(lastMessage?.content)
          ? (lastMessage.content as any).map((c: any) => c.text ?? "").join(" ")
          : "";

      // Extract citations and findings from assistant response
      const extractedFindings: Finding[] = this.extractFindings(
        task,
        assistantText
      );

      return {
        task_id: task.task_id,
        investigation_id: task.investigation_id,
        status: toolCallsCount > maxToolCalls ? "budget_exhausted" : "completed",
        summary: assistantText || "Task completed with zero observations.",
        findings: extractedFindings,
        contradictions: [],
        negative_findings:
          assistantText.toLowerCase().includes("no evidence") ||
          assistantText.toLowerCase().includes("refuted") ||
          assistantText.toLowerCase().includes("0 drops")
            ? [{ observation: assistantText }]
            : [],
        rows_inspected: rowsInspected,
        tool_calls_count: toolCallsCount,
      };
    } catch (err: any) {
      return {
        task_id: task.task_id,
        investigation_id: task.investigation_id,
        status: err?.message?.includes("limit reached") ? "budget_exhausted" : "error",
        summary: `Worker task ended: ${err?.message ?? String(err)}`,
        findings: [],
        contradictions: [],
        negative_findings: [],
        rows_inspected: rowsInspected,
        tool_calls_count: toolCallsCount,
        error_message: err?.message ?? String(err),
      };
    }
  }

  private buildWorkerSystemPrompt(
    task: DelegatedInvestigationTask,
    maxCalls: number,
    maxRows: number
  ): string {
    return `You are a dedicated, isolated TRACE Worker Sub-Agent assigned to Task ${task.task_id}.
Investigation ID: ${task.investigation_id}

Objective:
Answer the specific query: "${task.question}"
Testing Hypothesis: "${task.hypothesis}"

Constraints:
1. Tool Call Budget: You may make at most ${maxCalls} tool calls.
2. Row Limit: You may inspect at most ${maxRows} rows per call.
3. Citations: Every factual observation MUST cite its exact returned source badge (e.g. [sniffer.csv:L1420]) or calculation_citation. Calculated claims use the calculation handle; individual events use original rows.
4. Zero Hallucination: If data shows no anomaly or is empty, report that fact explicitly (do not invent causes).
5. Ground Truth Isolation: You are strictly forbidden from referencing private_ground_truth.
6. Read get_case_overview for report badges, catalog and coverage. An operator report supplies context, not verified causality.
7. For a reported missing observation, inspect_region computes all spatial matches and state across the report window. This is a complete deterministic query, not a sample of the first rows. Use it for geometry and absence; do not infer either from a truncated page.
8. Use trace_request for each relevant request ID and reconstruct_state for effective/display state. Receipt is not application. Follow documented recovery when relevant to your task.
9. Report concise observations with the exact supporting citations. State what was checked, what is inferred, and what remains unknown. Preserve tool-computed results and coverage. Cite a returned calculation_citation for computed counts, geometry and continuous intervals; keep that exact handle in your summary. Return at most 250 words; avoid repeated source dumps. Preserve exact report bounds instead of rounding them into a different query region.`;
  }

  private extractFindings(
    task: DelegatedInvestigationTask,
    text: string
  ): Finding[] {
    const findings: Finding[] = [];
    // Match CTR-05 badge syntax e.g. [sniffer.csv:L1420] or [adapter.txt:L88]
    const badgeRegex = /\[([a-zA-Z0-9_\-./]+):(L|row|line)?(\d+)\]/g;
    const citations: any[] = [];
    let match: RegExpExecArray | null;

    while ((match = badgeRegex.exec(text)) !== null) {
      citations.push({
        badge: match[0],
        source_file: match[1],
        row: parseInt(match[3], 10),
        kind: "source_locator",
      });
    }
    for (const badge of evidenceBadges(text).filter((badge) => badge.startsWith('[calc:'))) citations.push({ badge, kind: 'calculation' });

    if (citations.length > 0) {
      const isRefuted =
        text.toLowerCase().includes("refuted") ||
        text.toLowerCase().includes("0 drops") ||
        text.toLowerCase().includes("no error");
      findings.push({
        finding_id: `F-${task.task_id}`,
        investigation_id: task.investigation_id,
        status: isRefuted ? "NEGATIVE" : "POSITIVE",
        title: `Finding for task ${task.task_id}: ${task.question.slice(0, 50)}`,
        claim: text.slice(0, 200),
        confidence: 0.9,
        rationale: text,
        evidence_citations: citations,
        contradictions: [],
        missing_coverage_flag: false,
      });
    }

    return findings;
  }
}
