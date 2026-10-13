/**
 * TRACE Lane 3: Pi Agent Core Investigation Harness
 * Wraps @earendil-works/pi-agent-core Agent with lifecycle tracking,
 * tool execution observation, and state accessors.
 * Strict TypeScript definition.
 */

import {
  Agent,
  type AgentEvent,
  type AgentMessage,
  type AgentState,
  type AgentTool,
  type BeforeToolCallContext,
  type BeforeToolCallResult,
  type AfterToolCallContext,
  type AfterToolCallResult,
  type StreamFn,
  type ToolExecutionMode,
} from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";

export interface InvestigationAgentOptions {
  signal?: AbortSignal;
  maxTurns?: number;
  systemPrompt?: string;
  tools?: AgentTool<any>[];
  model: Model<any>;
  streamFn: StreamFn;
  sessionId?: string;
  toolExecution?: ToolExecutionMode;
  beforeToolCall?: (
    context: BeforeToolCallContext,
    signal?: AbortSignal
  ) => Promise<BeforeToolCallResult | undefined>;
  afterToolCall?: (
    context: AfterToolCallContext,
    signal?: AbortSignal
  ) => Promise<AfterToolCallResult | undefined>;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
}

export interface RecordedAgentEvent {
  timestamp: number;
  type: AgentEvent["type"];
  event: AgentEvent;
}

export interface InvestigationAgentController {
  agent: Agent;
  sessionId: string;
  prompt: (input: string | AgentMessage | AgentMessage[]) => Promise<void>;
  continue: () => Promise<void>;
  getEvents: () => RecordedAgentEvent[];
  getMessages: () => AgentMessage[];
  getState: () => AgentState;
  reset: () => void;
}

/**
 * Creates a configured Pi Agent instance.
 */
export function createInvestigationAgent(
  options: InvestigationAgentOptions
): InvestigationAgentController {
  const {
    systemPrompt,
    tools = [],
    model,
    streamFn,
    sessionId = `investigation-${Date.now()}`,
    toolExecution = "parallel",
    beforeToolCall,
    afterToolCall,
    onEvent,
  } = options;

  if (!model) {
    throw new Error("createInvestigationAgent: 'model' is required.");
  }
  if (!streamFn) {
    throw new Error("createInvestigationAgent: 'streamFn' is required.");
  }

  const events: RecordedAgentEvent[] = [];
  let turns = 0;

  const agent = new Agent({
    initialState: {
      systemPrompt: systemPrompt || "You are a TRACE Incident Investigator.",
      model,
      tools,
      messages: [],
    },
    streamFn,
    sessionId,
    toolExecution,
    beforeToolCall,
    afterToolCall,
  });

  // Track all lifecycle events
  agent.subscribe(async (event: AgentEvent) => {
    if (event.type === 'turn_start' && ++turns > (options.maxTurns ?? 16)) {
      agent.abort();
      throw new Error('Agent turn budget reached');
    }
    events.push({
      timestamp: Date.now(),
      type: event.type,
      event,
    });
    if (onEvent) {
      await onEvent(event);
    }
  });

  return {
    agent,
    sessionId,

    async prompt(input: string | AgentMessage | AgentMessage[]): Promise<void> {
      options.signal?.throwIfAborted();
      const abort = () => agent.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      try {
        await agent.prompt(input as any);
        options.signal?.throwIfAborted();
        if (agent.state.errorMessage) throw new Error(agent.state.errorMessage);
      } finally { options.signal?.removeEventListener('abort', abort); }
    },

    async continue(): Promise<void> {
      await agent.continue();
    },

    getEvents(): RecordedAgentEvent[] {
      return [...events];
    },

    getMessages(): AgentMessage[] {
      return [...agent.state.messages];
    },

    getState(): AgentState {
      return agent.state;
    },

    reset(): void {
      events.length = 0;
      agent.reset();
    },
  };
}
