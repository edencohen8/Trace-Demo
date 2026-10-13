<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLens, sources, clock, duration, coverageGap, INCIDENT } from './model';
import {
  ChevronLeft, ChevronRight, Minus, Plus, AtSign, Radio, Radar,
  MousePointer2, Server, AudioLines, TriangleAlert, Info, ArrowLeft, ArrowRight,
  Filter, Activity, Link as LinkIcon, Check, Sparkles, Layers
} from 'lucide-vue-next';

const props = defineProps({ mode: { default: 'flat-rails' } });
const { state, visible, setRange, select, attach, incident, relatedIds, related } = useLens();

const root = ref(null), width = ref(800), hover = ref(null), scrubberTime = ref(null);
let observer;

const icons = { messages: Radio, sensor: Radar, operator: MousePointer2, services: Server, voice: AudioLines };
const sourceColors = {
  messages: '#ffd60a',
  sensor: '#30d158',
  operator: '#0a84ff',
  services: '#bf5af2',
  voice: '#ff9f0a'
};

const modeKey = computed(() => {
  const m = props.mode;
  if (m === 'flat-rails' || m === 'quiet' || m === 'L1') return 'flat-rails';
  if (m === 'chips' || m === 'signals' || m === 'L2') return 'chips';
  if (m === 'unified' || m === 'chapters' || m === 'L3') return 'unified';
  if (m === 'state-bands' || m === 'precision' || m === 'L4') return 'state-bands';
  if (m === 'filmstrip' || m === 'review' || m === 'L5') return 'filmstrip';
  if (m === 'correlation-flow' || m === 'connections' || m === 'L6') return 'correlation-flow';
  if (m === 'cards-feed' || m === 'instruments' || m === 'L7') return 'cards-feed';
  if (m === 'metric-ribbons' || m === 'minimal' || m === 'L8') return 'metric-ribbons';
  return 'flat-rails';
});

const modeLabels = {
  'flat-rails': 'אפשרות 1 · סרגלים שטוחים',
  'chips': 'אפשרות 2 · תגיות אירוע שטוחות',
  'unified': 'אפשרות 3 · ציר מאוחד יחיד',
  'state-bands': 'אפשרות 4 · רצועות מצב רציפות',
  'filmstrip': 'אפשרות 5 · סרט דיגיטלי ושנתות',
  'correlation-flow': 'אפשרות 6 · שרשרת קורלציה וזרימה',
  'cards-feed': 'אפשרות 7 · זרם כרטיסים כרונולוגי',
  'metric-ribbons': 'אפשרות 8 · רצועות מדדים ומערכות'
};

const px = t => Math.max(0, Math.min(100, (t - state.start) / state.span * 100));

// Unified stream filter
const unifiedSource = ref('');

// Computed system rows - strictly flat, NO vertical stacking/lanes
const rows = computed(() => sources.map(s => {
  const entries = visible.value.filter(e => e.source === s.id);
  const alerts = entries.filter(e => e.severity !== 'normal').length;
  const criticals = entries.filter(e => e.severity === 'critical').length;
  const durations = entries.filter(e => !!e.end).length;
  const status = criticals > 0 ? 'critical' : (alerts > 0 ? 'warning' : 'normal');
  const statusText = criticals > 0 ? 'תקלה פעילה' : (alerts > 0 ? 'התראה' : 'תקין');
  return { ...s, entries, alerts, criticals, durations, status, statusText };
}));

// Unified visible list
const unifiedVisible = computed(() => {
  const list = visible.value.filter(e => !unifiedSource.value || e.source === unifiedSource.value);
  return [...list].sort((a, b) => a.t - b.t);
});

// Chronological event list for card deck
const chronologicalEvents = computed(() => {
  return [...visible.value].sort((a, b) => a.t - b.t);
});

const activeEventIndex = computed(() => {
  return chronologicalEvents.value.findIndex(e => e.id === state.selectedId);
});

function stepEvent(direction) {
  const list = chronologicalEvents.value;
  if (!list.length) return;
  const cur = activeEventIndex.value;
  let next = cur + direction;
  if (cur < 0) next = direction > 0 ? 0 : list.length - 1;
  else if (next < 0) next = list.length - 1;
  else if (next >= list.length) next = 0;
  select(list[next].id);
}

