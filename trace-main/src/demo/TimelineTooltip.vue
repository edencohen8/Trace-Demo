<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, useId, watch } from 'vue';
import { getTimelineSystem } from './systems.ts';
import { timelineLabel } from './timeline-labels.ts';
import type { TimelineGroup, TimelinePoint } from './types.ts';

const props = defineProps<{ disabled: boolean }>();
const id = useId();
const tooltip = ref<HTMLElement>();
const anchor = shallowRef<HTMLElement>();
const item = shallowRef<TimelinePoint | TimelineGroup>();
const visible = ref(false);
const position = ref({ left: '0px', top: '0px' });
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const group = computed(() => item.value && 'kind' in item.value ? item.value : undefined);
const activity = computed(() => group.value?.kind === 'activity');
const title = computed(() => group.value?.label ?? (item.value ? timelineLabel(item.value.type) : ''));
const count = (value: number) => new Intl.NumberFormat('he-IL').format(value);
const clock = (value: string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const severity = { INFO: 'מידע', WARN: 'אזהרה', ERROR: 'שגיאה' };
const action = computed(() => item.value && item.value.count > 1
  ? group.value ? 'לחצו להצגת הרשומות במקטע' : 'לחצו להצגת הרשומות באותו זמן'
  : 'לחצו להצגת הרשומה המקורית');

function hide() {
  clearTimeout(showTimer); clearTimeout(hideTimer);
  anchor.value?.removeAttribute('aria-describedby');
  visible.value = false; item.value = undefined; anchor.value = undefined;
}

function show(event: PointerEvent | FocusEvent, point: TimelinePoint | TimelineGroup) {
  if (props.disabled || !(event.currentTarget instanceof HTMLElement)) return;
  if (event instanceof PointerEvent && (event.pointerType === 'touch' || event.buttons)) return;
  if (event instanceof FocusEvent && !event.currentTarget.matches(':focus-visible')) return;
  hide();
  anchor.value = event.currentTarget; item.value = point;
  showTimer = setTimeout(async () => {
    if (!anchor.value?.isConnected || props.disabled) { hide(); return; }
    visible.value = true;
    await nextTick();
    if (!tooltip.value || !anchor.value) return;
    const marker = anchor.value.getBoundingClientRect();
    const box = tooltip.value.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, marker.left + marker.width / 2 - box.width / 2));
    const top = marker.top - box.height - 8;
    position.value = { left: `${left}px`, top: `${Math.max(8, Math.min(window.innerHeight - box.height - 8, top >= 8 ? top : marker.bottom + 8))}px` };
    anchor.value.setAttribute('aria-describedby', id);
  }, event instanceof FocusEvent ? 0 : 220);
}

function leave() {
  clearTimeout(showTimer);
  if (anchor.value === document.activeElement && anchor.value?.matches(':focus-visible')) return;
  hideTimer = setTimeout(hide, 120);
}
function keepOpen() { clearTimeout(hideTimer); }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') hide(); }
watch(() => props.disabled, (disabled) => { if (disabled) hide(); });
onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);
});
onUnmounted(() => {
  hide();
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', hide);
  window.removeEventListener('scroll', hide, true);
});
defineExpose({ show, hide, leave });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && item" :id="id" ref="tooltip" role="tooltip" class="timeline-tooltip" dir="rtl" :style="position" @pointerenter="keepOpen" @pointerleave="leave">
      <div class="timeline-tooltip-heading"><strong>{{ title }}</strong><span :class="['tooltip-severity', item.severity.toLowerCase()]">{{ severity[item.severity] }}</span></div>
      <p v-if="activity">עדכונים שנקלטו ממערכת זו במקטע הזמן.</p>
      <p v-else-if="!group && item.count > 1">רשומה מייצגת מתוך {{ count(item.count) }} רשומות באותו זמן.</p>
      <div class="timeline-tooltip-meta"><bdi>{{ activity ? getTimelineSystem(item.system).name : item.source }}</bdi><time>{{ clock(item.time) }}<template v-if="group && group.end !== item.time">–{{ clock(group.end) }}</template></time></div>
      <p v-if="group && item.count > 1">{{ count(item.count) }} רשומות</p>
      <div class="timeline-tooltip-action">{{ action }}</div>
    </div>
  </Teleport>
</template>

<style scoped>
.timeline-tooltip { position: fixed; z-index: 100; width: max-content; max-width: min(300px, calc(100vw - 16px)); padding: 10px 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); color: var(--text); box-shadow: 0 6px 24px #0006; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.timeline-tooltip-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.timeline-tooltip-heading strong { font-size: 12px; font-weight: 500; }
.tooltip-severity { color: var(--muted); font-size: 10px; white-space: nowrap; }
.tooltip-severity.warn { color: var(--warning); }
.tooltip-severity.error { color: var(--danger); }
.timeline-tooltip p { margin: 5px 0 0; color: var(--muted); }
.timeline-tooltip-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; margin-top: 5px; color: var(--muted); }
.timeline-tooltip-meta time { direction: ltr; font-size: 10px; }
.timeline-tooltip-action { margin-top: 7px; padding-top: 6px; border-top: 1px solid var(--line); color: var(--accent); }
</style>
