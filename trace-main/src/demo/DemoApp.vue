<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Activity, ArrowLeft, ArrowRight, Check, ChevronDown, Download, FileText, Link2, Search, Send, Square, X, ZoomIn, ZoomOut, Radio, Radar, Monitor, Server, AudioLines, List, BookOpen, ShieldCheck } from 'lucide-vue-next';
import { api, streamChat } from './client.ts';
import MessageBody from './MessageBody.ts';
import CitationLink from './CitationLink.ts';
import { describeCitation } from './citations.ts';
import InvestigationProgress from './InvestigationProgress.vue';
import EvidenceDock from './EvidenceDock.vue';
import { layoutTimelinePoints } from './point-layout.ts';
import { wheelZoomFactor, zoomTimeWindow } from './time-window.ts';
import './messages.css';
import { TIMELINE_SYSTEMS, getTimelineSystem } from './systems.ts';
import type { CaseSession, CaseSummary, ChatMessage, EventPage, EvidenceEvent, InvestigationStep, ProviderStatus, ResolvedSource, TimelineBin, TimelinePoint, TimelinePoints } from './types.ts';

const cases = ref<CaseSummary[]>([]);
const caseId = ref(new URLSearchParams(location.search).get('case') || 'case_001');
const selectedCase = computed(() => cases.value.find((item) => item.id === caseId.value));
const provider = ref<ProviderStatus>();
const session = ref<CaseSession>({ caseId: caseId.value, messages: [], lessons: [] });
const overview = ref<TimelineBin[]>([]);
const detail = ref<TimelinePoints>({ points: [], totalPoints: 0, totalRecords: 0, truncated: false });
const page = ref<EventPage>({ rows: [], total: 0, offset: 0, nextOffset: null });
interface RecordSelection { params: string; page: EventPage }
const pointSelection = ref<RecordSelection>();
const inspectorPage = computed(() => pointSelection.value?.page ?? page.value);
const evidence = ref<ResolvedSource>();
const dockView = ref<'evidence' | 'records' | 'diary' | 'coverage' | null>('evidence');
const filtersOpen = ref(false);
const mobileView = ref<'timeline' | 'chat'>('timeline');
const lanesEl = ref<HTMLElement>();
const trackWidth = ref(800);
let laneObserver: ResizeObserver | undefined;
const laneIcons = { iff: Radio, sensor: Radar, operator: Monitor, services: Server, radio: AudioLines };
const start = ref(''); const end = ref('');
const system = ref('');
const source = ref(''); const target = ref(''); const query = ref(''); const alertsOnly = ref(false); const offset = ref(0);
const loading = ref(true); const error = ref(''); const chatError = ref('');
const draft = ref(''); const tags = ref<string[]>([]); const busy = ref(false);
const progress = ref<InvestigationStep[]>([]); const messagesEl = ref<HTMLElement>(); const draftEl = ref<HTMLTextAreaElement>();
let abort: AbortController | undefined; let queryTimer: ReturnType<typeof setTimeout> | undefined; let requestNumber = 0; let caseRequest = 0; let evidenceRequest = 0;
let wheelTimer: ReturnType<typeof setTimeout> | undefined;
const clock = (value: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const count = (value: number) => new Intl.NumberFormat('he-IL').format(value);
const windowLabel = computed(() => start.value && end.value ? `${clock(start.value)} — ${clock(end.value)}` : '');
const span = computed(() => Date.parse(end.value) - Date.parse(start.value));
const durationValue = computed(() => {
  if ([30_000, 60_000, 300_000, 900_000].includes(span.value)) return span.value;
  if (selectedCase.value && span.value === Date.parse(selectedCase.value.end) - Date.parse(selectedCase.value.start)) return 0;
  return -1;
});
const timeTicks = computed(() => start.value && end.value ? Array.from({ length: 6 }, (_, index) => clock(new Date(Date.parse(start.value) + span.value * index / 5).toISOString())) : []);
const overviewTicks = computed(() => selectedCase.value ? Array.from({ length: 9 }, (_, index) => clock(new Date(Date.parse(selectedCase.value!.start) + (Date.parse(selectedCase.value!.end) - Date.parse(selectedCase.value!.start)) * index / 8).toISOString()).slice(0, 5)) : []);
const activeFilters = computed(() => [system.value, source.value, target.value, query.value, alertsOnly.value].filter(Boolean).length);
const evidenceIndex = computed(() => inspectorPage.value.rows.findIndex((event) => event.badge === evidence.value?.badge));
const evidencePosition = computed(() => evidenceIndex.value < 0 ? '' : `${count(inspectorPage.value.offset + evidenceIndex.value + 1)} / ${count(inspectorPage.value.total)}`);
const canPrevious = computed(() => evidenceIndex.value > 0 || (evidenceIndex.value === 0 && inspectorPage.value.offset > 0));
const canNext = computed(() => evidenceIndex.value >= 0 && (evidenceIndex.value < inspectorPage.value.rows.length - 1 || inspectorPage.value.nextOffset !== null));
const maxBin = computed(() => Math.max(1, ...overview.value.map((bin) => bin.count)));
const availableSources = computed(() => (selectedCase.value?.sources ?? []).filter((entry) => !system.value || getTimelineSystem(system.value).sources.includes(entry)));
const systemLanes = computed(() => TIMELINE_SYSTEMS
  .filter((entry) => (!system.value || entry.id === system.value) && (!source.value || entry.sources.includes(source.value)))
  .map((entry) => ({ ...entry,
    hasData: entry.sources.some((sourceId) => selectedCase.value?.sources.includes(sourceId)),
    points: layoutTimelinePoints(detail.value.points.filter(point => point.system === entry.id && point.time >= start.value && point.time <= end.value), start.value, end.value, trackWidth.value),
  })));
const coverageLimited = computed(() => Boolean(selectedCase.value?.excludedTypes.length || selectedCase.value?.recorderDrops !== 0 || selectedCase.value?.parseErrors.length));
const modeNames: Record<string, string> = { cause: 'תחקיר', health: 'מצב המערכות', timeline: 'סיכום אירועים', signal: 'ניתוח נתונים', evidence_followup: 'בדיקת מקור' };
const suggestions = ['סכם את רצף האירועים סביב הדיווח החריג ביומן המפעיל.', 'אילו מערכות היו לא תקינות בזמן האירוע?', 'חקור מדוע התרחש האירוע שעליו דווח ביומן. בדוק גם הסברים חלופיים.'];

async function refreshProvider() { try { provider.value = await api<ProviderStatus>('/status'); } catch (failure) { error.value = String(failure); } }
function params(withWindow = true) {
  const result = new URLSearchParams({ system: system.value, source: source.value, target: target.value, query: query.value, alertsOnly: String(alertsOnly.value), limit: '80', offset: String(offset.value) });
  if (withWindow) { result.set('start', start.value); result.set('end', end.value); }
  return result;
}
async function loadWindow() {
  clearTimeout(wheelTimer);
  if (!start.value || !selectedCase.value) return false;
  const ticket = ++requestNumber;
  loading.value = true; error.value = '';
  try {
    const base = `/cases/${caseId.value}`;
    const [events, points] = await Promise.all([api<EventPage>(`${base}/events?${params()}`), api<TimelinePoints>(`${base}/timeline-points?${params()}`)]);
    if (ticket !== requestNumber) return false;
    page.value = events; detail.value = points;
    return true;
  } catch (failure) { if (ticket === requestNumber) error.value = String(failure); return false; }
  finally { if (ticket === requestNumber) loading.value = false; }
}
function setWindow(center: number, width: number, deferLoad = false) {
  const current = selectedCase.value; if (!current) return;
  if (!Number.isFinite(center) || !Number.isFinite(width)) return;
  const fullStart = Date.parse(current.start); const fullEnd = Date.parse(current.end);
  const bounded = Math.max(Math.min(15_000, fullEnd - fullStart), Math.min(fullEnd - fullStart, width));
  const left = Math.max(fullStart, Math.min(fullEnd - bounded, center - bounded / 2));
  const nextStart = new Date(left).toISOString(); const nextEnd = new Date(left + bounded).toISOString();
  if (start.value === nextStart && end.value === nextEnd) return;
  start.value = nextStart; end.value = nextEnd; offset.value = 0;
  clearTimeout(wheelTimer);
  if (deferLoad) {
    requestNumber++; loading.value = true;
    wheelTimer = setTimeout(() => { void loadWindow(); }, 90);
  } else void loadWindow();
}
function onTimelineWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (!(event.target instanceof Element) || !event.target.closest('.source-lanes, .timeline-axis')) return;
  const track = lanesEl.value?.querySelector('.lane-track, .lane-no-data');
  const rect = track?.getBoundingClientRect();
  const current = selectedCase.value;
  if (!rect?.width || !current || !start.value || event.clientX < rect.left || event.clientX > rect.right) return;
  event.preventDefault();
  const next = zoomTimeWindow({ start: Date.parse(start.value), end: Date.parse(end.value) },
    { start: Date.parse(current.start), end: Date.parse(current.end) },
    wheelZoomFactor(event.deltaY, event.deltaMode, lanesEl.value?.clientHeight ?? 600),
    (event.clientX - rect.left) / rect.width);
  setWindow((next.start + next.end) / 2, next.end - next.start, true);
}
function focusTime(time: string) { setWindow(Date.parse(time), 300_000); }
function zoom(factor: number) { setWindow((Date.parse(start.value) + Date.parse(end.value)) / 2, span.value * factor); }
function pan(direction: number) { setWindow((Date.parse(start.value) + Date.parse(end.value)) / 2 + direction * span.value / 2, span.value); }
function fullWindow() { if (selectedCase.value) setWindow((Date.parse(selectedCase.value.start) + Date.parse(selectedCase.value.end)) / 2, Date.parse(selectedCase.value.end) - Date.parse(selectedCase.value.start)); }
async function openEvidence(badge: string, scroll = true, selection?: RecordSelection) {
  const ticket = ++evidenceRequest; const activeCase = caseId.value;
  try {
    const result = await api<ResolvedSource>(`/cases/${activeCase}/evidence?badge=${encodeURIComponent(badge)}`);
    if (ticket !== evidenceRequest || activeCase !== caseId.value) return;
    evidence.value = result; pointSelection.value = selection; dockView.value = 'evidence';
    if (scroll) mobileView.value = 'timeline';
    if (scroll) { await nextTick(); document.querySelector('.source-inspector')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  } catch (failure) { error.value = String(failure); }
}
function attach(badge: string) { if (!tags.value.includes(badge) && tags.value.length < 8) tags.value.push(badge); mobileView.value = 'chat'; void nextTick(() => draftEl.value?.focus()); }
async function inspectPoint(point: TimelinePoint) {
  const ticket = ++evidenceRequest; const activeCase = caseId.value;
  const scope = params();
  scope.set('system', point.system); scope.set('start', point.time); scope.set('end', point.time); scope.set('offset', '0');
  try {
    const records = await api<EventPage>(`/cases/${activeCase}/events?${scope}`);
    if (ticket !== evidenceRequest || activeCase !== caseId.value) return;
    await openEvidence(point.badge, true, { params: scope.toString(), page: records });
  } catch (failure) { if (ticket === evidenceRequest) error.value = String(failure); }
}
function resetFilters() { system.value = ''; source.value = ''; target.value = ''; query.value = ''; alertsOnly.value = false; }
function changeDuration(event: Event) { const value = Number((event.target as HTMLSelectElement).value); if (value > 0) setWindow((Date.parse(start.value) + Date.parse(end.value)) / 2, value); else if (value === 0) fullWindow(); }
async function moveEvidence(direction: number) {
  if (loading.value || evidenceIndex.value < 0) return;
  const index = evidenceIndex.value + direction;
  const selection = pointSelection.value;
  if (inspectorPage.value.rows[index]) { await openEvidence(inspectorPage.value.rows[index]!.badge, true, selection); return; }
  const activeCase = caseId.value;
  if (selection) {
    const ticket = ++evidenceRequest;
    const scope = new URLSearchParams(selection.params);
    scope.set('offset', String(direction > 0 ? selection.page.nextOffset ?? selection.page.offset : Math.max(0, selection.page.offset - 80)));
    try {
      const records = await api<EventPage>(`/cases/${activeCase}/events?${scope}`);
      if (ticket !== evidenceRequest || activeCase !== caseId.value) return;
      const event = direction > 0 ? records.rows[0] : records.rows.at(-1);
      if (event) await openEvidence(event.badge, true, { params: scope.toString(), page: records });
    } catch (failure) { if (ticket === evidenceRequest) error.value = String(failure); }
    return;
  }
  offset.value = direction > 0 ? page.value.nextOffset ?? offset.value : Math.max(0, offset.value - 80);
  const loaded = await loadWindow();
  if (!loaded || activeCase !== caseId.value) return;
  const event = direction > 0 ? page.value.rows[0] : page.value.rows.at(-1);
  if (event) await openEvidence(event.badge);
}
function toggleDock(view: Exclude<typeof dockView.value, null>) { dockView.value = dockView.value === view ? null : view; }
async function selectCase() {
  clearTimeout(wheelTimer);
  const ticket = ++caseRequest;
  requestNumber++; evidenceRequest++;
  abort?.abort(); busy.value = false; evidence.value = undefined; dockView.value = 'evidence'; tags.value = []; progress.value = []; chatError.value = ''; error.value = ''; draft.value = '';
  loading.value = true; start.value = ''; end.value = ''; overview.value = []; detail.value = { points: [], totalPoints: 0, totalRecords: 0, truncated: false }; pointSelection.value = undefined;
  system.value = ''; source.value = ''; target.value = ''; query.value = ''; alertsOnly.value = false; offset.value = 0;
  page.value = { rows: [], total: 0, offset: 0, nextOffset: null };
  session.value = { caseId: caseId.value, messages: [], lessons: [] };
  const current = selectedCase.value; if (!current) return;
  const url = new URL(location.href); url.searchParams.set('case', caseId.value); history.replaceState({}, '', url);
  try {
    const [saved, bins] = await Promise.all([api<CaseSession>(`/cases/${caseId.value}/session`), api<TimelineBin[]>(`/cases/${caseId.value}/timeline`)]);
    if (ticket !== caseRequest) return;
    session.value = saved; overview.value = bins;
    const observation = current.diary.find((event) => event.fields.entry_id === 'D-099') ?? current.diary[0];
    focusTime(observation?.time ?? current.start);
    if (observation) void openEvidence(observation.badge, false);
  } catch (failure) { error.value = String(failure); loading.value = false; }
}
async function send(text = draft.value) {
  if (!text.trim() || busy.value) return;
  await refreshProvider();
  if (!provider.value?.configured) { chatError.value = provider.value?.problem ?? 'AI is not configured'; return; }
  const activeCase = caseId.value; const controller = new AbortController(); abort = controller;
  const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: text.trim(), citations: [...tags.value], createdAt: new Date().toISOString() };
  session.value.messages.push(user); draft.value = ''; tags.value = []; busy.value = true; chatError.value = ''; progress.value = [];
  await nextTick(); messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight });
  try {
    const answer = await streamChat(activeCase, user.text, user.citations, controller.signal, (event) => {
      if (caseId.value !== activeCase || !event.step) return;
      const follow = messagesEl.value ? messagesEl.value.scrollHeight - messagesEl.value.scrollTop - messagesEl.value.clientHeight < 80 : true;
      const index = progress.value.findIndex((step) => step.id === event.step!.id);
      if (index < 0) progress.value.push(event.step); else progress.value[index] = event.step;
      if (follow) void nextTick(() => messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight }));
    });
    if (caseId.value === activeCase) session.value.messages.push(answer);
  } catch (failure) {
    if (caseId.value === activeCase) {
      chatError.value = controller.signal.aborted ? 'הבדיקה נעצרה. אפשר לנסות שוב.' : (failure instanceof Error ? failure.message : String(failure));
      draft.value = user.text; tags.value = user.citations;
      session.value.messages = session.value.messages.filter((message) => message.id !== user.id);
    }
  } finally {
    if (abort === controller) { busy.value = false; abort = undefined; }
    await nextTick(); messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight });
  }
}
async function approve(messageId: string) {
  try { session.value = await api<CaseSession>(`/cases/${caseId.value}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }) }); }
  catch (failure) { chatError.value = String(failure); }
}
const approved = (id: string) => session.value.lessons.some((lesson) => lesson.messageId === id);
function selected(event: EvidenceEvent) { return evidence.value?.badge === event.badge; }
watch([source, target, alertsOnly], () => { offset.value = 0; void loadWindow(); });
watch(system, () => {
  if (source.value && !availableSources.value.includes(source.value)) source.value = '';
  offset.value = 0; void loadWindow();
});
watch(query, () => { clearTimeout(queryTimer); queryTimer = setTimeout(() => { offset.value = 0; void loadWindow(); }, 250); });
onMounted(async () => {
  try {
    await refreshProvider(); cases.value = await api<CaseSummary[]>('/cases');
    if (!cases.value.some((item) => item.id === caseId.value)) caseId.value = cases.value[0]!.id;
    await selectCase();
    await nextTick();
    laneObserver = new ResizeObserver(() => {
      const width = lanesEl.value?.querySelector('.lane-track')?.getBoundingClientRect().width;
      if (width) trackWidth.value = width;
    });
    if (lanesEl.value) laneObserver.observe(lanesEl.value);
  } catch (failure) { error.value = String(failure); loading.value = false; }
});
onUnmounted(() => { abort?.abort(); clearTimeout(queryTimer); clearTimeout(wheelTimer); laneObserver?.disconnect(); });
</script>

<template>
  <div class="demo-app jade" :class="`mobile-${mobileView}`" dir="rtl">
    <header class="demo-header">
      <a class="trace-wordmark" href="/" aria-label="TRACE home"><Activity :size="22"/><span>TRACE</span></a>
      <span class="header-divider"></span>
      <label class="case-picker"><span>תחקיר</span><select v-model="caseId" aria-label="בחירת תחקיר" @change="selectCase"><option v-for="item in cases" :key="item.id" :value="item.id">{{ item.id }}</option></select><ChevronDown :size="13"/></label>
      <div class="header-end"><span class="synthetic-label">נתוני סימולציה</span><span class="provider-state" :class="{ ready: provider?.configured }" :title="provider?.model"><i></i>{{ provider?.configured ? 'AI מחובר' : 'נדרש מפתח AI' }}</span><a :href="`/api/cases/${caseId}/export`" class="icon-button" title="ייצוא התחקיר" aria-label="ייצוא התחקיר"><Download :size="16"/></a></div>
    </header>
    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="loadWindow">נסה שוב</button><button aria-label="סגירת הודעת שגיאה" @click="error = ''"><X :size="14"/></button></div>
    <div class="demo-workspace">

      <nav class="mobile-tabs" aria-label="תצוגת סביבת התחקור"><button :aria-pressed="mobileView === 'timeline'" @click="mobileView = 'timeline'">ציר הזמן והמקורות</button><button :aria-pressed="mobileView === 'chat'" @click="mobileView = 'chat'">עוזר התחקיר <span v-if="busy" class="status-dot"></span></button></nav>
      <div class="workbench">
        <main class="investigation-main">
          <section class="overview-section" aria-label="סקירת כל התחקיר">
            <div class="section-line"><h1>מבט על ההקלטה</h1><div class="overview-meta"><span v-if="selectedCase" dir="ltr">{{ clock(selectedCase.start) }} — {{ clock(selectedCase.end) }}</span><button @click="focusTime(selectedCase?.diary.find(note => note.fields.entry_id === 'D-099')?.time ?? selectedCase?.diary[0]?.time ?? selectedCase?.start ?? start)">מיקוד באירוע</button></div></div>
            <div class="overview-chart" dir="ltr"><button v-for="bin in overview" :key="bin.start" :title="`${clock(bin.start)} · ${count(bin.count)} רשומות`" :aria-label="`התמקדות בשעה ${clock(bin.start)}`" :class="{ active: bin.end >= start && bin.start <= end, alert: bin.alerts > 0 }" @click="focusTime(bin.start)"><span :style="{ height: `${Math.max(3, bin.count / maxBin * 100)}%` }"></span></button></div>
            <div class="time-edges" dir="ltr"><span v-for="(tick, index) in overviewTicks" :key="index">{{ tick }}</span></div>
          </section>
          <section class="timeline-section" aria-label="חלון הזמן הנבחר" @wheel="onTimelineWheel">
            <div class="section-line timeline-heading"><div class="timeline-title"><h2>רצף האירועים</h2><span class="window-label" dir="ltr">{{ windowLabel }}</span><span class="record-count">{{ count(page.total) }} רשומות</span></div><div class="timeline-controls" dir="ltr"><button @click="pan(-1)" title="מוקדם יותר" aria-label="מוקדם יותר"><ArrowLeft :size="16"/></button><button @click="zoom(.5)" title="הגדלה" aria-label="הגדלה"><ZoomIn :size="16"/></button><button @click="zoom(2)" title="הקטנה" aria-label="הקטנה"><ZoomOut :size="16"/></button><button @click="pan(1)" title="מאוחר יותר" aria-label="מאוחר יותר"><ArrowRight :size="16"/></button><select aria-label="משך חלון הזמן" :value="durationValue" @change="changeDuration"><option :value="30000">30 שניות</option><option :value="60000">דקה</option><option :value="300000">5 דקות</option><option :value="900000">15 דקות</option><option :value="0">כל ההקלטה</option><option v-if="durationValue === -1" :value="-1" disabled>חלון מותאם</option></select><button @click="fullWindow" title="כל ההקלטה" aria-label="כל ההקלטה">הכול</button><button :aria-expanded="filtersOpen" aria-controls="timeline-filters" :class="{ toggled: activeFilters }" @click="filtersOpen = !filtersOpen" title="חיפוש וסינון" aria-label="חיפוש וסינון"><Search :size="16"/><small v-if="activeFilters">{{ activeFilters }}</small></button></div></div>
            <div v-if="filtersOpen" id="timeline-filters" class="filters"><label class="search-field"><Search :size="14"/><input v-model="query" aria-label="חיפוש ברשומות" placeholder="מזהה, הודעה או שדה…"/><button v-if="query" @click="query = ''" aria-label="ניקוי חיפוש"><X :size="13"/></button></label><select v-model="system" aria-label="סינון מערכת"><option value="">כל המערכות</option><option v-for="item in TIMELINE_SYSTEMS" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="source" aria-label="סינון מקור"><option value="">כל המקורות</option><option v-for="item in availableSources" :key="item">{{ item }}</option></select><select v-model="target" aria-label="סינון מטרה"><option value="">כל המטרות</option><option v-for="item in selectedCase?.targets" :key="item">{{ item }}</option></select><button :class="{ toggled: alertsOnly }" :aria-pressed="alertsOnly" @click="alertsOnly = !alertsOnly">אזהרות ושגיאות</button><button v-if="activeFilters" @click="resetFilters">ניקוי</button></div>
            <div class="timeline-axis" dir="ltr" title="גלגלת למעלה מקרבת, למטה מרחיקה — סביב הסמן"><div><span v-for="(tick, index) in timeTicks" :key="index">{{ tick }}</span></div><span></span></div>
            <div ref="lanesEl" class="source-lanes system-lanes" :aria-busy="loading" aria-description="המיקום האופקי מציין זמן. הגובה מפריד בין רשומות ואינו מייצג ערך מדוד. גלגלת למעלה מקרבת ולמטה מרחיקה סביב הסמן.">
              <div v-for="lane in systemLanes" :key="lane.id" class="source-lane" :data-system="lane.id">
                <div v-if="lane.hasData" class="lane-track" dir="ltr">
                  <button v-for="point in lane.points" :key="point.badge" :data-badge="point.badge" :disabled="loading" :title="`${lane.name} · ${clock(point.time)} · ${point.type}${point.count > 1 ? ` · ${count(point.count)} רשומות באותו זמן` : ''}`" :aria-label="`פתיחת ${point.badge} בשעה ${clock(point.time)}`" :style="{ left: `${point.left}%`, top: `${point.top}%` }" :class="{ populated: true, alert: point.severity === 'WARN', critical: point.severity === 'ERROR', diary: point.diary, selected: evidence?.event && lane.sources.includes(evidence.event.source) && evidence.event.time === point.time }" @click="inspectPoint(point)"><span></span></button>
                </div>
                <div v-else class="lane-no-data">{{ loading ? 'טוען…' : 'לא סופקו נתונים' }}</div>
                <button class="lane-name" :aria-pressed="system === lane.id" :title="lane.sources.join(', ') || 'לא סופקו נתונים'" @click="system = system === lane.id ? '' : lane.id"><span dir="ltr">{{ lane.name }}</span><component :is="laneIcons[lane.id as keyof typeof laneIcons]" :size="16"/></button>
              </div>
              <div v-if="!systemLanes.length" class="empty-records">אין מערכות התואמות למסננים. <button @click="resetFilters">ניקוי מסננים</button></div>
            </div>
            <div class="workspace-tools"><div class="source-tools"><button :aria-pressed="dockView === 'records'" @click="toggleDock('records')"><List :size="13"/>רשומות <span>{{ count(page.total) }}</span></button><button :aria-pressed="dockView === 'diary'" @click="toggleDock('diary')"><BookOpen :size="13"/>יומן המפעיל</button><button :aria-pressed="dockView === 'coverage'" :class="{ 'coverage-warning': coverageLimited }" @click="toggleDock('coverage')"><ShieldCheck :size="13"/>{{ coverageLimited ? 'כיסוי חלקי' : 'כיסוי הקליטה' }}</button><button v-if="evidence && dockView !== 'evidence'" @click="dockView = 'evidence'"><FileText :size="13"/>הרשומה שנבחרה</button></div><span class="timeline-note" :class="{ limited: detail.truncated }">{{ loading ? 'טוען רשומות…' : detail.truncated ? `מוצגות ${count(detail.points.length)} מתוך ${count(detail.totalPoints)} נקודות זמן · התקרבו לפירוט` : 'הזמן בציר האופקי · הגובה מפריד בין רשומות' }}</span></div>
          </section>
          <EvidenceDock v-if="dockView === 'evidence' && evidence" :evidence="evidence" :position="evidencePosition" :previous="canPrevious" :next="canNext" :loading="loading" @attach="attach" @close="dockView = null" @navigate="moveEvidence"/>
          <section v-else-if="dockView && dockView !== 'evidence'" class="bottom-dock data-dock" :aria-label="dockView === 'records' ? 'רשומות המקור' : dockView === 'diary' ? 'יומן המפעיל' : 'כיסוי הקליטה'">
            <header class="dock-header"><h2>{{ dockView === 'records' ? 'רשומות המקור' : dockView === 'diary' ? 'יומן המפעיל' : 'כיסוי הקליטה וקובצי המקור' }}</h2><div v-if="dockView === 'records'" class="pagination"><span>{{ loading ? 'טוען…' : page.total ? `${count(offset + 1)}–${count(offset + page.rows.length)} / ${count(page.total)}` : 'אין תוצאות' }}</span><button :disabled="loading || offset === 0" @click="offset = Math.max(0, offset - 80); loadWindow()">הקודם</button><button :disabled="loading || page.nextOffset === null" @click="offset = page.nextOffset ?? 0; loadWindow()">הבא</button></div><span v-else-if="dockView === 'diary'" class="subtle">זמני דיווח משוערים</span><button class="icon-button" aria-label="סגירת החלונית" @click="dockView = null"><X :size="16"/></button></header>
            <div class="record-pane" tabindex="0">
              <div v-if="dockView === 'records'" class="record-table"><table><thead><tr><th>זמן מקומי</th><th>מקור</th><th>הודעה / אירוע</th><th><span class="sr-only">צירוף</span></th></tr></thead><tbody><tr v-for="event in page.rows" :key="event.id" :class="{ selected: selected(event), warning: event.severity !== 'INFO' }"><td><button class="event-time" @click="openEvidence(event.badge)">{{ clock(event.time) }}</button></td><td dir="ltr">{{ event.source }}</td><td><button class="record-description" @click="openEvidence(event.badge)"><span v-if="event.severity !== 'INFO'" class="severity-mark">{{ event.severity }}</span><span dir="auto">{{ event.text }}</span></button></td><td><button class="icon-button" @click="attach(event.badge)" :aria-label="`צירוף ${event.badge} לשיחה`"><Link2 :size="14"/></button></td></tr></tbody></table><p v-if="!page.rows.length && !loading" class="empty-records">אין רשומות בחלון זה עם המסננים שנבחרו. נסה להרחיב את הזמן או להסיר מסנן.</p></div>
              <div v-else-if="dockView === 'diary'" class="diary-notes"><button v-for="note in selectedCase?.diary" :key="note.id" :class="{ selected: selected(note) }" @click="openEvidence(note.badge)"><span>{{ clock(note.time) }} <small>{{ note.precision }}</small></span><p>{{ note.text }}</p></button><p v-if="!selectedCase?.diary.length" class="empty-records">לא סופק יומן מפעיל לתחקיר זה.</p></div>
              <div v-else-if="selectedCase" class="coverage-details"><div class="case-meta"><span>{{ count(selectedCase.eventCount) }} רשומות</span><span>{{ selectedCase.sources.length }} מקורות</span><span dir="ltr">UTC+03:00</span><span>{{ coverageLimited ? 'כיסוי חלקי' : 'כיסוי מלא לסוגים שנבחרו' }}</span></div><p>סוגי הודעות שלא נכללו: <b>{{ selectedCase.excludedTypes.join(', ') || 'אין' }}</b>. אובדן רשומות ידוע: {{ selectedCase.recorderDrops ?? 'לא ידוע' }}.</p><p v-if="selectedCase.parseErrors.length" class="coverage-warning">{{ selectedCase.parseErrors.length }} רשומות לא נקלטו. אין להסיק היעדר אירועים מנתונים חסרים.</p><div class="file-strip"><button v-for="file in selectedCase.files" :key="file.name" @click="openEvidence(`[${file.name}:L1]`)"><FileText :size="13"/><span>{{ file.name }}</span><small>{{ count(file.records) }}</small></button></div></div>
            </div>
          </section>
        </main>
        <!-- Existing live chat, evidence links, progress and saved conclusions. -->
        <aside class="chat-panel" aria-label="עוזר התחקור"><div class="chat-header"><div><Activity :size="18"/><h2>עוזר התחקיר</h2></div><span dir="ltr">{{ caseId }}</span></div><div class="model-caption" dir="ltr">{{ provider?.model || 'מתחבר…' }}</div>
        <div v-if="provider && !provider.configured" class="setup-notice"><b>חיבור AI עדיין לא הוגדר</b><p>הוסף מפתח ל־<code dir="ltr">trace-main/.env</code>. אפשר לעיין בנתונים כבר עכשיו.</p><button @click="refreshProvider">בדוק חיבור מחדש</button></div>
        <div ref="messagesEl" class="chat-messages" aria-live="polite"><div v-if="!session.messages.length" class="chat-welcome"><div class="trace-orbit"><Activity :size="26"/></div><h3>מאיפה מתחילים?</h3><p>בחר רשומה, צרף אותה לשיחה, או בקש לבדוק מה קרה סביב דיווח המפעיל.</p><button v-for="suggestion in suggestions" :key="suggestion" :disabled="busy || !provider?.configured" @click="send(suggestion)">{{ suggestion }}<ArrowLeft :size="15"/></button></div>
          <article v-for="message in session.messages" :key="message.id" class="chat-message" :class="message.role"><div class="message-role">{{ message.role === 'user' ? 'אתה' : 'TRACE' }}<small v-if="message.role === 'assistant'">{{ modeNames[message.mode || ''] || '' }}</small></div><details v-if="message.activity?.length" class="activity-history"><summary>מהלך הבדיקה · {{ message.activity.filter(step => step.id.startsWith('tool:')).length }} בדיקות</summary><InvestigationProgress :steps="message.activity" :running="false" @citation="openEvidence($event, true)"/></details><MessageBody :text="message.text" @citation="openEvidence($event, true)"/><details v-if="message.details?.length" class="answer-details"><summary>פירוט הבדיקות והמקורות</summary><section v-for="(finding, index) in message.details" :key="index"><h4>{{ finding.title }}</h4><MessageBody :text="finding.explanation" @citation="openEvidence($event, true)"/><div class="detail-citations"><CitationLink v-for="badge in finding.citations" :key="badge" :badge="badge" @open="openEvidence($event, true)"/></div></section></details><div v-if="message.role === 'user' && message.citations.length" class="message-attachments"><CitationLink v-for="badge in message.citations" :key="badge" :badge="badge" @open="openEvidence($event, true)"/></div><div v-if="message.role === 'assistant' && message.validation === 'satisfied'" class="message-actions"><span><Check :size="12"/>אסמכתאות מקור אומתו</span><button :disabled="approved(message.id)" @click="approve(message.id)">{{ approved(message.id) ? 'נשמר במסקנות' : 'אשר ושמור מסקנה' }}</button></div></article>
          <InvestigationProgress v-if="busy || (chatError && progress.length)" :steps="progress" :running="busy" @citation="openEvidence($event, true)"/>
        </div>
        <div class="composer"><div v-if="chatError" class="chat-error" role="alert" dir="auto">{{ chatError }}</div><div v-if="tags.length" class="attachment-chips"><button v-for="badge in tags" :key="badge" @click="tags = tags.filter(value => value !== badge)"><span dir="rtl" :title="badge">{{ describeCitation(badge).label }}</span><X :size="12"/></button></div><textarea ref="draftEl" v-model="draft" aria-label="שאלה לחוקר" placeholder="שאל על האירוע, בקש לבדוק השערה…" :disabled="busy" @keydown.ctrl.enter.prevent="send()" @keydown.meta.enter.prevent="send()"></textarea><div class="composer-footer"><span>{{ session.lessons.length ? `${session.lessons.length} מסקנות שמורות` : '⌘ / Ctrl + Enter לשליחה' }}</span><button v-if="busy" class="send-button stop" @click="abort?.abort()"><Square :size="13"/>עצור</button><button v-else class="send-button" :disabled="!draft.trim() || !provider?.configured" @click="send()"><Send :size="15"/>שלח</button></div></div>
      </aside>
      </div>
    </div>
  </div>
</template>
