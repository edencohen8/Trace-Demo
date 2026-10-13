/**
 * TRACE Lane 3: Types & Schemas
 * Implements CTR-04 (Findings & Session State) and CTR-05 (Evidence Locators).
 * Strict TypeScript definition.
 */

import { Type, type Static } from "typebox";

/**
 * Finding status enum values
 */
export const FindingStatus = {
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  CONTRADICTION: "CONTRADICTION",
  ABSTENTION: "ABSTENTION",
} as const;

export type FindingStatusType = (typeof FindingStatus)[keyof typeof FindingStatus];

/**
 * TypeBox Schema for Source Locator (CTR-05)
 */
export const SourceLocatorSchema = Type.Object({
  source_family: Type.Union([
    Type.Literal("sniffer"),
    Type.Literal("component_log"),
    Type.Literal("operator_diary"),
    Type.Literal("manifest"),
  ]),
  source_file: Type.String(),
  row: Type.Optional(Type.Integer({ minimum: 1 })),
  line: Type.Optional(Type.Integer({ minimum: 1 })),
  sheet: Type.Optional(Type.String()),
});

export type SourceLocator = Static<typeof SourceLocatorSchema>;

/**
 * TypeBox Schema for Evidence Citation (CTR-04 & CTR-05)
 */
export const EvidenceCitationSchema = Type.Object({
  badge: Type.String(),
  source_file: Type.String(),
  row: Type.Optional(Type.Integer()),
  line: Type.Optional(Type.Integer()),
  kind: Type.Optional(Type.Union([Type.Literal("source_locator"), Type.Literal("manifest")])),
});

export type EvidenceCitation = Static<typeof EvidenceCitationSchema>;

/**
 * TypeBox Schema for Structured Finding (CTR-04)
 */
export const FindingSchema = Type.Object({
  finding_id: Type.String(),
  investigation_id: Type.String(),
  status: Type.Union([
    Type.Literal(FindingStatus.POSITIVE),
    Type.Literal(FindingStatus.NEGATIVE),
    Type.Literal(FindingStatus.CONTRADICTION),
    Type.Literal(FindingStatus.ABSTENTION),
  ]),
  title: Type.String(),
  claim: Type.String(),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  rationale: Type.String(),
  evidence_citations: Type.Array(EvidenceCitationSchema),
  contradictions: Type.Optional(Type.Array(Type.Any())),
  missing_coverage_flag: Type.Boolean({ default: false }),
});

export type Finding = Static<typeof FindingSchema>;

/**
 * TypeBox Schema for Delegated Investigation Task (Sub-task 3.2, 3.3)
 */
export const DelegatedInvestigationTaskSchema = Type.Object({
  task_id: Type.String(),
  investigation_id: Type.String(),
  question: Type.String(),
  hypothesis: Type.String(),
  time_window: Type.Optional(
    Type.Object({
      start_utc: Type.Optional(Type.String()),
      end_utc: Type.Optional(Type.String()),
    })
  ),
  budget: Type.Object({
    max_tool_calls: Type.Integer({ default: 8 }),
    max_rows: Type.Integer({ default: 50 }),
    max_tokens: Type.Integer({ default: 4000 }),
  }),
  allowed_tools: Type.Array(Type.String()),
});

export type DelegatedInvestigationTask = Static<typeof DelegatedInvestigationTaskSchema>;

/**
 * TypeBox Schema for SubAgentResult (CTR-04 & Sub-task 3.3, 3.4)
 */
export const SubAgentResultSchema = Type.Object({
  task_id: Type.String(),
  investigation_id: Type.String(),
  status: Type.Union([
    Type.Literal("completed"),
    Type.Literal("budget_exhausted"),
    Type.Literal("error"),
    Type.Literal("inconclusive"),
  ]),
  summary: Type.String(),
  findings: Type.Array(FindingSchema),
  contradictions: Type.Array(Type.Any()),
  negative_findings: Type.Array(Type.Any()),
  rows_inspected: Type.Integer({ default: 0 }),
  tool_calls_count: Type.Integer({ default: 0 }),
  error_message: Type.Optional(Type.String()),
});

export type SubAgentResult = Static<typeof SubAgentResultSchema>;