const majorStep = computed(() => [5, 10, 15, 30, 60, 120, 300, 600].find(s => s >= state.span / Math.max(2, Math.floor(width.value / 100))) || 600);
const ticks = computed(() => {
  const step = majorStep.value / 5;
  const list = [];
  for (let t = Math.ceil(state.start / step) * step; t <= state.start + state.span; t += step) {
    list.push({ t, major: Math.abs(t / majorStep.value - Math.round(t / majorStep.value)) < .001 });
  }
  return list;
});

const totalAlerts = computed(() => visible.value.filter(e => e.severity !== 'normal').length);
const selected = computed(() => visible.value.find(e => e.id === state.selectedId) || recordsAll.find(e => e.id === state.selectedId));
const cursor = computed(() => selected.value);

function click(e, event) {
  select(e.id, !event.shiftKey);
  if (event.shiftKey) attach(e.id);
}

function move(amount) {
  setRange(state.start + amount, state.span);
}

function zoom(factor) {
  const span = Math.max(30, Math.min(1800, state.span * factor));
  setRange(state.start + (state.span - span) / 2, span);
}

function onTrackMouseMove(event) {
  if (!root.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  scrubberTime.value = state.start + ratio * state.span;
}

function onTrackMouseLeave() {
  scrubberTime.value = null;
}

// Correlation links between related records across lanes
const correlationLines = computed(() => {
  if (modeKey.value !== 'correlation-flow' || !selected.value) return [];
  const cur = selected.value;
  const curSourceIdx = sources.findIndex(s => s.id === cur.source);
  if (curSourceIdx < 0) return [];
  const curX = px(cur.t);
  const curY = curSourceIdx * 54 + 27; // middle of row

  return related.value.map(rel => {
    const relSourceIdx = sources.findIndex(s => s.id === rel.source);
    if (relSourceIdx < 0) return null;
    const relX = px(rel.t);
    const relY = relSourceIdx * 54 + 27;
    return {
      id: rel.id,
      title: rel.title,
      x1: curX,
      y1: curY,
      x2: relX,
      y2: relY,
      isSameMessage: cur.raw?.message_id && cur.raw.message_id === rel.raw?.message_id
    };
  }).filter(Boolean);
});

onMounted(() => {
  observer = new ResizeObserver(() => {
    width.value = root.value?.querySelector('.dots-track')?.clientWidth || 800;
  });
  if (root.value) observer.observe(root.value);
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <section ref="root" class="lens-detail focus-middle-study" :class="'middle-' + modeKey" aria-label="ציר מפורט לפי מערכת">
    <!-- Header with Window Context and Controls -->
    <header class="detail-heading">
      <div>
        <span class="section-label">{{ modeLabels[modeKey] }}</span>
        <h2 dir="ltr">{{ clock(state.start) }} <span>—</span> {{ clock(state.start + state.span) }}</h2>
        <small>
          {{ duration(state.span) }} · {{ visible.length }} רשומות
          <span v-if="totalAlerts">· {{ totalAlerts }} מסומנות לבדיקה</span>
          <span class="flat-badge">ציר שטוח ואחיד · ללא היסט גובה</span>
        </small>
      </div>
      <div class="lens-controls glass">
        <button @click="move(-state.span / 2)" aria-label="חלון קודם"><ChevronLeft/></button>
        <button @click="zoom(.5)" aria-label="הגדלה"><Plus/></button>
        <button @click="zoom(2)" aria-label="הקטנה"><Minus/></button>
        <button @click="move(state.span / 2)" aria-label="חלון הבא"><ChevronRight/></button>
        <button class="text-control" @click="incident">האירוע</button>
      </div>
    </header>

    <!-- Shared Time Ruler Axis -->
    <div class="dot-axis">
      <span>{{ modeKey === 'unified' ? 'ציר מאוחד' : 'מערכת מקור' }}</span>
      <div class="time-ruler" dir="ltr" @mousemove="onTrackMouseMove" @mouseleave="onTrackMouseLeave">
        <span v-for="tick in ticks" :key="tick.t" class="ruler-tick" :class="{ major: tick.major, edgeStart: px(tick.t) < 3, edgeEnd: px(tick.t) > 97 }" :style="{ left: px(tick.t) + '%' }">
          <time v-if="tick.major">{{ clock(tick.t) }}</time>
        </span>
        <!-- Selected cursor needle -->
        <span v-if="cursor" class="ruler-needle selected-needle" :style="{ left: px(cursor.t) + '%' }">
          <b>{{ clock(cursor.t) }}</b>
        </span>
        <!-- Live hover scrubber needle -->
        <span v-if="scrubberTime !== null && modeKey === 'filmstrip'" class="ruler-needle hover-needle" :style="{ left: px(scrubberTime) + '%' }">
          <b>{{ clock(scrubberTime) }}<small v-if="selected"> ({{ Math.round(scrubberTime - selected.t) >= 0 ? '+' : '' }}{{ Math.round(scrubberTime - selected.t) }}s)</small></b>
        </span>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 1: סרגלים שטוחים (Flat Baseline Rails)                 -->
    <!-- ============================================================== -->
    <div v-if="modeKey === 'flat-rails'" class="middle-variant-container option-flat-rails">
      <div class="system-lanes">
        <div v-for="s in rows" :key="s.id" class="system-lane flat-lane">
          <div class="system-identity">
            <component :is="icons[s.id]"/>
            <div>
              <strong>{{ s.label }}</strong>
              <small>{{ s.entries.length }} רשומות<span v-if="s.alerts"> · {{ s.alerts }} חריגות</span></small>
            </div>
          </div>
          <div class="dots-track flat-track" dir="ltr">
            <!-- Gridlines -->
            <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
            <!-- Flat baseline rail with arrowhead -->
            <div class="flat-baseline-rail"></div>
            <!-- Vertical cursor -->
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
            <!-- Sensor coverage gap -->
            <div v-if="s.id === 'sensor' && state.start < coverageGap.end && state.start + state.span > coverageGap.start" class="coverage-gap flat-gap" :style="{ left: px(coverageGap.start) + '%', width: (px(coverageGap.end) - px(coverageGap.start)) + '%' }">
              <span>חסר קובץ מקור</span>
            </div>
            <!-- Flat duration spans -->
            <template v-for="e in s.entries" :key="'dur-' + e.id">
              <div v-if="e.end" class="flat-duration-bar" :class="{ alert: e.severity !== 'normal', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%', width: Math.max(4, (px(e.end) - px(e.t)) * width / 100) + 'px' }" @click="click(e, $event)">
                <span class="duration-label" v-if="(px(e.end) - px(e.t)) * width / 100 > 36">{{ duration(e.end - e.t) }}</span>
              </div>
            </template>
            <!-- Flat data points (centered on rail, NO height stems) -->
            <template v-for="e in s.entries" :key="e.id">
              <button class="flat-point" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id, attached: state.tags.includes(e.id) }" :style="{ left: px(e.t) + '%' }" :aria-label="clock(e.t) + ' · ' + e.title" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
                <span class="flat-point-glyph">{{ e.severity === 'critical' ? '✕' : (e.severity === 'warning' ? '!' : '') }}</span>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 2: תגיות אירוע שטוחות (Event Chips)                    -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'chips'" class="middle-variant-container option-chips">
      <div class="system-lanes">
        <div v-for="s in rows" :key="s.id" class="system-lane chips-lane">
          <div class="system-identity">
            <component :is="icons[s.id]"/>
            <div>
              <strong>{{ s.label }}</strong>
              <small>{{ s.entries.length }} רשומות</small>
            </div>
          </div>
          <div class="dots-track chips-track" dir="ltr">
            <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
            <div class="chips-baseline-wire"></div>
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
            <!-- Sensor gap -->
            <div v-if="s.id === 'sensor' && state.start < coverageGap.end && state.start + state.span > coverageGap.start" class="coverage-gap chips-gap" :style="{ left: px(coverageGap.start) + '%', width: (px(coverageGap.end) - px(coverageGap.start)) + '%' }">
              <span>פער ראיות · קובץ חסר</span>
            </div>
            <!-- Inline chips -->
            <div v-for="e in s.entries" :key="e.id" class="chip-item-wrapper" :style="{ left: px(e.t) + '%' }">
              <button class="inline-event-chip" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id, hasDuration: !!e.end }" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
                <span class="chip-pip" :class="e.severity"></span>
                <span class="chip-id">{{ e.id }}</span>
                <span class="chip-title">{{ e.title }}</span>
                <span v-if="e.end" class="chip-dur">{{ Math.round(e.end - e.t) }}s</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 3: ציר מאוחד יחיד (Unified Chrono-Stream)              -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'unified'" class="middle-variant-container option-unified">
      <!-- Filter chips for unified track -->
      <div class="unified-filters">
        <span class="filters-title"><Filter/> סינון מקור:</span>
        <button class="unified-filter-pill" :class="{ active: !unifiedSource }" @click="unifiedSource = ''">
          כל 5 המערכות ({{ visible.length }})
        </button>
        <button v-for="s in sources" :key="s.id" class="unified-filter-pill" :class="{ active: unifiedSource === s.id }" :style="{ '--pill-color': sourceColors[s.id] }" @click="unifiedSource = unifiedSource === s.id ? '' : s.id">
          <span class="pill-dot"></span>
          {{ s.label }} ({{ visible.filter(e => e.source === s.id).length }})
        </button>
      </div>

      <!-- Single master rail -->
      <div class="unified-track-wrapper">
        <div class="dots-track unified-track" dir="ltr">
          <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
          <div class="unified-master-rail"></div>
          <div v-if="cursor" class="shared-cursor unified-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
          <!-- Events on single rail -->
          <div v-for="e in unifiedVisible" :key="e.id" class="unified-event-node" :style="{ left: px(e.t) + '%' }">
            <button class="unified-node-btn" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id }" :style="{ '--node-color': sourceColors[e.source] }" :title="clock(e.t) + ' · ' + e.title" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
              <span class="node-icon"><component :is="icons[e.source]"/></span>
              <span class="node-badge">{{ e.id }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="unified-legend">
        <span>סדר כרונולוגי רציף על ציר יחיד · צבע מייצג מערכת מקור · ללא פיצול מסלולים</span>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 4: רצועות מצב רציפות (State Bands)                     -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'state-bands'" class="middle-variant-container option-state-bands">
      <div class="system-lanes">
        <div v-for="s in rows" :key="s.id" class="system-lane band-lane">
          <div class="system-identity">
            <component :is="icons[s.id]"/>
            <div>
              <strong>{{ s.label }}</strong>
              <small :class="s.status">{{ s.statusText }}</small>
            </div>
          </div>
          <div class="dots-track band-track" dir="ltr">
            <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
            <!-- Continuous state ribbon base -->
            <div class="state-ribbon-base" :class="s.status"></div>
            <!-- Outage / alert segments within the ribbon -->
            <template v-for="e in s.entries" :key="'outage-' + e.id">
              <div v-if="e.end && e.severity !== 'normal'" class="state-ribbon-outage" :style="{ left: px(e.t) + '%', width: Math.max(8, (px(e.end) - px(e.t)) * width / 100) + 'px' }" :class="e.severity" @click="click(e, $event)">
                <span class="outage-tag">{{ e.title }} ({{ Math.round(e.end - e.t) }} שנ׳)</span>
              </div>
            </template>
            <!-- Coverage gap on sensor -->
            <div v-if="s.id === 'sensor' && state.start < coverageGap.end && state.start + state.span > coverageGap.start" class="coverage-gap band-gap" :style="{ left: px(coverageGap.start) + '%', width: (px(coverageGap.end) - px(coverageGap.start)) + '%' }">
              <span>פער מקור</span>
            </div>
            <!-- Precision slice ticks cutting through ribbon -->
            <button v-for="e in s.entries" :key="e.id" class="band-slice-tick" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%' }" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
              <span class="slice-head"></span>
            </button>
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 5: סרט דיגיטלי ושנתות שניות (Digital Filmstrip)        -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'filmstrip'" class="middle-variant-container option-filmstrip">
      <div class="system-lanes">
        <div v-for="s in rows" :key="s.id" class="system-lane film-lane">
          <div class="system-identity">
            <component :is="icons[s.id]"/>
            <div>
              <strong>{{ s.label }}</strong>
              <small>{{ s.entries.length }} דגימות</small>
            </div>
          </div>
          <div class="dots-track film-track" dir="ltr" @mousemove="onTrackMouseMove" @mouseleave="onTrackMouseLeave">
            <!-- Second raster micro-gridlines -->
            <span v-for="tick in ticks" :key="tick.t" class="film-micro-tick" :class="{ major: tick.major }" :style="{ left: px(tick.t) + '%' }"></span>
            <div class="film-time-tape"></div>
            <!-- Sensor gap -->
            <div v-if="s.id === 'sensor' && state.start < coverageGap.end && state.start + state.span > coverageGap.start" class="coverage-gap film-gap" :style="{ left: px(coverageGap.start) + '%', width: (px(coverageGap.end) - px(coverageGap.start)) + '%' }">
              <span>פער נתונים</span>
            </div>
            <!-- Durations as clean raster blocks -->
            <template v-for="e in s.entries" :key="'film-dur-' + e.id">
              <div v-if="e.end" class="film-dur-block" :class="{ alert: e.severity !== 'normal', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%', width: Math.max(4, (px(e.end) - px(e.t)) * width / 100) + 'px' }" @click="click(e, $event)"></div>
            </template>
            <!-- Vertical pulse spikes -->
            <button v-for="e in s.entries" :key="e.id" class="film-pulse" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%' }" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
              <span class="pulse-bar"></span>
            </button>
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
            <div v-if="scrubberTime !== null" class="shared-cursor film-scrubber-cursor" :style="{ left: px(scrubberTime) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 6: שרשרת קורלציה וזרימת הודעות (Correlation Flow)     -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'correlation-flow'" class="middle-variant-container option-correlation">
      <!-- Correlation Banner -->
      <div class="correlation-header-bar">
        <div class="corr-tag">
          <LinkIcon/>
          <span>מזהה קורלציה פעיל:</span>
          <strong>{{ selected?.raw?.message_id ? selected.raw.message_id : (selected?.target || 'T-041') }}</strong>
        </div>
        <div class="corr-actions">
          <span v-if="related.length">{{ related.length }} רשומות מקושרות ברצף</span>
          <button v-if="selected" class="corr-attach-all" @click="attach(selected.id)">
            <AtSign/> צרף את שרשרת הראיות
          </button>
        </div>
      </div>

      <div class="system-lanes correlation-lanes-relative">
        <!-- SVG connecting arcs between related points -->
        <svg v-if="correlationLines.length" class="correlation-svg-overlay" dir="ltr">
          <path v-for="line in correlationLines" :key="line.id" :d="`M ${line.x1}% ${line.y1}px C ${(line.x1 + line.x2) / 2}% ${line.y1}px, ${(line.x1 + line.x2) / 2}% ${line.y2}px, ${line.x2}% ${line.y2}px`" :class="{ 'same-msg': line.isSameMessage }"/>
        </svg>

        <div v-for="s in rows" :key="s.id" class="system-lane corr-lane">
          <div class="system-identity">
            <component :is="icons[s.id]"/>
            <div>
              <strong>{{ s.label }}</strong>
              <small>{{ s.entries.length }} רשומות</small>
            </div>
          </div>
          <div class="dots-track corr-track" dir="ltr">
            <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
            <div class="corr-baseline-rail"></div>
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
            <!-- Points: Highlight correlated ones, dim unrelated ones -->
            <button v-for="e in s.entries" :key="e.id" class="corr-point" :class="{ alert: e.severity !== 'normal', selected: state.selectedId === e.id, related: relatedIds.includes(e.id), dimmed: selected && e.id !== selected.id && !relatedIds.includes(e.id) }" :style="{ left: px(e.t) + '%' }" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
              <span class="corr-point-core">{{ e.severity !== 'normal' ? '!' : '' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 7: זרם כרטיסים כרונולוגי (Event Cards Deck)            -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'cards-feed'" class="middle-variant-container option-cards-feed">
      <!-- Mini multi-lane flat strip on top -->
      <div class="cards-mini-lanes">
        <div v-for="s in rows" :key="s.id" class="mini-lane">
          <span class="mini-source-label">{{ s.label.split(' ')[0] }}</span>
          <div class="mini-track" dir="ltr">
            <div class="mini-rail"></div>
            <span v-for="e in s.entries" :key="e.id" class="mini-dot" :class="{ alert: e.severity !== 'normal', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%' }" @click="click(e, $event)"></span>
            <div v-if="cursor" class="shared-cursor mini-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Stepper Controls & Chronological Card Deck -->
      <div class="cards-deck-header">
        <div class="deck-title">
          <span>רצף אירועים כרונולוגי ({{ chronologicalEvents.length }} רשומות בחלון)</span>
          <span v-if="activeEventIndex >= 0" class="active-step-num">אירוע {{ activeEventIndex + 1 }} מתוך {{ chronologicalEvents.length }}</span>
        </div>
        <div class="deck-nav-buttons">
          <button class="step-btn" @click="stepEvent(-1)"><ArrowRight/> האירוע הקודם</button>
          <button class="step-btn" @click="stepEvent(1)">האירוע הבא <ArrowLeft/></button>
        </div>
      </div>

      <div class="horizontal-card-deck">
        <div v-for="e in chronologicalEvents" :key="e.id" class="chrono-event-card" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id }" @click="click(e, $event)">
          <div class="card-top">
            <time>{{ clock(e.t) }}</time>
            <span class="card-source-tag"><component :is="icons[e.source]"/> {{ sources.find(s => s.id === e.source)?.label.split(' ')[0] }}</span>
            <span v-if="e.severity !== 'normal'" class="card-severity-badge">{{ e.severity === 'critical' ? 'קריטי' : 'חריג' }}</span>
          </div>
          <div class="card-body">
            <strong>{{ e.title }}</strong>
            <small>{{ e.detail || e.target }}</small>
          </div>
          <div class="card-footer">
            <code>{{ e.id }}</code>
            <span v-if="e.end" class="card-duration">משך: {{ Math.round(e.end - e.t) }}s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- OPTION 8: רצועות מדדים ומערכות (Metric Header Ribbons)        -->
    <!-- ============================================================== -->
    <div v-else-if="modeKey === 'metric-ribbons'" class="middle-variant-container option-metric-ribbons">
      <div class="system-lanes">
        <div v-for="s in rows" :key="s.id" class="system-lane metric-lane">
          <div class="metric-identity-panel">
            <div class="metric-panel-main">
              <component :is="icons[s.id]"/>
              <div>
                <strong>{{ s.label }}</strong>
                <span class="metric-badge" :class="s.status">{{ s.statusText }}</span>
              </div>
            </div>
            <div class="metric-telemetry">
              <span>{{ s.entries.length }} רשומות</span>
              <span v-if="s.alerts" class="alert-count">{{ s.alerts }} חריגים</span>
            </div>
          </div>
          <div class="dots-track metric-track-channel" dir="ltr">
            <span v-for="tick in ticks.filter(t => t.major)" :key="tick.t" class="track-gridline" :style="{ left: px(tick.t) + '%' }"></span>
            <div class="metric-channel-base"></div>
            <div v-if="cursor" class="shared-cursor" :style="{ left: px(cursor.t) + '%' }"></div>
            <!-- Sensor gap -->
            <div v-if="s.id === 'sensor' && state.start < coverageGap.end && state.start + state.span > coverageGap.start" class="coverage-gap metric-gap" :style="{ left: px(coverageGap.start) + '%', width: (px(coverageGap.end) - px(coverageGap.start)) + '%' }">
              <span>חסר קובץ מקור</span>
            </div>
            <!-- Duration spans -->
            <template v-for="e in s.entries" :key="'metric-dur-' + e.id">
              <div v-if="e.end" class="metric-dur-pill" :class="{ alert: e.severity !== 'normal', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%', width: Math.max(8, (px(e.end) - px(e.t)) * width / 100) + 'px' }" @click="click(e, $event)">
                <span>{{ duration(e.end - e.t) }}</span>
              </div>
            </template>
            <!-- Distinct flat geometric glyphs -->
            <button v-for="e in s.entries" :key="e.id" class="metric-point-glyph" :class="{ alert: e.severity !== 'normal', critical: e.severity === 'critical', selected: state.selectedId === e.id }" :style="{ left: px(e.t) + '%' }" @click="click(e, $event)" @mouseenter="hover = e" @mouseleave="hover = null">
              <span class="glyph-shape"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Common Footer Legend & Controls (Strictly Flat - No collision height caption) -->
    <div class="plot-caption">
      <div>
        <span class="normal-example"></span> רשומת מידע
        <span class="alert-example">!</span> חריג לבדיקה
        <span class="duration-example"></span> משך זמן פעיל
      </div>
      <span>ציר זמן כרונולוגי שטוח ואחיד · ללא היסט גובה מלאכותי · Shift + לחיצה: צירוף לצ׳אט</span>
    </div>

    <!-- Hover Readout Bubble -->
    <div v-if="hover" class="hover-readout" aria-live="polite">
      <b>{{ hover.title }}</b>
      <span>{{ clock(hover.t) }} · {{ hover.target }}{{ hover.end ? ' · ' + duration(hover.end - hover.t) : '' }}</span>
      <small v-if="hover.severity !== 'normal'">סומן {{ hover.severity === 'critical' ? 'קריטי' : 'חריג' }} במקור המדומה</small>
    </div>

    <!-- Selected Point Actions Bar -->
    <div v-if="selected" class="point-actions">
      <div>
        <span class="section-label">נבחר</span>
        <strong>{{ selected.title }}</strong>
        <code>{{ selected.id }}</code>
        <small v-if="selected.raw?.message_id">מזהה הודעה: {{ selected.raw.message_id }}</small>
      </div>
      <button class="attach-point" @click="attach(selected.id)">
        <AtSign/> {{ state.tags.includes(selected.id) ? 'צורף לצ׳אט' : 'צירוף לצ׳אט' }}
      </button>
    </div>

    <p v-if="!visible.length" class="lens-empty">אין פריטים בחלון תחת הסינון הנוכחי.</p>
  </section>
</template>