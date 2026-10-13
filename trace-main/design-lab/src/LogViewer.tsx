import { defineComponent, h, Fragment, ref, computed, watch, nextTick, type PropType } from 'vue';
import { X, ChevronLeft, ChevronRight, Paperclip, FileText } from 'lucide-vue-next';
import { clock, sourceRecord, systems, type TraceEvent } from './data';
import './log-viewer.css';

export const logViews = [
  { id: 'modal', name: 'Floating window', hint: 'בדיקת מקור מעל סביבת העבודה' },
  { id: 'sidecar', name: 'Side inspector', hint: 'המקור והציר זה לצד זה' },
  { id: 'dock', name: 'Bottom panel', hint: 'פרטי המקור מתחת לציר' },
  { id: 'inline', name: 'Inline detail', hint: 'הרשומה נפתחת בתוך שורת המערכת' },
  { id: 'focus', name: 'Focus reader', hint: 'קריאה ממוקדת עם דפדוף בין רשומות' },
  { id: 'compare', name: 'Record comparison', hint: 'רשומת ייחוס קבועה לצד הרשומה שנבחרה' },
] as const;
export type LogView = typeof logViews[number]['id'];
export const palettes = [
  { id: 'amber', name: 'Amber', color: '#d9af79' },
  { id: 'teal', name: 'Jade', color: '#65c9b6' },
  { id: 'cobalt', name: 'Cobalt', color: '#91b9ff' },
  { id: 'plum', name: 'Plum', color: '#c8a4df' },
  { id: 'slate', name: 'Graphite', color: '#98bdd8' },
] as const;

