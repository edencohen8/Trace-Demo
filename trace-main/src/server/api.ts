import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { EvidenceStore } from './evidence-store.ts';
import { SessionStore } from './session-store.ts';
import { readConfig, providerStatus, safeError, type AIConfig } from './config.ts';
import { runChat } from './chat.ts';
import { parseChatTimeRange } from './chat-time-range.ts';
import type { EventFilter, ProgressEvent } from '../demo/types.ts';

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Use application/json');
  let data = '';
  for await (const chunk of request) {
    data += String(chunk);
    if (Buffer.byteLength(data) > 16_384) throw new Error('Request is too large');
  }
  const value: unknown = JSON.parse(data);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
}

function parseFilter(params: URLSearchParams): EventFilter {
  return { system: params.get('system') || undefined, start: params.get('start') || undefined, end: params.get('end') || undefined,
    source: params.get('source') || undefined, target: params.get('target') || undefined,
    query: params.get('query') || undefined, messageType: params.get('messageType') || undefined,
    alertsOnly: params.get('alertsOnly') === 'true', limit: Number(params.get('limit') ?? 100), offset: Number(params.get('offset') ?? 0) };
}

export function createApi(options: { store?: EvidenceStore; sessions?: SessionStore; chat?: typeof runChat; getConfig?: typeof readConfig } = {}) {
  const store = options.store ?? new EvidenceStore();
  const sessions = options.sessions ?? new SessionStore();
  const chat = options.chat ?? runChat;
  const getConfig = options.getConfig ?? readConfig;
  const busy = new Set<string>();
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;
    let config: AIConfig | undefined;
    try {
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) { json(response, 403, { error: 'Cross-origin request denied' }); return true; }
      if (url.pathname === '/api/status' && request.method === 'GET') {
        config = await getConfig(); json(response, 200, { ...providerStatus(config), storage: 'local-json' }); return true;
      }
      if (url.pathname === '/api/cases' && request.method === 'GET') {
        json(response, 200, await store.summaries()); return true;
      }
      const match = url.pathname.match(/^\/api\/cases\/([^/]+)\/(events|timeline|timeline-points|timeline-focus|timeline-group|evidence|session|export|chat|approve)$/);
      if (!match) { json(response, 404, { error: 'API route not found' }); return true; }
      const [, caseId, action] = match as [string, string, string];
      store.assertCase(caseId);
      if (request.method === 'GET') {
        switch (action) {
          case 'events': json(response, 200, await store.query(caseId, parseFilter(url.searchParams))); break;
          case 'timeline': json(response, 200, await store.timeline(caseId, parseFilter(url.searchParams))); break;
          case 'timeline-points': json(response, 200, await store.timelinePoints(caseId, parseFilter(url.searchParams))); break;
          case 'timeline-focus': json(response, 200, await store.timelineFocus(caseId, parseFilter(url.searchParams))); break;
          case 'timeline-group': json(response, 200, await store.timelineGroup(caseId, url.searchParams.get('group') ?? '', parseFilter(url.searchParams), url.searchParams.get('series') || undefined)); break;
          case 'evidence': json(response, 200, await store.resolve(caseId, url.searchParams.get('badge') ?? '')); break;
          case 'session': json(response, 200, await sessions.read(caseId)); break;
          case 'export': response.setHeader('Content-Disposition', `attachment; filename="trace-${caseId}.json"`); json(response, 200, await sessions.read(caseId)); break;
          default: json(response, 405, { error: 'Method not allowed' });
        }
        return true;
      }
      if (request.method === 'DELETE' && action === 'chat') {
        if (busy.has(caseId)) { json(response, 409, { error: 'הבדיקה עדיין פועלת. יש להמתין לסיום לפני ניקוי השיחה.' }); return true; }
        busy.add(caseId);
        try { json(response, 200, await sessions.clearChat(caseId)); }
        finally { busy.delete(caseId); }
        return true;
      }
      if (request.method !== 'POST') { json(response, 405, { error: 'Method not allowed' }); return true; }
      const input = await body(request);
      if (action === 'approve') {
        if (typeof input.messageId !== 'string') throw new Error('messageId is required');
        json(response, 200, await sessions.approve(caseId, input.messageId)); return true;
      }
      if (action !== 'chat') { json(response, 405, { error: 'Method not allowed' }); return true; }
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000) throw new Error('Enter a question of 1–4000 characters');
      const evidence = input.evidence ?? [];
      if (!Array.isArray(evidence) || evidence.length > 8 || evidence.some((value) => typeof value !== 'string')) throw new Error('Attach at most 8 evidence references');
      await Promise.all(evidence.map((badge) => store.resolve(caseId, badge as string)));
      const timeRange = parseChatTimeRange(input.timeRange, await store.summary(caseId));
      config = await getConfig();
      if (!providerStatus(config).configured) { json(response, 503, { error: providerStatus(config).problem }); return true; }
      if (busy.has(caseId)) { json(response, 409, { error: 'An investigation is already running for this case' }); return true; }
      busy.add(caseId);
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(new Error('Investigation timed out after 3 minutes. Try a narrower question.')), 180_000);
      const disconnected = () => { if (!response.writableEnded) abort.abort(new Error('Client disconnected')); };
      response.on('close', disconnected);
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const emit = (event: ProgressEvent) => { if (!response.destroyed && !response.writableEnded) response.write(`data: ${JSON.stringify(event)}\n\n`); };
      const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15_000);
      try {
        const session = await sessions.read(caseId);
        const answer = await chat({ caseId, text: input.text.trim(), evidence, timeRange }, session, store, config, abort.signal, emit);
        abort.signal.throwIfAborted();
        await sessions.append(caseId, [{ id: randomUUID(), role: 'user', text: input.text.trim(), citations: evidence,
          timeRange, createdAt: new Date().toISOString() }, answer]);
        emit({ type: 'done', message: answer });
      } catch (error) { emit({ type: 'error', text: safeError(error, config) }); }
      finally {
        busy.delete(caseId); clearTimeout(timeout); clearInterval(heartbeat);
        response.off('close', disconnected); response.end();
      }
    } catch (error) { if (!response.headersSent) json(response, 400, { error: safeError(error, config) }); }
    return true;
  };
}
