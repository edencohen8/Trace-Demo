/**
 * TRACE Lane 3: Intent Router & RequestedAnswer Schema
 * Implements TRACE_ARCHITECTURE.md §7.0.3.
 * Strict TypeScript definition using TypeBox.
 */

import { Type, type Static } from "typebox";
import {
  type SkillId,
  type EntityScope,
} from "./skills/types.ts";

export { type EntityScope };

export const EntityScopeSchema = Type.Union([
  Type.Literal("single"),
  Type.Literal("specified"),
  Type.Literal("all_available"),
]);

export const AnswerKindSchema = Type.Union([
  Type.Literal("health"),
  Type.Literal("timeline"),
  Type.Literal("signal"),
  Type.Literal("cause"),
  Type.Literal("evidence_followup"),
]);
export type AnswerKind = Static<typeof AnswerKindSchema>;

export const TimeWindowSchema = Type.Object({
  start: Type.String({ description: "ISO 8601 or HH:MM:SS start timestamp" }),
  end: Type.String({ description: "ISO 8601 or HH:MM:SS end timestamp" }),
});
export type TimeWindow = Static<typeof TimeWindowSchema>;

export const SkillIdSchema = Type.Union([
  Type.Literal("health-status"),
  Type.Literal("timeline-summary"),
  Type.Literal("signal-analysis"),
  Type.Literal("root-cause-investigation"),
]);

export const RequestedAnswerSchema = Type.Object({
  originalQuestion: Type.String({ description: "Stable original user query" }),
  investigationId: Type.String({ description: "Current investigation / case ID" }),
  requestedTime: Type.Optional(TimeWindowSchema),
  requestedEntities: Type.Optional(Type.Array(Type.String())),
  entityScope: EntityScopeSchema,
  answerKind: AnswerKindSchema,
  mustCover: Type.Array(Type.String(), {
    description: "Required entity or message coverage checklist for action validation",
  }),
  selectedSkillIds: Type.Array(SkillIdSchema, {
    description: "Approved skill IDs selected to satisfy the request",
  }),
  requiresClarification: Type.Boolean({
    description: "True if critical scope/time parameters are missing and ambiguous",
  }),
  clarificationPrompt: Type.Optional(Type.String()),
  confidence: Type.Number({
    minimum: 0,
    maximum: 1,
    description: "Confidence in intent classification",
  }),
});

export type RequestedAnswer = Static<typeof RequestedAnswerSchema>;
