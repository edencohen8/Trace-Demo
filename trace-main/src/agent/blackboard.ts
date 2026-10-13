/**
 * Investigation Blackboard & Dynamic Working State
 * 
 * Implements CTR-04 §4 InvestigationBlackboardState.
 * Maintains verified facts, living hypotheses, open leads, and exhausted sources.
 * Emits state updates for Lane 5 UI real-time visualization.
 */

export type HypothesisStatus = 'PROPOSED' | 'SUPPORTED' | 'REFUTED' | 'DISCARDED';

export interface EstablishedFact {
  factId: string;
  claim: string;
  badge: string;
  source: string;
  verifiedAt: string;
}

export interface WorkingHypothesis {
  hypothesisId: string;
  description: string;
  status: HypothesisStatus;
  supportingEvidence: string[];
  refutingEvidence: string[];
}

export interface InvestigationBlackboardState {
  investigationId: string;
  goal: string;
  establishedFacts: EstablishedFact[];
  workingHypotheses: WorkingHypothesis[];
  openLeads: string[];
  exhaustedSources: string[];
  iterationCount: number;
}

export class InvestigationBlackboard {
  private readonly investigationId: string;
  private readonly goal: string;
  private readonly establishedFacts: EstablishedFact[] = [];
  private readonly workingHypotheses: Map<string, WorkingHypothesis> = new Map();
  private readonly openLeads: Set<string> = new Set();
  private readonly exhaustedSources: Set<string> = new Set();
  private iterationCount = 0;
  private readonly listeners: Array<(state: InvestigationBlackboardState) => void> = [];

  constructor(investigationId: string, goal: string) {
    this.investigationId = investigationId;
    this.goal = goal;
  }

  public getState(): InvestigationBlackboardState {
    return {
      investigationId: this.investigationId,
      goal: this.goal,
      establishedFacts: [...this.establishedFacts],
      workingHypotheses: Array.from(this.workingHypotheses.values()),
      openLeads: Array.from(this.openLeads),
      exhaustedSources: Array.from(this.exhaustedSources),
      iterationCount: this.iterationCount,
    };
  }

  public addFact(claim: string, badge: string, source: string): EstablishedFact {
    const factId = `FACT-${String(this.establishedFacts.length + 1).padStart(2, '0')}`;
    const fact: EstablishedFact = {
      factId,
      claim,
      badge,
      source,
      verifiedAt: new Date().toISOString(),
    };
    this.establishedFacts.push(fact);
    this.notify();
    return fact;
  }

  public proposeHypothesis(id: string, description: string): WorkingHypothesis {
    const existing = this.workingHypotheses.get(id);
    if (existing) {
      existing.description = description;
      this.notify();
      return existing;
    }
    const hyp: WorkingHypothesis = {
      hypothesisId: id,
      description,
      status: 'PROPOSED',
      supportingEvidence: [],
      refutingEvidence: [],
    };
    this.workingHypotheses.set(id, hyp);
    this.notify();
    return hyp;
  }

  public updateHypothesis(
    id: string,
    status: HypothesisStatus,
    evidenceBadge?: string
  ): WorkingHypothesis {
    let hyp = this.workingHypotheses.get(id);
    if (!hyp) {
      hyp = {
        hypothesisId: id,
        description: `Hypothesis ${id}`,
        status,
        supportingEvidence: [],
        refutingEvidence: [],
      };
      this.workingHypotheses.set(id, hyp);
    }

    hyp.status = status;
    if (evidenceBadge) {
      if (status === 'SUPPORTED' && !hyp.supportingEvidence.includes(evidenceBadge)) {
        hyp.supportingEvidence.push(evidenceBadge);
      } else if (status === 'REFUTED' && !hyp.refutingEvidence.includes(evidenceBadge)) {
        hyp.refutingEvidence.push(evidenceBadge);
      }
    }

    this.notify();
    return hyp;
  }

  public addLead(lead: string): void {
    if (!this.openLeads.has(lead)) {
      this.openLeads.add(lead);
      this.notify();
    }
  }

  public removeLead(lead: string): void {
    if (this.openLeads.delete(lead)) {
      this.notify();
    }
  }

  public markSourceExhausted(source: string): void {
    if (!this.exhaustedSources.has(source)) {
      this.exhaustedSources.add(source);
      this.notify();
    }
  }

  public incrementIteration(): number {
    this.iterationCount += 1;
    this.notify();
    return this.iterationCount;
  }

  /**
   * Evaluates if baseline empirical facts are sufficient to ground hypotheses.
   * Requires at least one verified fact with evidence citation.
   */
  public hasSufficientFacts(): boolean {
    return this.establishedFacts.length > 0;
  }

  /**
   * Generates a compact prompt summary (< 250 tokens) for the agent.
   */
  public getSummaryForPrompt(): string {
    const lines: string[] = [
      `=== CURRENT INVESTIGATION BLACKBOARD (Iteration ${this.iterationCount}) ===`,
      `Goal: ${this.goal}`,
      `Established Facts (${this.establishedFacts.length}):`,
    ];

    if (this.establishedFacts.length === 0) {
      lines.push('  (No baseline facts verified yet - perform exploratory fact-finding first)');
    } else {
      for (const f of this.establishedFacts) {
        lines.push(`  - [${f.factId}] ${f.claim} [${f.badge}] (source: ${f.source})`);
      }
    }

    lines.push(`Working Hypotheses (${this.workingHypotheses.size}):`);
    if (this.workingHypotheses.size === 0) {
      lines.push('  (None formulated yet)');
    } else {
      for (const h of this.workingHypotheses.values()) {
        const supp = h.supportingEvidence.length ? ` (Supported by: ${h.supportingEvidence.join(', ')})` : '';
        const ref = h.refutingEvidence.length ? ` (Refuted by: ${h.refutingEvidence.join(', ')})` : '';
        lines.push(`  - [${h.hypothesisId}] ${h.status}: ${h.description}${supp}${ref}`);
      }
    }

    lines.push(`Open Leads to Investigate (${this.openLeads.size}):`);
    if (this.openLeads.size === 0) {
      lines.push('  (None)');
    } else {
      for (const lead of this.openLeads) {
        lines.push(`  - ${lead}`);
      }
    }

    lines.push(`Exhausted Sources / Dead Ends (${this.exhaustedSources.size}):`);
    if (this.exhaustedSources.size === 0) {
      lines.push('  (None)');
    } else {
      for (const src of this.exhaustedSources) {
        lines.push(`  - ${src}`);
      }
    }

    lines.push('====================================================');
    return lines.join('\n');
  }

  public subscribe(listener: (state: InvestigationBlackboardState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in blackboard state listener:', err);
      }
    }
  }
}
