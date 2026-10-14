<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowLeft, X } from 'lucide-vue-next';
import type { TimelineGroupDetail } from './types.ts';
import { timelineLabel } from './timeline-labels.ts';

const props = defineProps<{ detail: TimelineGroupDetail; loading: boolean }>();
const emit = defineEmits<{ close: []; open: [badge: string]; page: [offset: number]; series: [id?: string] }>();
const view = ref<'groups' | 'records'>('groups');
const pane = ref<HTMLElement>();
const selectedSeries = computed(() => props.detail.series.find(series => series.id === props.detail.seriesId));
const count = (value: number) => new Intl.NumberFormat('he-IL').format(value);
const clock = (value: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
watch(() => props.detail.group.id, () => { view.value = 'groups'; pane.value?.scrollTo({ top: 0 }); });
watch(() => [props.detail.page.offset, props.detail.seriesId, view.value], () => pane.value?.scrollTo({ top: 0 }));
function chooseSeries(id?: string) { view.value = 'records'; emit('series', id); }
</script>

<template>
  <section class="bottom-dock group-dock" aria-label="רשומות מקובצות">
    <header class="dock-header">
      <div class="dock-identity"><strong>{{ detail.group.label }}</strong><span class="group-total">{{ count(detail.group.count) }} רשומות</span><time dir="ltr">{{ clock(detail.group.time) }} — {{ clock(detail.group.end) }}</time></div>
      <div class="group-views"><button :aria-pressed="view === 'groups'" @click="view = 'groups'">קבוצות</button><button :aria-pressed="view === 'records'" @click="view = 'records'">רשומות המקור</button></div>
      <button class="icon-button" aria-label="סגירת הקבוצה" @click="emit('close')"><X :size="16"/></button>
    </header>
    <div ref="pane" class="record-pane" tabindex="0">
      <template v-if="view === 'groups'">
        <p class="group-explanation">{{ detail.group.kind === 'activity' ? 'עדכונים מחזוריים, לפי מקור, סוג ומטרה. ערכי המדידות עשויים להשתנות; האיחוד אינו מעיד על תקינות.' : 'רשומות מאותו מקור ובאותו תוכן, בחלון הזמן הזה.' }}</p>
        <div class="group-series-list">
          <div v-for="series in detail.series" :key="series.id" class="group-series">
            <button :disabled="loading" @click="chooseSeries(series.id)"><strong>{{ timelineLabel(series.type) }}</strong><bdi v-if="series.target">{{ series.target }}</bdi><span dir="ltr">{{ series.source }}</span><b>{{ count(series.count) }}</b><ArrowLeft :size="13"/></button>
            <details v-if="series.ranges.length"><summary>טווחי מדידות</summary><div class="group-ranges"><div v-for="range in series.ranges" :key="range.field"><span dir="ltr">{{ range.field }}</span><div dir="ltr"><button :disabled="loading" :title="range.minBadge" @click="emit('open', range.minBadge)">{{ range.min }}</button><span> — </span><button :disabled="loading" :title="range.maxBadge" @click="emit('open', range.maxBadge)">{{ range.max }}</button></div></div></div></details>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="group-record-tools"><div v-if="selectedSeries" class="series-selection"><span>{{ timelineLabel(selectedSeries.type) }} <bdi>{{ selectedSeries.target }}</bdi></span><button :disabled="loading" @click="chooseSeries()">כל רשומות המקטע</button></div><span v-else>כל רשומות המקטע</span><div class="pagination"><span>{{ count(detail.page.offset + 1) }}–{{ count(detail.page.offset + detail.page.rows.length) }} / {{ count(detail.page.total) }}</span><button :disabled="loading || detail.page.offset === 0" @click="emit('page', Math.max(0, detail.page.offset - 80))">הקודם</button><button :disabled="loading || detail.page.nextOffset === null" @click="emit('page', detail.page.nextOffset ?? 0)">הבא</button></div></div>
        <div class="record-table"><table><thead><tr><th>זמן</th><th>מקור</th><th>רשומה</th></tr></thead><tbody><tr v-for="event in detail.page.rows" :key="event.id"><td><button class="event-time" :disabled="loading" @click="emit('open', event.badge)">{{ clock(event.time) }}</button></td><td dir="ltr">{{ event.source }}</td><td><button class="record-description" :disabled="loading" @click="emit('open', event.badge)"><span dir="auto">{{ event.text }}</span></button></td></tr></tbody></table></div>
      </template>
    </div>
  </section>
</template>
