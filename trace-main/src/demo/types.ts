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

export interface ResolvedSource {
  badge: string;
  sourceFile: string;
  sha256: string;
  line: number;
  sheet?: string;
  event?: EvidenceEvent;
  lines: { number: number; content: string; highlight: boolean }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  citations: string[];
  mode?: string;
  model?: string;
  validation?: string;
  details?: { title: string; explanation: string; citations: string[] }[];
  activity?: InvestigationStep[];
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
