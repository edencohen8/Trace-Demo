export interface EvidenceEvent {
  id: string;
  badge: string;
  caseId: string;
  source: string;
  sourceFile: string;
  family: 'sniffer' | 'component_log' | 'operator_diary';
  line: number;
  sheet?: string;
  time: string;
  recordedTime?: string;
  precision?: string;
  type: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  target?: string;
  text: string;
  fields: Record<string, string | number>;
}

export interface CaseSummary {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  eventCount: number;
  sources: string[];
  targets: string[];
  messageTypes: string[];
  excludedTypes: string[];
  recorderDrops: number | null;
  coverage: string;
  diary: EvidenceEvent[];
  files: { name: string; sha256: string; records: number }[];
  parseErrors: { file: string; line: number; reason: string }[];
}

export interface EventFilter {
  system?: string;
  start?: string;
  end?: string;
  source?: string;
  target?: string;
  messageType?: string;
  query?: string;
  alertsOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface EventPage {
  rows: EvidenceEvent[];
  total: number;
  offset: number;
  nextOffset: number | null;
}

export interface TimelineBin {
  start: string;
  end: string;
  count: number;
  alerts: number;
  sources: Record<string, number>;
  alertSources: Record<string, number>;
}

export interface TimelinePoint {
  system: string;
  time: string;
  badge: string;
  source: string;
  type: string;
  severity: EvidenceEvent['severity'];
  count: number;
  diary: boolean;
}

export interface TimelinePoints {
  points: TimelinePoint[];
  totalPoints: number;
  totalRecords: number;
  truncated: boolean;
}

export interface TimelineGroup extends TimelinePoint {
  id: string;
  end: string;
  kind: 'activity' | 'event' | 'change' | 'alert' | 'diary' | 'record';
  label: string;
  seriesCount: number;
}

export interface TimelineFocus {
  groups: TimelineGroup[];
  totalRecords: number;
  bucketMs: number;
}

export interface TimelineSeries {
  id: string;
  source: string;
  type: string;
  target?: string;
  count: number;
  start: string;
  end: string;
  ranges: { field: string; min: number; max: number; minBadge: string; maxBadge: string }[];
}

export interface TimelineGroupDetail {
  group: TimelineGroup;
  series: TimelineSeries[];
  page: EventPage;
  seriesId?: string;
}

export interface RawSource {
  kind?: 'source';
  badge: string;
  sourceFile: string;
  sha256: string;
  line: number;
  sheet?: string;
  event?: EvidenceEvent;
  lines: { number: number; content: string; highlight: boolean }[];
}

export interface ResolvedCalculation {
  kind: 'calculation';
  badge: string;
  operation: 'region';
  title: string;
  result: ReturnType<typeof import('../server/radar-analysis.ts').inspectRegion>;
  inputs: string[];
  inputHashes: { name: string; sha256: string }[];
  fingerprint: string;
  event?: never;
  sourceFile?: never;
  line?: never;
  lines?: never;
  sha256?: never;
  sheet?: never;
}
export type ResolvedSource = RawSource | ResolvedCalculation;

export interface ChatTimeRange { start: string; end: string }

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  citations: string[];
  timeRange?: ChatTimeRange;
  mode?: string;
  model?: string;
  validation?: string;
  details?: { title: string; explanation: string; citations: string[] }[];
  activity?: InvestigationStep[];
  computations?: { tool: string; result: unknown }[];
}

export interface CaseSession {
  caseId: string;
  messages: ChatMessage[];
  lessons: { id: string; messageId: string; text: string; citations: string[]; createdAt: string }[];
}

export interface ProviderStatus {
  provider: string;
  model: string;
  configured: boolean;
  problem?: string;
}

export interface ProgressEvent {
  type: 'status' | 'tool_call' | 'tool_result' | 'done' | 'error';
  text?: string;
  tool?: string;
  message?: ChatMessage;
  step?: InvestigationStep;
}

export interface InvestigationStep {
  id: string;
  title: string;
  detail?: string;
  state: 'running' | 'complete' | 'error';
  startedAt: number;
  completedAt?: number;
  completionOrder?: number;
  citations?: string[];
}
