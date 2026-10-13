import { createApp, defineComponent, h, Fragment, ref, computed, nextTick, onUnmounted, watch, type Component } from 'vue';
import { Activity, Search, Bookmark, Radio, Radar, Monitor, Server, AudioLines, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, ArrowUpRight, ArrowUp, FileText, X, Paperclip, Play, Pause, Filter, Check, ExternalLink } from 'lucide-vue-next';
import { DAY, INCIDENT, systems, events, evidence, clock, sourceRecord, type TraceEvent, type SystemId } from './data';
import './style.css';
import LogViewer, { logViews, palettes, type LogView } from './LogViewer';
import './graphite-dock.css';
import './jade-dock.css';

interface Message { role: 'user' | 'assistant'; text: string; refs: string[] }
const icons: Record<SystemId, Component> = { iff: Radio, sensor: Radar, operator: Monitor, services: Server, radio: AudioLines };
const App = defineComponent({
  setup() {
    const params = new URLSearchParams(location.search);
    const requestedTheme = params.get('theme') ?? (params.get('design') === '2' ? 'amber' : 'teal');
    const theme = ref<string>(palettes.some(p => p.id === requestedTheme) ? requestedTheme : 'teal');
    const inspectMode = ref<LogView>(logViews.find(v => v.id === params.get('view'))?.id ?? 'dock');
    function syncUrl() { const url = new URL(location.href); url.searchParams.set('theme', theme.value); url.searchParams.set('view', inspectMode.value); history.replaceState({}, '', url); }
    function chooseView(value: LogView) { inspectMode.value = value; rawOpen.value = true; mobileTab.value = 'timeline'; stop(); syncUrl(); }
    function cycleView(delta: number) { chooseView(logViews[(logViews.findIndex(v => v.id === inspectMode.value) + delta + logViews.length) % logViews.length].id); }
    const start = ref(INCIDENT - 60), span = ref(300), selected = ref<TraceEvent>(evidence[0]);
    const query = ref(''), alerts = ref(false), hidden = ref<SystemId[]>([]), input = ref('');
    const filtersOpen = ref(false), mobileTab = ref<'timeline' | 'chat'>('timeline');
    const attachment = ref<TraceEvent | null>(null), rawOpen = ref(true), notesOpen = ref(false), busy = ref(false);
    const saved = ref<string[]>([]), toast = ref(''), playing = ref(false), cursor = ref(INCIDENT);
    const chatBody = ref<HTMLElement | null>(null), searchInput = ref<HTMLInputElement | null>(null);
    const modal = ref<HTMLElement | null>(null);
    let previousFocus: HTMLElement | null = null;
    watch(() => rawOpen.value || notesOpen.value, async opened => {
      if (opened) {
        previousFocus = document.activeElement as HTMLElement | null;
        await nextTick(); (modal.value ?? document.querySelector<HTMLElement>('.log-viewer'))?.querySelector<HTMLButtonElement>('button')?.focus();
      } else { await nextTick(); previousFocus?.focus(); }
    });
    function modalKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { rawOpen.value = false; notesOpen.value = false; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(modal.value?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    const messages = ref<Message[]>([
      { role: 'user', text: 'מה קרה סביב 14:32?', refs: [] },
      { role: 'assistant', text: 'קוד 7500 נקלט. שנייה אחר כך נעצר שירות ההתרעות. פרטי המטרה נפתחו אחרי 102 שניות.\n\nזהו רצף מתועד. הסיבה להפסקה עדיין לא אומתה.', refs: ['EV-106', 'EV-107', 'EV-111'] },
    ]);
    let playTimer: ReturnType<typeof setInterval> | undefined;
    let answerTimer: ReturnType<typeof setTimeout> | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearInterval(playTimer); playing.value = false; };
    onUnmounted(() => { stop(); clearTimeout(answerTimer); clearTimeout(toastTimer); });
    const filtered = computed(() => events.filter(e => !hidden.value.includes(e.system) && (!alerts.value || e.severity !== 'info') && (!query.value || `${e.id} ${e.title} ${e.system} ${e.detail}`.toLowerCase().includes(query.value.toLowerCase()))));
    const visible = computed(() => filtered.value.filter(e => e.time <= start.value + span.value && (e.end ?? e.time) >= start.value));
    const ticks = computed(() => Array.from({ length: 6 }, (_, i) => start.value + span.value * i / 5));
    const bins = Array.from({ length: 144 }, (_, i) => events.filter(e => e.time >= i * DAY / 144 && e.time < (i + 1) * DAY / 144).length);
    const maxBin = Math.max(...bins);
    const binKinds = Array.from({ length: 144 }, (_, i) => {
      const binEvents = events.filter(event => event.time >= i * DAY / 144 && event.time < (i + 1) * DAY / 144);
      return binEvents.some(event => event.severity === 'critical') ? 'critical' : binEvents.some(event => event.severity === 'warning') ? 'warning' : 'activity';
    });
    const x = (time: number) => (time - start.value) / span.value * 100;
    function notify(text: string) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = ''; }, 2600); }
    function setWindow(next: number, width = span.value) {
      span.value = Math.max(30, Math.min(DAY, width));
      start.value = Math.max(0, Math.min(DAY - span.value, next));
    }
    function zoom(factor: number) { const width = span.value * factor; setWindow(start.value + (span.value - width) / 2, width); }
    function focusIncident() { stop(); setWindow(INCIDENT - 60, 300); cursor.value = INCIDENT; }
    function pick(event: TraceEvent) { selected.value = event; cursor.value = event.time; rawOpen.value = true; }
    function jump(id: string) {
      const event = events.find(e => e.id === id); if (!event) return;
      query.value = ''; alerts.value = false; hidden.value = hidden.value.filter(s => s !== event.system);
      if (event.time < start.value || event.time > start.value + span.value) setWindow(event.time - 60, 300);
      pick(event);
      mobileTab.value = 'timeline';
    }
    function step(direction: number) {
      const list = visible.value; if (!list.length) return;
      const index = list.findIndex(e => e.id === selected.value.id);
      pick(list[Math.max(0, Math.min(list.length - 1, index + direction))]);
    }
    function togglePlay() {
      if (playing.value) { stop(); return; }
      if (cursor.value < start.value || cursor.value >= start.value + span.value) cursor.value = start.value;
      playing.value = true;
      playTimer = setInterval(() => {
        cursor.value = Math.min(cursor.value + 1, start.value + span.value);
        if (cursor.value >= start.value + span.value) stop();
      }, 140);
    }
    function chooseTheme(value: string) {
      theme.value = value; stop();
      syncUrl();
    }
    function bookmark() {
      const id = selected.value.id;
      saved.value = saved.value.includes(id) ? saved.value.filter(v => v !== id) : [...saved.value, id];
      notify(saved.value.includes(id) ? 'הראיה נשמרה למפגש הנוכחי' : 'הראיה הוסרה מהשמורים');
    }
    async function scrollChat() { await nextTick(); chatBody.value?.scrollTo({ top: chatBody.value.scrollHeight, behavior: 'smooth' }); }
    function ask(question = input.value) {
      if (!question.trim() || busy.value) return;
      const attached = attachment.value;
      messages.value.push({ role: 'user', text: question, refs: attached ? [attached.id] : [] });
      input.value = ''; attachment.value = null; busy.value = true; void scrollChat();
      answerTimer = setTimeout(() => {
        let text = 'זו הדגמת ממשק עם תשובות מוכנות. אפשר לשאול על רצף האירוע, על פער 102 השניות, או לצרף ראיה ולבדוק את פרטיה.';
        let refs: string[] = [];
        if (attached) { text = `${attached.title}: ${attached.detail}\n\nמקור מדומה: ${attached.file}, שורה ${attached.line}.`; refs = [attached.id]; }
        else if (/102|פער|תגובה/.test(question)) { text = 'בין קליטת הקוד ב־14:32:00 לפתיחת פרטי המטרה ב־14:33:42 חלפו 102 שניות. זהו הפרש בין שתי רשומות. אין בכך הוכחה מתי המפעיל הבחין באירוע.'; refs = ['EV-106', 'EV-111']; }
        else if (/קרה|רצף|7500|התרע|שירות|סכם/.test(question)) { text = 'קוד 7500 נקלט במערכת IFF. לאחר שנייה תועדה הפסקת שירות; פעולה ידנית תועדה אחרי 102 שניות.\n\nהשערה לבדיקה: ההפסקה השפיעה על מסירת ההתרעה. הרשומות לבדן אינן מוכיחות סיבה.'; refs = ['EV-106', 'EV-107', 'EV-111']; }
        messages.value.push({ role: 'assistant', text, refs }); busy.value = false; void scrollChat();
      }, 500);
    }
    const tool = (Icon: Component, label: string, action: () => void, disabled = false) => <button class="icon-button" aria-label={label} title={label} onClick={action} disabled={disabled}>{h(Icon, { size: 17 })}</button>;
    const cite = (id: string) => <button class="citation" onClick={() => jump(id)}><FileText size={14}/><bdi>{id}</bdi><ArrowUpRight size={13}/></button>;
    const sourceName = (id: SystemId) => systems.find(s => s.id === id)!.name;
    const viewer = () => <LogViewer event={selected.value} entries={visible.value} mode={inspectMode.value} onSelect={pick} onClose={() => { rawOpen.value = false; }} onAttach={event => { attachment.value = event; rawOpen.value = false; mobileTab.value = 'chat'; notify('הראיה צורפה לשאלה הבאה'); }}/ >;
    return () => <div class={['studio', 'log-lab', theme.value, `view-${inspectMode.value}`, { 'viewer-open': rawOpen.value }, `mobile-${mobileTab.value}`]}>
      <header class="topbar" dir="ltr">
        <div class="wordmark"><Activity size={24}/><strong>TRACE</strong></div><span class="header-rule"/>
        <div class="view-switcher" aria-label="Log presentation"><button class="icon-button" aria-label="Previous log view" title="Previous log view" onClick={() => cycleView(-1)}><ChevronLeft size={16}/></button><label><span>LOG VIEW</span><select aria-label="Log view" value={inspectMode.value} onChange={event => chooseView((event.target as HTMLSelectElement).value as LogView)}>{logViews.map((view, i) => <option value={view.id}>{String(i + 1).padStart(2, '0')} · {view.name}</option>)}</select></label><button class="icon-button" aria-label="Next log view" title="Next log view" onClick={() => cycleView(1)}><ChevronRight size={16}/></button></div>
        <div class="palette-switcher" aria-label="Color schemes">{palettes.map(palette => <button aria-label={`Color scheme ${palette.name}`} title={palette.name} aria-pressed={theme.value === palette.id} style={{ '--swatch': palette.color }} onClick={() => chooseTheme(palette.id)}><span/ ><b>{palette.name}</b></button>)}</div>
        <button class="open-log-button" aria-pressed={rawOpen.value} onClick={() => { rawOpen.value = !rawOpen.value; mobileTab.value = 'timeline'; }}><FileText size={15}/><span>{rawOpen.value ? 'סגירת רשומה' : 'פתיחת רשומה'}</span></button>
        <span class="top-purpose" dir="rtl">כל אירוע. המקור שלו.</span><div class="top-end"><span class="demo-label">נתוני הדגמה</span><span dir="rtl">תחקיר <bdi>T-041</bdi></span><span class="date">5 באוקטובר 2026</span></div>
      </header>

      <main class="workspace">
        <section class="overview" aria-label="ציר זמן רחב">
          <div class="overview-heading"><div><h1>מבט על ההקלטה</h1><span class="subtle">כל ההקלטה · 16 שעות · 5 מערכות</span></div><div class="overview-meta"><span class="mono">08:00 — 24:00</span><button class="quiet-button" onClick={focusIncident}><Maximize2 size={14}/>מיקוד באירוע</button></div></div>
          <div class="overview-plot" dir="ltr">
            <div class="histogram">{bins.map((count, i) => <button aria-label={`בחירת חלון סביב ${clock(i * DAY / 144, true)}`} title={`${clock(i * DAY / 144, true)} · ${count} רשומות`} onClick={() => setWindow((i + .5) * DAY / 144 - span.value / 2)} class={[binKinds[i], { 'in-window': i * DAY / 144 <= start.value + span.value && (i + 1) * DAY / 144 >= start.value }]}><span style={{ height: `${count ? Math.max(18, Math.sqrt(count / maxBin) * 100) : 0}%` }}/></button>)}</div>
            <div class={['overview-selection', { 'near-start': start.value < DAY * .1, 'near-end': start.value + span.value / 2 > DAY * .9 }]} style={{ left: `${start.value / DAY * 100}%`, width: `${span.value / DAY * 100}%` }}><span class="selection-label mono">{clock(start.value)} — {clock(start.value + span.value)}</span></div>
          </div>
          <div class="overview-axis mono" dir="ltr">{Array.from({ length: 9 }, (_, i) => <span>{clock(i * 7200, true)}</span>)}</div>
        </section>
        <nav class="mobile-tabs" aria-label="תצוגת סביבת התחקיר"><button aria-pressed={mobileTab.value === 'timeline'} onClick={() => { mobileTab.value = 'timeline'; }}>ציר הזמן</button><button aria-pressed={mobileTab.value === 'chat'} onClick={() => { mobileTab.value = 'chat'; }}>שיחה עם TRACE</button></nav>
        <div class="workbench">
          <div class={["investigation", { "has-sidecar": rawOpen.value && inspectMode.value === "sidecar", "has-dock": rawOpen.value && inspectMode.value === "dock" }]}>
            {!(rawOpen.value && ["focus", "compare"].includes(inspectMode.value)) && <section class="timeline-panel" aria-label="צירי זמן של חמש המערכות">
              <div class="timeline-heading"><div><h2>רצף האירועים</h2><span class="subtle"><bdi class="mono">{clock(start.value)} — {clock(start.value + span.value)}</bdi><span class="divider-dot"> / </span>{visible.value.length} רשומות</span></div><div class="tools" dir="ltr">{inspectMode.value === 'dock' && tool(playing.value ? Pause : Play, playing.value ? 'עצירת ניגון' : 'ניגון רצף האירוע', togglePlay)}{tool(ChevronLeft, 'חלון מוקדם יותר', () => setWindow(start.value - span.value / 2), start.value === 0)}{tool(ZoomIn, 'התקרבות', () => zoom(.5), span.value <= 30)}{tool(ZoomOut, 'התרחקות', () => zoom(2), span.value >= DAY)}{tool(ChevronRight, 'חלון מאוחר יותר', () => setWindow(start.value + span.value / 2), start.value + span.value >= DAY)}<select aria-label="משך חלון הזמן" value={span.value} onChange={e => setWindow(start.value, Number((e.target as HTMLSelectElement).value))}>{![30, 60, 300, 900, DAY].includes(span.value) && <option value={span.value}>{Math.round(span.value / 60)} דקות</option>}<option value="30">30 שניות</option><option value="60">דקה</option><option value="300">5 דקות</option><option value="900">15 דקות</option><option value={DAY}>כל ההקלטה</option></select>{tool(Search, filtersOpen.value ? "סגירת מסננים" : "חיפוש וסינון", () => { filtersOpen.value = !filtersOpen.value; })}</div></div>
              {filtersOpen.value && <div class="filter-row"><label class="search-field"><Search size={15}/><input ref={searchInput} value={query.value} onInput={e => { query.value = (e.target as HTMLInputElement).value; }} placeholder="חיפוש אירוע, מזהה או מערכת…" aria-label="חיפוש אירועים"/>{query.value && tool(X, 'ניקוי חיפוש', () => { query.value = ''; })}</label><button class={['filter-button', { active: alerts.value }]} aria-pressed={alerts.value} onClick={() => { alerts.value = !alerts.value; }}><Filter size={14}/>חריגות בלבד</button></div>}
              <div class="chart-scroll"><div class="chart">
                <div class="axis-row"><div class="time-axis mono">{ticks.value.map((tick, i) => <span style={{ left: `${i * 20}%` }}>{clock(tick)}</span>)}</div><span class="system-axis">מערכת / מקור</span></div>
                <div class="lanes" style={rawOpen.value && inspectMode.value === 'inline' ? { gridTemplateRows: systems.map(system => system.id === selected.value.system ? 'minmax(218px, 2.6fr)' : 'minmax(28px, 1fr)').join(' ') } : {}}>
                  {systems.map(system => <div data-system={system.id} class={['system-row', { muted: hidden.value.includes(system.id), 'inline-expanded': rawOpen.value && inspectMode.value === 'inline' && selected.value.system === system.id }]}>
                    <div class="track" dir="ltr">
                      {ticks.value.map((_, i) => <span class="gridline" style={{ left: `${i * 20}%` }}/>) }
                      {system.id === 'radio' && start.value < INCIDENT + 240 && start.value + span.value > INCIDENT + 180 && <div class="coverage-gap" style={{ left: `${Math.max(0, x(INCIDENT + 180))}%`, width: `${Math.min(100, x(INCIDENT + 240)) - Math.max(0, x(INCIDENT + 180))}%` }} title="כיסוי לא ידוע — היעדר רשומות אינו מצב תקין">כיסוי לא ידוע</div>}
                      {visible.value.filter(event => event.system === system.id).map(event => {
                        const strong = event.id.startsWith('EV-');
                        return <button class={['event', event.severity, { selected: selected.value.id === event.id, strong, duration: !!event.end }]} style={{ left: `${Math.max(0, x(event.time))}%`, ...(event.end ? { width: `${Math.max(.5, Math.min(100, x(event.end)) - Math.max(0, x(event.time)))}%` } : {}), '--stem': `${12 + (event.line % 4) * 5}px` }} aria-label={`${event.id} ${event.title} ${clock(event.time)}`} aria-pressed={selected.value.id === event.id} title={`${event.title} · ${clock(event.time)}`} onClick={() => pick(event)}><span class="event-stem"/><span class="event-dot"/>{selected.value.id === event.id && <span class={['event-label', { 'label-before': x(event.time) > 78 }]}><b>{event.id}</b><span>{clock(event.time)}</span></span>}{event.end && <span class="duration-line"/>}</button>;
                      })}
                      {cursor.value >= start.value && cursor.value <= start.value + span.value && <span class="playhead" style={{ left: `${x(cursor.value)}%` }}/>}
                    </div>
                    <button class="system-label" aria-pressed={!hidden.value.includes(system.id)} aria-label={`${system.name} הצגה או הסתרה`} onClick={() => { hidden.value = hidden.value.includes(system.id) ? hidden.value.filter(s => s !== system.id) : [...hidden.value, system.id]; }}>{h(icons[system.id], { size: 19 })}<span><strong>{system.name}</strong><small>{system.detail}</small></span></button>
                    {rawOpen.value && inspectMode.value === 'inline' && selected.value.system === system.id && viewer()}
                  </div>)}
                </div>
              </div></div>
              {!visible.value.length && <div class="empty-state">אין רשומות בחלון זה לפי המסננים. <button onClick={() => { query.value = ''; alerts.value = false; hidden.value = []; focusIncident(); }}>חזרה לאירוע</button></div>}
              {inspectMode.value !== 'dock' && <div class="transport" dir="ltr"><button class="quiet-button" onClick={() => step(-1)}><ChevronLeft size={15}/>אירוע קודם</button>{tool(playing.value ? Pause : Play, playing.value ? 'עצירת ניגון' : 'ניגון רצף האירוע', togglePlay)}<button class="quiet-button" onClick={() => step(1)}>אירוע הבא<ChevronRight size={15}/></button><b class="mono">{clock(cursor.value)}<small>.000</small></b><span class="subtle">ניגון הדגמה · ×7</span></div>}
            </section>}
            {rawOpen.value && ['sidecar', 'dock', 'focus', 'compare'].includes(inspectMode.value) && viewer()}
            {!(rawOpen.value && ['focus', 'compare'].includes(inspectMode.value)) && <section class="inspector" aria-label="פרטי האירוע הנבחר">
              <button class="selected-summary" onClick={() => { rawOpen.value = true; }} aria-label="רשומת מקור מלאה">
                <span class="selected-meta"><bdi>{selected.value.id}</bdi><span>{sourceName(selected.value.system)}</span><time dir="ltr">{clock(selected.value.time)}</time></span>
                <span class="selected-title">{selected.value.title}<ArrowUpRight size={15}/></span>
              </button>
              <div class="tools">{tool(saved.value.includes(selected.value.id) ? Check : Bookmark, 'שמירת ראיה', bookmark)}<button class="attach-button" onClick={() => { attachment.value = selected.value; mobileTab.value = 'chat'; notify('הראיה צורפה לשאלה הבאה'); }}><Paperclip size={15}/><span>שאלו על האירוע</span></button></div>
            </section>}
          </div>
          <aside class="chat-panel" aria-label="עוזר התחקיר">
            <header class="chat-heading"><div><Activity size={20}/><h2>עוזר התחקיר</h2></div><span class="subtle">T-041</span></header>

            <div class="messages" ref={chatBody} aria-live="polite">{messages.value.map(message => <article class={['message', message.role]}><div class="message-author">{message.role === 'assistant' ? <><Activity size={17}/><strong>TRACE</strong><small>תשובת הדגמה</small></> : <><span class="user-avatar">אני</span><small>השאלה שלכם</small></>}</div><p>{message.text}</p>{message.refs.length > 0 && <div class="citations">{message.refs.map(cite)}</div>}</article>)}{busy.value && <p class="thinking">מציג תשובת הדגמה…</p>}</div>
            <div class="chat-bottom">{attachment.value && <div class="attachment"><Paperclip size={13}/><span>{attachment.value.id} · {attachment.value.title}</span>{tool(X, 'הסרת ראיה מהשאלה', () => { attachment.value = null; })}</div>}<form class="composer" onSubmit={e => { e.preventDefault(); ask(); }}><textarea aria-label="שאלה לעוזר התחקיר" placeholder="שאלו על האירוע, או צרפו ראיה…" rows={2} value={input.value} onInput={e => { input.value = (e.target as HTMLTextAreaElement).value; }} onKeydown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}/><div class="composer-actions"><span>Enter לשליחה</span><button class="send-button" type="submit" aria-label="שליחת שאלה" disabled={!input.value.trim() || busy.value}><ArrowUp size={18}/></button></div></form><p class="prototype-note">נתונים ותשובות מדומים · לבחינת העיצוב בלבד</p></div>
          </aside>
        </div>
        <footer class="workspace-footer"><span>TRACE / {theme.value === 'teal' ? 'OBSIDIAN · TEAL' : 'EDIT BAY · AMBER'}</span><span>תחקיר היסטורי · נתוני הדגמה · UTC+03:00</span></footer>
      </main>
      {rawOpen.value && inspectMode.value === 'modal' && <div class="log-backdrop" onClick={() => { rawOpen.value = false; }}><div class="floating-log" role="dialog" aria-label="רשומת מקור בחלון צף" onClick={event => event.stopPropagation()}>{viewer()}</div></div>}

      {toast.value && <div class="toast" role="status"><Check size={15}/>{toast.value}</div>}
    </div>;
  },
});
createApp(App).mount('#app');
