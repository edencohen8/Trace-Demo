import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CaseSession, ChatMessage } from '../demo/types.ts';
import { CASE_IDS } from './evidence-store.ts';
import { APP_ROOT } from './config.ts';

export class SessionStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private root = join(APP_ROOT, '.state')) {}
  private path(caseId: string): string {
    if (!(CASE_IDS as readonly string[]).includes(caseId)) throw new Error('Unknown investigation');
    return join(this.root, `${caseId}.json`);
  }
  async read(caseId: string): Promise<CaseSession> {
    try { return JSON.parse(await readFile(this.path(caseId), 'utf8')) as CaseSession; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { caseId, messages: [], lessons: [] };
    }
  }
  private update(caseId: string, change: (session: CaseSession) => void): Promise<CaseSession> {
    const result = this.queue.then(async () => {
      const session = await this.read(caseId);
      change(session);
      await mkdir(this.root, { recursive: true });
      const destination = this.path(caseId);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(session, null, 2), { mode: 0o600 });
      await rename(temporary, destination);
      return session;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  append(caseId: string, messages: ChatMessage[]): Promise<CaseSession> {
    return this.update(caseId, (session) => { session.messages.push(...messages); });
  }
  approve(caseId: string, messageId: string): Promise<CaseSession> {
    return this.update(caseId, (session) => {
      const message = session.messages.find((entry) => entry.id === messageId && entry.role === 'assistant');
      if (!message || message.validation !== 'satisfied') throw new Error('Only a validated answer can be saved');
      if (!session.lessons.some((lesson) => lesson.messageId === messageId)) {
        session.lessons.push({ id: randomUUID(), messageId, text: message.text, citations: message.citations, createdAt: new Date().toISOString() });
      }
    });
  }
}
