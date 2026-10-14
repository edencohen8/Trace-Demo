<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Check, Circle, LoaderCircle, TriangleAlert } from 'lucide-vue-next';
import type { InvestigationStep } from './types.ts';
import CitationLink from './CitationLink.ts';
import { visibleInvestigationSteps } from './progress-order.ts';

const props = defineProps<{ steps: InvestigationStep[]; running: boolean }>();
const emit = defineEmits<{ citation: [badge: string] }>();
const expanded = ref(false);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
watch(() => props.running, (running) => {
  clearInterval(timer); now.value = Date.now();
  if (running) timer = setInterval(() => { now.value = Date.now(); }, 1000);
}, { immediate: true });
onUnmounted(() => clearInterval(timer));
const visible = computed(() => visibleInvestigationSteps(props.steps, props.running, expanded.value));
const completed = computed(() => props.steps.filter((step) => step.id.startsWith('tool:') && step.state === 'complete').length);
const settledCount = computed(() => props.steps.filter((step) => step.state !== 'running').length);
const pendingCount = computed(() => props.steps.filter((step) => step.id.startsWith('tool:') && step.state === 'running').length);
const elapsed = computed(() => {
  const first = props.steps[0]?.startedAt ?? now.value;
  const last = props.running ? now.value : Math.max(first, ...props.steps.map((step) => step.completedAt ?? step.startedAt));
  const seconds = Math.max(0, Math.floor((last - first) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
</script>

<template>
  <div class="investigation-progress" :class="{ active: running }" dir="rtl">
    <div class="activity-heading"><span>{{ running ? 'מה נבדק עכשיו' : 'מהלך הבדיקה' }}</span><span class="activity-time" dir="ltr" aria-hidden="true">{{ elapsed }}</span></div>
    <TransitionGroup name="activity" tag="ol" class="activity-steps">
      <li v-for="step in visible" :key="step.id" :class="step.state" :data-step-id="step.id">
        <span class="activity-symbol"><LoaderCircle v-if="step.state === 'running' && running" :size="13" class="activity-spinner"/><TriangleAlert v-else-if="step.state === 'error'" :size="13"/><Check v-else-if="step.state === 'complete'" :size="13"/><Circle v-else :size="12"/></span>
        <div class="activity-copy"><p class="activity-title">{{ step.title }}</p><p v-if="step.detail" class="activity-detail">{{ step.detail }}</p><div v-if="step.citations?.length" class="activity-evidence"><CitationLink v-for="badge in step.citations.slice(0, 3)" :key="badge" :badge="badge" @open="emit('citation', $event)"/><details v-if="step.citations.length > 3"><summary>עוד {{ step.citations.length - 3 }} מקורות</summary><CitationLink v-for="badge in step.citations.slice(3)" :key="badge" :badge="badge" @open="emit('citation', $event)"/></details></div></div>
      </li>
    </TransitionGroup>
    <div class="activity-footer"><span><span v-if="completed">{{ completed }} בדיקות הושלמו</span><span v-if="running && pendingCount > 1"> · {{ pendingCount }} בתהליך</span></span><button v-if="settledCount > 3" @click="expanded = !expanded">{{ expanded ? 'הצג פחות' : 'הצג שלבים קודמים' }}</button></div>
  </div>
</template>