export default defineComponent({
  props: {
    event: { type: Object as PropType<TraceEvent>, required: true },
    entries: { type: Array as PropType<TraceEvent[]>, required: true },
    mode: { type: String as PropType<LogView>, required: true },
    onSelect: { type: Function as PropType<(event: TraceEvent) => void>, required: true },
    onClose: { type: Function as PropType<() => void>, required: true },
    onAttach: { type: Function as PropType<(event: TraceEvent) => void>, required: true },
  },
  setup(props) {
    const tab = ref<'summary' | 'fields' | 'raw'>('summary');
    const page = ref(0), listPage = ref(0);
    const host = ref<HTMLElement | null>(null);
    const pane = ref<HTMLElement | null>(null);
    const index = computed(() => props.entries.findIndex(e => e.id === props.event.id));
    const reference = ref<TraceEvent>(props.entries[Math.max(0, index.value - 1)] ?? props.event);
    const fields = computed(() => [
      ['event_id', props.event.id], ['system', props.event.system], ['timestamp', clock(props.event.time)],
      ['severity', props.event.severity], ['source_file', props.event.file], ['line', String(props.event.line)],
      ['target', 'T-041'], ['simulated', 'true'],
    ]);
    const rawLines = computed(() => sourceRecord(props.event).split('\n'));
    const rawPageSize = computed(() => props.mode === 'inline' ? 3 : 4);
    const summaryChunks = computed(() => props.event.detail.match(/.{1,145}(?:\s|$)|.{1,145}/gu) ?? [props.event.detail]);
    const pageCount = computed(() => tab.value === 'raw' ? Math.ceil(rawLines.value.length / rawPageSize.value) : tab.value === 'fields' ? Math.ceil(fields.value.length / 4) : summaryChunks.value.length);
    const recordListPages = computed(() => Math.max(1, Math.ceil(props.entries.length / 4)));
    watch([() => props.event.id, () => props.mode], () => { page.value = 0; listPage.value = Math.max(0, Math.floor(index.value / 4)); }, { immediate: true });
    watch(() => props.entries, () => { listPage.value = Math.min(listPage.value, recordListPages.value - 1); });
    watch(tab, () => { page.value = 0; });
    watch([() => props.event.id, () => props.mode, tab], async () => {
      await nextTick();
      pane.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    function previousNext(delta: number) {
      const next = props.entries[index.value + delta];
      if (next) props.onSelect(next);
    }
    function setTab(next: typeof tab.value) { tab.value = next; }
    return () => <section ref={host} class={['log-viewer', `viewer-${props.mode}`]} aria-label="מציג רשומות מקור" onKeydown={event => { if (event.key === 'Escape') { event.stopPropagation(); props.onClose(); } }}>
      <header class="log-heading"><div><FileText size={16}/><bdi>{props.event.id}</bdi>{props.mode === 'dock' ? <><strong class="dock-event-title" title={props.event.title}>{props.event.title}</strong><time dir="ltr">{clock(props.event.time)}</time></> : <span>{systems.find(s => s.id === props.event.system)?.name}</span>}</div><button class="icon-button" aria-label="סגירת מציג הלוגים" onClick={props.onClose}><X size={17}/></button></header>
      <div class="reader-body">
        {props.mode === 'compare' && <aside class="comparison-reference" aria-label="רשומת ייחוס"><div class="reference-heading"><span>רשומת ייחוס</span><button onClick={() => { reference.value = props.event; }}>קיבוע הרשומה הנוכחית</button></div><bdi>{reference.value.id}</bdi><h3>{reference.value.title}</h3><dl><div><dt>זמן</dt><dd dir="ltr">{clock(reference.value.time)}</dd></div><div><dt>מערכת</dt><dd>{reference.value.system}</dd></div><div><dt>חומרה</dt><dd>{reference.value.severity}</dd></div><div><dt>מקור</dt><dd dir="ltr">{reference.value.file}:{reference.value.line}</dd></div></dl><p>{reference.value.detail}</p><small>הייחוס נשאר קבוע בזמן הדפדוף ברשומות.</small></aside>}
        {props.mode === 'focus' && <nav class="record-browser" aria-label="רשומות בחלון הזמן"><div class="record-list-heading"><span>{props.entries.length} רשומות בחלון</span></div><div class="record-page">{props.entries.slice(listPage.value * 4, listPage.value * 4 + 4).map(event => <button class={['record-item', { active: event.id === props.event.id }]} aria-pressed={event.id === props.event.id} onClick={() => props.onSelect(event)}><span><bdi>{event.id}</bdi><time>{clock(event.time)}</time></span><strong>{event.title}</strong></button>)}</div><div class="record-list-pager" dir="ltr"><button aria-label="עמוד רשומות קודם" disabled={listPage.value === 0} onClick={() => { listPage.value--; }}><ChevronLeft size={15}/></button><span>{listPage.value + 1} / {recordListPages.value}</span><button aria-label="עמוד רשומות הבא" disabled={listPage.value + 1 >= recordListPages.value} onClick={() => { listPage.value++; }}><ChevronRight size={15}/></button></div></nav>}
        <div class="record-content">
          <div class="record-title"><h3>{props.event.title}</h3><div><time dir="ltr">{clock(props.event.time)}</time><span class={['record-severity', props.event.severity]}>{props.event.severity === 'critical' ? 'חריגה' : props.event.severity === 'warning' ? 'לבדיקה' : 'מידע'}</span></div></div>
          <div class="record-tabs" role="tablist" aria-label="תוכן הרשומה">{([['summary', 'תקציר'], ['fields', 'שדות'], ['raw', 'מקור']] as const).map(([id, label]) => <button role="tab" aria-selected={tab.value === id} aria-controls="record-panel" id={`record-tab-${id}`} onClick={() => setTab(id)} onKeydown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault(); const names = ['summary', 'fields', 'raw'] as const;
            const next = names[(names.indexOf(tab.value) + (event.key === 'ArrowLeft' ? 1 : 2)) % 3]; setTab(next);
            host.value?.querySelector<HTMLButtonElement>(`#record-tab-${next}`)?.focus();
          }} tabindex={tab.value === id ? 0 : -1}>{label}</button>)}</div>
          <div ref={pane} class="record-pane" id="record-panel" role="tabpanel" aria-labelledby={`record-tab-${tab.value}`} tabindex={0} onKeydown={event => {
            if (props.mode !== 'dock' || !pane.value || !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
            event.preventDefault();
            const region = pane.value;
            const top = event.key === 'Home' ? 0 : event.key === 'End' ? region.scrollHeight : region.scrollTop + region.clientHeight * (event.key === 'PageDown' ? 1 : -1);
            region.scrollTo({ top, behavior: 'instant' });
          }}>
            {tab.value === 'summary' && (props.mode === 'dock' ? <div class="dock-details">
              <div class="dock-description"><p>{props.event.detail}</p><div class="dock-source"><FileText size={13}/><span dir="ltr">{props.event.file}:{props.event.line}</span><span>מקור מדומה</span></div></div>
              <dl class="dock-facts">
                <div><dt>מערכת</dt><dd>{systems.find(system => system.id === props.event.system)?.name}</dd></div>
                <div><dt>מטרה</dt><dd dir="ltr">T-041</dd></div>
                <div><dt>חומרה</dt><dd class={props.event.severity}>{props.event.severity === 'critical' ? 'חריגה קריטית' : props.event.severity === 'warning' ? 'דורש בדיקה' : 'מידע'}</dd></div>
                <div><dt>{props.event.end ? 'משך מתועד' : 'סוג אירוע'}</dt><dd>{props.event.end ? `${props.event.end - props.event.time} שניות` : 'אירוע נקודתי'}</dd></div>
              </dl>
            </div> : <div class="record-summary"><p>{summaryChunks.value[page.value]}</p><span class="source-locator" dir="ltr">{props.event.file}:{props.event.line}</span></div>)}
            {tab.value === 'fields' && <dl class="record-fields" dir="ltr">{(props.mode === 'dock' ? fields.value : fields.value.slice(page.value * 4, page.value * 4 + 4)).map(([key, value]) => <div><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
            {tab.value === 'raw' && <pre class="record-raw" dir="ltr">{(props.mode === 'dock' ? rawLines.value : rawLines.value.slice(page.value * rawPageSize.value, (page.value + 1) * rawPageSize.value)).map((line, i) => <span><i>{(props.mode === 'dock' ? 0 : page.value * rawPageSize.value) + i + 1}</i><code>{line}</code></span>)}</pre>}
          </div>
          {props.mode !== 'dock' && <div class={['content-pager', { 'single-page': pageCount.value === 1 }]} dir="ltr"><span>{tab.value === 'raw' ? 'Raw record' : tab.value === 'fields' ? 'Record fields' : 'Source summary'}</span><div><button aria-label="עמוד תוכן קודם" disabled={page.value === 0} onClick={() => { page.value--; }}><ChevronLeft size={14}/></button><span aria-live="polite">{page.value + 1} / {pageCount.value}</span><button aria-label="עמוד תוכן הבא" disabled={page.value + 1 >= pageCount.value} onClick={() => { page.value++; }}><ChevronRight size={14}/></button></div></div>}
        </div>
      </div>
      <footer class="log-footer"><div class="event-pager" dir="ltr"><button aria-label="רשומה קודמת" disabled={index.value <= 0} onClick={() => previousNext(-1)}><ChevronLeft size={16}/></button><span>{index.value >= 0 ? index.value + 1 : '—'} / {props.entries.length}</span><button aria-label="רשומה הבאה" disabled={index.value < 0 || index.value + 1 >= props.entries.length} onClick={() => previousNext(1)}><ChevronRight size={16}/></button></div><button class="attach-button" onClick={() => props.onAttach(props.event)}><Paperclip size={14}/><span>שאלו על הרשומה</span></button>{props.mode === 'dock' && <button class="icon-button dock-close" aria-label="סגירת מציג הלוגים" onClick={props.onClose}><X size={16}/></button>}</footer>
    </section>;
  },
});
