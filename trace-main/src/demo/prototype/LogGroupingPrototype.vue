<script setup lang="ts">
// THROWAWAY UI exploration. Same case, filters, groups and evidence actions as TRACE.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { AudioLines, Monitor, Radar, Radio, Server } from 'lucide-vue-next';
import { api } from '../client.ts';
import type { layoutTimelineGroups } from '../point-layout.ts';
import type { TimelineGroup, TimelineGroupDetail } from '../types.ts';
import GroupingLanePrototype from './GroupingLanePrototype.vue';
import PrototypeSwitcher from './PrototypeSwitcher.vue';
import { GROUPING_VARIANTS, type GroupingVariantKey } from './grouping-variants.ts';
import './grouping-prototype.css';

interface Lane { id: string; name: string; sources: readonly string[]; hasData: boolean; groups: ReturnType<typeof layoutTimelineGroups> }
const props = defineProps<{ lanes: Lane[]; start: string; end: string; caseId: string; scope: string; selected?: string; system: string; loading: boolean; total: number; bucketMs: number }>();
const emit = defineEmits<{ open: [group: TimelineGroup]; system: [id: string] }>();
const icons = { iff: Radio, sensor: Radar, operator: Monitor, services: Server, radio: AudioLines };
function fromUrl(): GroupingVariantKey {
  const key = new URLSearchParams(location.search).get('variant')?.replace(/^G/i, '');
  return GROUPING_VARIANTS.find(item => item.key === key)?.key ?? '1';
}
const variant = ref<GroupingVariantKey>(fromUrl());
const details = ref<Record<string, TimelineGroupDetail>>({});
const detailError = ref('');
let request = 0;
const allGroups = computed(() => props.lanes.flatMap(lane => lane.groups));
const activities = computed(() => allGroups.value.filter(group => group.kind === 'activity'));
const maxCount = computed(() => Math.max(1, ...activities.value.map(group => group.count)));
const filterState = computed(() => { const values: Record<string, string> = {}; new URLSearchParams(props.scope).forEach((value, key) => { values[key] = value; }); return values; });
const state = computed(() => ({ variant: variant.value, name: GROUPING_VARIANTS.find(item => item.key === variant.value)!.name,
  case: props.caseId, start: props.start, end: props.end, filters: filterState.value,
  records: props.total, groups: allGroups.value.length, periodicGroups: activities.value.length,
  bucketSeconds: props.bucketMs / 1000, volumeScaleMax: maxCount.value, selectedGroup: props.selected ?? null }));
function change(key: GroupingVariantKey) {
  variant.value = key;
  const url = new URL(location.href); url.searchParams.set('variant', `G${key}`); history.replaceState(null, '', url);
}
function popstate() { variant.value = fromUrl(); }
async function loadTypes() {
  const ticket = ++request;
  detailError.value = '';
  if (variant.value !== '7' || props.loading) return;
  const groups = activities.value.filter(group => !details.value[group.id]);
  let index = 0;
  const caseId = props.caseId; const scope = props.scope;
  // Four bounded read-only requests at a time; exact group-series metadata, no raw dump.
  await Promise.all(Array.from({ length: Math.min(4, groups.length) }, async () => {
    while (index < groups.length && ticket === request) {
      const group = groups[index++]!;
      const params = new URLSearchParams(scope); params.set('group', group.id); params.set('limit', '1'); params.set('offset', '0');
      try {
        const result = await api<TimelineGroupDetail>(`/cases/${caseId}/timeline-group?${params}`);
        if (ticket === request) details.value[group.id] = result;
      } catch { if (ticket === request) { detailError.value = 'לא ניתן לטעון את החלוקה לסוגים. נסו לעבור לחלופה אחרת ולחזור.'; return; } }
    }
  }));
}
watch(() => [props.caseId, props.scope], () => { details.value = {}; });
watch(() => [variant.value, props.loading, props.scope, props.caseId], loadTypes, { immediate: true });
watch(state, value => console.info('[TRACE grouping prototype]', JSON.stringify(value)), { immediate: true });
onMounted(() => window.addEventListener('popstate', popstate));
onUnmounted(() => { request++; window.removeEventListener('popstate', popstate); });
</script>

<template>
  <div class="grouping-prototype" :data-variant="variant">
    <div v-for="lane in lanes" :key="lane.id" class="source-lane" :data-system="lane.id" :class="{ 'prototype-types-lane': variant === '7' }">
      <div v-if="lane.hasData" class="lane-track prototype-track" dir="ltr">
        <GroupingLanePrototype :groups="lane.groups" :variant="variant" :max-count="maxCount" :selected="selected" :loading="loading" :details="details" :start="start" :end="end" @open="emit('open', $event)"/>
      </div>
      <div v-else class="lane-no-data">{{ loading ? 'טוען…' : 'לא סופקו נתונים' }}</div>
      <button class="lane-name" :aria-pressed="system === lane.id" :title="lane.sources.join(', ') || 'לא סופקו נתונים'" @click="emit('system', system === lane.id ? '' : lane.id)"><span dir="ltr">{{ lane.name }}</span><component :is="icons[lane.id as keyof typeof icons]" :size="16"/></button>
    </div>
    <p v-if="detailError" class="prototype-load-error" role="alert">{{ detailError }}</p>
    <PrototypeSwitcher :current="variant" :state="state" @change="change"/>
  </div>
</template>
