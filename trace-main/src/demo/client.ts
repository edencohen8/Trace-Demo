import type { ChatMessage, ProgressEvent } from './types.ts';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value as T;
}

export async function streamChat(caseId: string, text: string, evidence: string[], signal: AbortSignal,
  progress: (event: ProgressEvent) => void): Promise<ChatMessage> {
  const response = await fetch(`/api/cases/${caseId}/chat`, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, evidence }) });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Chat request failed'); }
  if (!response.body) throw new Error('Streaming is unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer: ChatMessage | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        if (!frame.startsWith('data: ')) continue;
        const event = JSON.parse(frame.slice(6)) as ProgressEvent;
        progress(event);
        if (event.type === 'error') throw new Error(event.text || 'Investigation failed');
        if (event.type === 'done') answer = event.message;
      }
    }
  } finally { await reader.cancel(); }
  if (!answer) throw new Error('The connection ended before the answer was complete. Please retry.');
  return answer;
}

export function splitCitations(text: string): { text: string; citation: boolean }[] {
  return text.split(/(\[[a-zA-Z0-9_]+\.(?:csv|txt|xlsx|json):L[1-9]\d*\])/g)
    .filter(Boolean).map((part) => ({ text: part, citation: /^\[.*:L\d+\]$/.test(part) }));
}
