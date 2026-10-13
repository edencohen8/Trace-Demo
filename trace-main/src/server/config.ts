import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { ProviderStatus } from '../demo/types.ts';
import { initModelRegistry } from '../agent/provider.ts';
import type { StreamFn } from '@earendil-works/pi-agent-core';

export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export interface AIConfig {
  provider: 'anthropic' | 'gemini' | 'litellm';
  model: string;
  apiKey: string;
  baseUrl: string;
}

export async function readConfig(environment: NodeJS.ProcessEnv = process.env): Promise<AIConfig> {
  let file: Record<string, string | undefined> = {};
  try { file = parseEnv(await readFile(new URL('../../.env', import.meta.url), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const env = { ...file, ...Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== undefined)) };
  const provider = env.TRACE_AI_PROVIDER || 'anthropic';
  if (!['anthropic', 'gemini', 'litellm'].includes(provider)) throw new Error('TRACE_AI_PROVIDER must be anthropic, gemini, or litellm');
  const defaults = { anthropic: 'claude-haiku-5-5', gemini: 'gemini-2.5-flash', litellm: 'gemini-2.5-flash' };
  const kind = provider as AIConfig['provider'];
  return {
    provider: kind, model: env.TRACE_MODEL_ID || defaults[kind],
    apiKey: (kind === 'anthropic' ? env.ANTHROPIC_API_KEY : kind === 'gemini' ? env.GEMINI_API_KEY : env.LITELLM_MASTER_KEY) || '',
    baseUrl: env.LITELLM_URL || 'http://localhost:4000/v1',
  };
}

export function providerStatus(config: AIConfig): ProviderStatus {
  const keyName = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', litellm: 'LITELLM_MASTER_KEY' }[config.provider];
  return { provider: config.provider, model: config.model, configured: Boolean(config.apiKey.trim()),
    ...(!config.apiKey.trim() ? { problem: `Set ${keyName} in trace-main/.env, then retry.` } : {}) };
}

export function createRuntime(config: AIConfig, signal: AbortSignal) {
  const status = providerStatus(config);
  if (!status.configured) throw new Error(status.problem);
  const registry = initModelRegistry({ provider: config.provider, apiKey: config.apiKey, modelId: config.model,
    litellmOptions: { baseUrl: config.baseUrl, apiKey: config.apiKey, modelId: config.model } });
  const model = registry.getModel();
  if (!model) throw new Error(`Unknown model '${config.model}' for ${config.provider}. Set TRACE_MODEL_ID to a supported model.`);
  let calls = 0;
  const streamFn: StreamFn = (selectedModel, context, options) => {
    signal.throwIfAborted();
    if (++calls > 36) throw new Error('Model request budget reached. Ask a narrower question.');
    return registry.streamFn(selectedModel, context, { ...options, reasoning: 'low', maxTokens: 8192,
      signal: options?.signal ? AbortSignal.any([signal, options.signal]) : signal });
  };
  const complete = async (prompt: string): Promise<string> => {
    if (++calls > 36) throw new Error('Model request budget reached.');
    const response = await registry.models.completeSimple(model, {
      messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
    }, { signal, reasoning: 'low', maxTokens: 4096 });
    if (response.stopReason === 'error' || response.stopReason === 'aborted') throw new Error(response.errorMessage || 'AI request failed');
    if (response.stopReason === 'length') throw new Error('The AI response reached its output limit. Please retry with a narrower question.');
    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    if (!text.trim()) throw new Error('The AI returned no answer text. Please retry.');
    return text;
  };
  return { model, streamFn, complete };
}

export function safeError(error: unknown, config?: AIConfig): string {
  let message = error instanceof Error ? error.message : String(error);
  if (config?.apiKey) message = message.split(config.apiKey).join('[redacted]');
  message = message.replace(/sk-[\w-]+/g, '[redacted]').replace(/AIza[\w-]+/g, '[redacted]');
  return message.slice(0, 600);
}
