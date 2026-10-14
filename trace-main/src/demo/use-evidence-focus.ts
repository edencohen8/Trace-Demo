import { computed, onUnmounted, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import { api } from './client.ts';
import { evidencePoint } from './evidence-focus.ts';
import type { EvidenceEvent, ResolvedSource } from './types.ts';

export interface CitationInteraction {
  active: Ref<Set<string>>;
  hovered: Ref<string>;
  preview: (badge: string) => void;
  leave: (badge: string) => void;
}
export const citationInteraction: InjectionKey<CitationInteraction> = Symbol('timeline-citations');

export function useEvidenceFocus(caseId: Ref<string>) {
  const sources = ref<ResolvedSource[]>([]);
  const hovered = ref('');
  const previewSource = ref<ResolvedSource>();
  const messageId = ref('');
  const pending = ref(false);
  const notice = ref('');
  const revision = ref(0);
  const active = computed(() => new Set(sources.value.map(source => source.badge)));
  const events = computed(() => sources.value.flatMap(source => source.event && evidencePoint(source.event) ? [source.event] : []));
  const previewEvents = computed(() => previewSource.value?.event && evidencePoint(previewSource.value.event) ? [previewSource.value.event] : []);
  const cache = new Map<string, Promise<ResolvedSource>>();
  let request = 0; let previewRequest = 0; let hoverTimer: ReturnType<typeof setTimeout> | undefined;

  function resolve(badge: string): Promise<ResolvedSource> {
    const key = `${caseId.value}:${badge}`;
    let result = cache.get(key);
    if (!result) {
      result = api<ResolvedSource>(`/cases/${caseId.value}/evidence?badge=${encodeURIComponent(badge)}`);
      cache.set(key, result);
      void result.catch(() => { if (cache.get(key) === result) cache.delete(key); });
    }
    return result;
  }
  function leave(badge?: string) {
    if (badge && hovered.value !== badge) return;
    clearTimeout(hoverTimer); previewRequest++; hovered.value = ''; previewSource.value = undefined;
  }
  function preview(badge: string) {
    leave(); hovered.value = badge;
    const ticket = ++previewRequest;
    hoverTimer = setTimeout(() => {
      void resolve(badge).then(source => { if (ticket === previewRequest) previewSource.value = source; }).catch(() => {});
    }, 80);
  }
  function cancelPending() { request++; pending.value = false; }
  function clear() {
    cancelPending(); leave(); sources.value = []; messageId.value = ''; notice.value = '';
  }
  async function focus(badges: string[], id = ''): Promise<EvidenceEvent[] | undefined> {
    const ticket = ++request; leave(); pending.value = true; notice.value = '';
    const unique = [...new Set(badges)];
    const queued = new Set(unique);
    const resolved: ResolvedSource[] = []; let next = 0; let failures = 0;
    // Keep source resolution bounded even for a long investigation answer.
    await Promise.all(Array.from({ length: Math.min(6, unique.length) }, async () => {
      while (next < unique.length && ticket === request) {
        const badge = unique[next++]!;
        try {
          const source = await resolve(badge); resolved.push(source);
          if (source.kind === 'calculation') for (const input of source.inputs) {
            if (!queued.has(input)) { queued.add(input); unique.push(input); }
          }
        } catch { failures++; }
      }
    }));
    if (ticket !== request) return;
    pending.value = false;
    sources.value = resolved; messageId.value = id; revision.value++;
    notice.value = failures ? `${failures} מקורות לא נטענו. אפשר לנסות שוב.` : '';
    return events.value;
  }
  watch(caseId, () => { clear(); cache.clear(); }, { flush: 'sync' });
  onUnmounted(clear);
  provide(citationInteraction, { active, hovered, preview, leave });
  return { sources, events, previewEvents, active, hovered, messageId, pending, notice, revision, focus, preview, leave, clear, cancelPending };
}
