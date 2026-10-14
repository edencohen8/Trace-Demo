<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ArrowLeft, ArrowRight, Info, X } from 'lucide-vue-next';
import { GROUPING_VARIANTS, type GroupingVariantKey } from './grouping-variants.ts';

const props = defineProps<{ current: GroupingVariantKey; state: Record<string, unknown> }>();
const emit = defineEmits<{ change: [key: GroupingVariantKey] }>();
const info = ref(false);
const variant = computed(() => GROUPING_VARIANTS.find(item => item.key === props.current)!);
function step(direction: number) {
  const index = GROUPING_VARIANTS.findIndex(item => item.key === props.current);
  emit('change', GROUPING_VARIANTS[(index + direction + GROUPING_VARIANTS.length) % GROUPING_VARIANTS.length]!.key);
}
function keydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1); }
}
onMounted(() => window.addEventListener('keydown', keydown));
onUnmounted(() => window.removeEventListener('keydown', keydown));
</script>

<template>
  <Teleport to="body">
    <aside v-if="info" class="prototype-explainer" dir="rtl" aria-label="הסבר על החלופה">
      <button class="prototype-info-close" aria-label="סגירת הסבר" @click="info = false"><X :size="16"/></button>
      <small>ניסוי תצוגה · טרם נבחר כיוון</small><h2>{{ variant.name }}</h2><p>{{ variant.read }}</p>
      <dl><dt>מה מרוויחים</dt><dd>{{ variant.gain }}</dd><dt>הפשרה</dt><dd>{{ variant.cost }}</dd></dl>
      <p class="prototype-caution">אלה נתוני הסימולציה הקיימים. פעילות מחזורית אינה הוכחה לתקינות. אזהרות, שינויים ודיווחי מפעיל נשארים גלויים.</p>
      <details><summary>מצב התצוגה</summary><pre dir="ltr">{{ JSON.stringify(state, null, 2) }}</pre></details>
    </aside>
    <nav class="prototype-switcher" dir="ltr" aria-label="בחירת אבטיפוס לקיבוץ רשומות">
      <button class="prototype-arrow" aria-label="החלופה הקודמת" @click="step(-1)"><ArrowLeft :size="18"/></button>
      <div class="prototype-current" dir="rtl" aria-live="polite"><strong><span dir="ltr">{{ current.padStart(2, '0') }} / 10</span> {{ variant.name }}</strong><span>{{ variant.idea }}</span></div>
      <div class="prototype-numbers"><button v-for="item in GROUPING_VARIANTS" :key="item.key" :aria-label="`חלופה ${item.key}: ${item.name}`" :aria-pressed="current === item.key" :title="item.name" @click="emit('change', item.key)">{{ item.key }}</button></div>
      <button class="prototype-info" :aria-expanded="info" aria-label="איך קוראים את החלופה" @click="info = !info"><Info :size="18"/></button>
      <button class="prototype-arrow" aria-label="החלופה הבאה" @click="step(1)"><ArrowRight :size="18"/></button>
    </nav>
  </Teleport>
</template>
