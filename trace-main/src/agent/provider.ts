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
  const models = createModels();
  let fauxInstance: ReturnType<typeof fauxProvider> | null = null;

  if (options.useFaux) {
    fauxInstance = createFauxModelProvider(options.fauxOptions);
    models.setProvider(fauxInstance.provider);
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
      return models.getModel(providerName || "litellm", modelId || DEFAULT_MODEL_ID);
    },
  };
}
