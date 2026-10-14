/**
 * TRACE Lane 3: Pi AI Model Provider Bootstrap
 * Provides LiteLLM proxy provider integration and Faux test provider.
 * Strict TypeScript definition.
 */

import {
  createModels,
  createProvider,
  fauxProvider,
  type Model,
  type Models,
  type Provider,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import type { StreamFn } from "@earendil-works/pi-agent-core";

export const DEFAULT_LITELLM_URL = process.env.LITELLM_URL || "http://localhost:4000/v1";
export const DEFAULT_LITELLM_KEY = process.env.LITELLM_MASTER_KEY || "sk-agentInfra-local";
export const DEFAULT_MODEL_ID = process.env.TRACE_MODEL_ID || "gemini-2.5-flash";

export interface LiteLLMProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
  contextWindow?: number;
  maxTokens?: number;
  compat?: Record<string, unknown>;
}

export interface FauxProviderOptions {
  tokensPerSecond?: number;
}

export interface ModelRegistryOptions {
  provider?: 'openai' | 'anthropic' | 'gemini' | 'litellm';
  apiKey?: string;
  modelId?: string;
  useFaux?: boolean;
  litellmOptions?: LiteLLMProviderOptions;
  fauxOptions?: FauxProviderOptions;
}

export interface ModelRegistry {
  models: Models;
  fauxInstance: ReturnType<typeof fauxProvider> | null;
  streamFn: StreamFn;
  getModel: (providerName?: string, modelId?: string) => Model<any> | undefined;
}

/**
 * Creates an OpenAI-compatible Provider pointing to LiteLLM / Vertex proxy.
 */
export function createLiteLLMProvider(options: LiteLLMProviderOptions = {}): Provider {
  const baseUrl = options.baseUrl || DEFAULT_LITELLM_URL;
  const apiKey = options.apiKey || DEFAULT_LITELLM_KEY;
  const modelId = options.modelId || DEFAULT_MODEL_ID;

  const litellmModel: Model<"openai-completions"> = {
    id: modelId,
    name: `LiteLLM (${modelId})`,
    api: "openai-completions",
    provider: "litellm",
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: options.contextWindow || 128000,
    maxTokens: options.maxTokens || 8192,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsStrictMode: false,
      ...options.compat,
    },
  };

  return createProvider({
    id: "litellm",
    name: "LiteLLM Proxy",
    baseUrl,
    auth: {
      apiKey: {
        name: "LiteLLM API key",
        resolve: async () => ({
          auth: { apiKey },
        }),
      },
    },
    models: [litellmModel],
    api: openAICompletionsApi(),
  });
}

/** Direct OpenAI Responses API; accepts account-specific model IDs. */
export function createOpenAIProvider(apiKey: string, modelId = 'gpt-6-luna'): Provider {
  return createProvider({
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    auth: { apiKey: { name: 'OpenAI API key', resolve: async () => ({ auth: { apiKey } }) } },
    models: [{
      id: modelId, name: modelId, api: 'openai-responses', provider: 'openai',
      baseUrl: 'https://api.openai.com/v1', reasoning: true, input: ['text'],
      // Conservative local budgets; account/model limits are enforced by OpenAI.
      contextWindow: 128000, maxTokens: 8192,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
    api: openAIResponsesApi(),
  });
}

/**
 * Creates an in-memory Faux Provider for hermetic testing.
 */
export function createFauxModelProvider(options: FauxProviderOptions = {}) {
  return fauxProvider({
    tokensPerSecond: options.tokensPerSecond || 500,
  });
}

/**
 * Initializes models registry with requested or default providers.
 */
export function initModelRegistry(options: ModelRegistryOptions = {}): ModelRegistry {
  const models = createModels(options.apiKey ? { authContext: {
    env: async (name) => ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY'].includes(name) ? options.apiKey : undefined,
    fileExists: async () => false,
  } } : {});
  const providerId = options.provider === 'gemini' ? 'google' : options.provider ?? 'litellm';
  const selectedModel = options.modelId ?? (providerId === 'openai' ? 'gpt-6-luna' : options.litellmOptions?.modelId ?? DEFAULT_MODEL_ID);
  let fauxInstance: ReturnType<typeof fauxProvider> | null = null;

  if (options.useFaux) {
    fauxInstance = createFauxModelProvider(options.fauxOptions);
    models.setProvider(fauxInstance.provider);
  } else if (providerId === 'openai') {
    models.setProvider(createOpenAIProvider(options.apiKey || process.env.OPENAI_API_KEY || '', options.modelId || 'gpt-6-luna'));
  } else if (providerId === 'anthropic') {
    models.setProvider(anthropicProvider());
  } else if (providerId === 'google') {
    models.setProvider(googleProvider());
  } else {
    const litellm = createLiteLLMProvider(options.litellmOptions);
    models.setProvider(litellm);
  }

  return {
    models,
    fauxInstance,
    streamFn: models.streamSimple.bind(models) as StreamFn,
    getModel: (providerName?: string, modelId?: string) => {
      if (options.useFaux && fauxInstance) {
        return fauxInstance.getModel();
      }
      return models.getModel(providerName || providerId, modelId || selectedModel);
    },
  };
}
