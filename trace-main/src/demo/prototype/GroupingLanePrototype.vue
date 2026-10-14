<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TimelineGroup, TimelineGroupDetail } from '../types.ts';
import type { layoutTimelineGroups } from '../point-layout.ts';
import type { GroupingVariantKey } from './grouping-variants.ts';
import { timelineLabel } from '../timeline-labels.ts';

type Group = ReturnType<typeof layoutTimelineGroups>[number];
const props = defineProps<{ groups: Group[]; variant: GroupingVariantKey; maxCount: number; selected?: string; loading: boolean; details: Record<string, TimelineGroupDetail>; start: string; end: string }>();
const emit = defineEmits<{ open: [group: TimelineGroup] }>();
const hover = ref<string>();
const expanded = ref(false);
const activities = computed(() => props.groups.filter(group => group.kind === 'activity'));
const signals = computed(() => props.groups.filter(group => group.kind !== 'activity'));
const total = computed(() => activities.value.reduce((sum, group) => sum + group.count, 0));
const active = computed(() => activities.value.find(group => group.id === hover.value));
const max = computed(() => Math.max(1, props.maxCount));
const midpoint = (group: Group) => group.left + group.width / 2;
const ratio = (group: Group) => group.count / max.value;
const diameter = (group: Group) => Math.max(8, 32 * Math.sqrt(ratio(group)));
const time = (value: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const label = (group: Group) => `${group.label} · ${group.count.toLocaleString('he-IL')} רשומות · ${time(group.time)}–${time(group.end)}`;
const layers = (group: Group) => Math.max(2, Math.min(5, Math.ceil(Math.log10(group.count + 1) * 2)));
const dots = (group: Group) => Array.from({ length: Math.ceil(group.count / 10) }, (_, index) => {
  const angle = index * 2.399963; const radius = 2.4 * Math.sqrt(index);
  return { x: 30 + Math.cos(angle) * radius, y: 30 + Math.sin(angle) * radius };
});
const tiles = (group: Group) => Math.max(1, Math.ceil(ratio(group) * 9));
const wave = computed(() => activities.value.map((group, index) => {
  const y = 94 - ratio(group) * 30;
  return `${index ? 'L' : 'M'} ${midpoint(group)} ${y}`;
}).join(' '));
const typeColors = ['#8ad3bd', '#8ebacb', '#bea7d9', '#d6b27c', '#df9d95', '#b6c791', '#a3b1b5'];
const types = computed(() => [...new Set(activities.value.flatMap(group => props.details[group.id]?.series.map(series => series.type) ?? []))].sort());
const typeMarks = computed(() => activities.value.flatMap(group => {
  const map = new Map<string, { type: string; count: number; start: string; end: string }>();
  for (const series of props.details[group.id]?.series ?? []) {
    const existing = map.get(series.type);
    if (existing) { existing.count += series.count; existing.start = existing.start < series.start ? existing.start : series.start; existing.end = existing.end > series.end ? existing.end : series.end; }
    else map.set(series.type, { type: series.type, count: series.count, start: series.start, end: series.end });
  }
  const duration = Date.parse(props.end) - Date.parse(props.start);
  return [...map.values()].map(item => ({ ...item, group, row: types.value.indexOf(item.type),
    left: (Date.parse(item.start) - Date.parse(props.start)) / duration * 100,
    width: (Date.parse(item.end) - Date.parse(item.start)) / duration * 100 }));
}));
function lens(event: PointerEvent) {
  if (props.variant !== '9' || !activities.value.length || event.buttons) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 100;
  hover.value = [...activities.value].sort((a, b) => Math.abs(midpoint(a) - x) - Math.abs(midpoint(b) - x))[0]?.id;
}
function open(group: Group) { if (!props.loading) emit('open', group); }
watch(() => props.variant, () => { hover.value = undefined; expanded.value = false; });
</script>

<template>
  <div class="grouping-lane-prototype" :class="[`grouping-v${variant}`, { 'routine-expanded': expanded }]" @pointermove="lens" @pointerleave="hover = undefined">
    <!-- All event positions and evidence identities are unchanged across variants. -->
    <button v-for="group in signals" :key="group.id" class="prototype-signal" :class="[group.kind, group.severity.toLowerCase(), { selected: selected === group.id }]" :style="{ left: `${group.left}%`, top: `${group.top * .9}%` }" :data-group="group.id" :title="label(group)" :aria-label="label(group)" :disabled="loading" @click="open(group)"><i></i></button>

    <template v-if="variant === '1'">
      <button v-for="group in activities" :key="group.id" class="proto-bubble proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${midpoint(group)}%`, width: `${diameter(group)}px`, height: `${diameter(group)}px` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i></i></button>
    </template>

    <template v-else-if="variant === '2'">
      <button v-for="group in activities" :key="group.id" class="proto-cloud proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${group.left}%`, width: `${group.width}%`, '--strength': .16 + ratio(group) * .64 }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i></i></button>
    </template>

    <template v-else-if="variant === '3'">
      <svg class="proto-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path :d="wave"/></svg>
      <button v-for="group in activities" :key="group.id" class="proto-wave-hit proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${group.left}%`, width: `${group.width}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"></button>
    </template>

    <template v-else-if="variant === '4'">
      <button v-for="group in activities" :key="group.id" class="proto-swarm proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${midpoint(group)}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><svg viewBox="0 0 60 60" aria-hidden="true"><circle v-for="(dot, index) in dots(group)" :key="index" :cx="dot.x" :cy="dot.y" r="1.45"/></svg></button>
    </template>

    <template v-else-if="variant === '5'">
      <button v-for="group in activities" :key="group.id" class="proto-stack proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${midpoint(group)}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i v-for="layer in layers(group)" :key="layer" :style="{ '--layer': layer - 1 }"></i></button>
    </template>

    <template v-else-if="variant === '6'">
      <button v-for="group in activities" :key="group.id" class="proto-bracket proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${group.left}%`, width: `${group.width}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i></i><b></b><i></i></button>
    </template>

    <template v-else-if="variant === '7'">
      <div v-if="types.length" class="prototype-type-key" dir="rtl"><span v-for="(type, index) in types" :key="type" :style="{ color: typeColors[index % typeColors.length] }">{{ timelineLabel(type) }}</span></div>
      <button v-for="mark in typeMarks" :key="`${mark.group.id}-${mark.type}`" class="proto-type proto-hit" :class="{ selected: selected === mark.group.id }" :style="{ left: `${mark.left}%`, width: `${Math.max(.2, mark.width)}%`, top: `${58 + mark.row / Math.max(1, types.length) * 32}%`, color: typeColors[mark.row % typeColors.length] }" :data-group="mark.group.id" :aria-label="`${timelineLabel(mark.type)} · ${mark.count} רשומות · ${time(mark.start)}–${time(mark.end)} · פתיחת הקבוצה`" :title="`${timelineLabel(mark.type)} · ${mark.count} רשומות · ${time(mark.start)}–${time(mark.end)}`" :disabled="loading" @click="open(mark.group)"><i></i><b></b></button>
      <span v-if="activities.length && !types.length" class="prototype-lane-hint">טוען סוגי הודעות…</span>
    </template>

    <template v-else-if="variant === '8'">
      <button v-if="activities.length" class="prototype-routine-toggle" :aria-expanded="expanded" @pointerdown.stop @click="expanded = !expanded"><i>{{ expanded ? '−' : '+' }}</i>{{ expanded ? 'הסתר שגרה' : 'הצג שגרה' }} <b>{{ total.toLocaleString('he-IL') }}</b></button>
      <template v-if="expanded"><button v-for="group in activities" :key="group.id" class="proto-quiet-dot proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${midpoint(group)}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i></i></button></template>
      <div v-else-if="activities.length" class="prototype-quiet-line"></div>
    </template>

    <template v-else-if="variant === '9'">
      <div class="prototype-lens-rail"></div>
      <button v-for="group in activities" :key="group.id" class="proto-lens proto-hit" :class="{ selected: selected === group.id, magnified: hover === group.id }" :style="{ left: `${midpoint(group)}%`, '--diameter': `${diameter(group)}px` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @focus="hover = group.id" @blur="hover = undefined" @click="open(group)"><i></i></button>
      <div v-if="active" class="prototype-lens-caption" :style="{ left: `${Math.max(12, Math.min(88, midpoint(active)))}%` }" dir="rtl">{{ active.count.toLocaleString('he-IL') }} רשומות <time dir="ltr">{{ time(active.time) }}</time></div>
    </template>

    <template v-else-if="variant === '10'">
      <button v-for="group in activities" :key="group.id" class="proto-mosaic proto-hit" :class="{ selected: selected === group.id }" :style="{ left: `${midpoint(group)}%` }" :data-group="group.id" :aria-label="label(group)" :title="label(group)" :disabled="loading" @click="open(group)"><i v-for="tile in 9" :key="tile" :class="{ lit: tile <= tiles(group) }"></i></button>
    </template>
    <span v-if="!groups.length && !loading" class="prototype-lane-hint">אין רשומות בחלון הזה</span>
    <span v-else-if="!activities.length && signals.length && !loading" class="prototype-lane-hint">רשומות בודדות · אין קבוצה מחזורית</span>
  </div>
</template>
