<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, FileText, Link2, X } from 'lucide-vue-next';
import type { ResolvedSource } from './types.ts';
import { TIMELINE_SYSTEMS } from './systems.ts';

const props = defineProps<{ evidence: ResolvedSource; position: string; previous: boolean; next: boolean; loading: boolean; grouped?: boolean }>();
const emit = defineEmits<{ attach: [badge: string]; close: []; navigate: [direction: number]; group: [] }>();
const tab = ref<'summary' | 'fields' | 'source'>('summary');
const tabs = [{ id: 'summary', label: 'תקציר' }, { id: 'fields', label: 'שדות' }, { id: 'source', label: 'מקור' }] as const;
const pane = ref<HTMLElement>();
const systemName = computed(() => TIMELINE_SYSTEMS.find(system => system.sources.includes(props.evidence.event?.source ?? ''))?.name ?? props.evidence.event?.source ?? 'קובץ מקור');
const localTime = computed(() => props.evidence.event ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(props.evidence.event.time)) : '');
const severity = computed(() => ({ INFO: 'מידע', WARN: 'אזהרה', ERROR: 'שגיאה' })[props.evidence.event?.severity ?? 'INFO']);
watch(() => [props.evidence.badge, tab.value], () => pane.value?.scrollTo({ top: 0 }));
function tabKey(event: KeyboardEvent, index: number) {
  const next = event.key === 'ArrowLeft' ? (index + 1) % tabs.length : event.key === 'ArrowRight' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
  if (next < 0) return;
  event.preventDefault(); tab.value = tabs[next]!.id;
  (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
}
</script>

<template>
  <section class="source-inspector bottom-dock" aria-label="מציג רשומות מקור">
    <header class="dock-header">
      <div class="dock-identity"><button v-if="grouped" class="back-to-group" @click="emit('group')">חזרה לקבוצה</button><bdi :title="evidence.badge">{{ evidence.sourceFile }}:{{ evidence.line }}</bdi><strong>{{ evidence.event?.type || 'קובץ מקור' }}</strong><time>{{ localTime }}</time></div>
      <div class="record-tabs" role="tablist" aria-label="תוכן הרשומה"><button v-for="(item, index) in tabs" :id="`record-tab-${item.id}`" :key="item.id" role="tab" :aria-selected="tab === item.id" :aria-controls="`record-pane-${item.id}`" :tabindex="tab === item.id ? 0 : -1" @click="tab = item.id" @keydown="tabKey($event, index)">{{ item.label }}</button></div>
      <div class="dock-actions"><div v-if="position" class="evidence-pager" dir="ltr"><button :disabled="!previous || loading" aria-label="רשומה קודמת" @click="emit('navigate', -1)"><ChevronLeft :size="14"/></button><span>{{ position }}</span><button :disabled="!next || loading" aria-label="רשומה הבאה" @click="emit('navigate', 1)"><ChevronRight :size="14"/></button></div><button class="attach-button" aria-label="שאלו על הרשומה" @click="emit('attach', evidence.badge)"><Link2 :size="13"/><span>שאלו על הרשומה</span></button><button class="icon-button" aria-label="סגירת מציג הלוגים" @click="emit('close')"><X :size="16"/></button></div>
    </header>
    <div :id="`record-pane-${tab}`" ref="pane" class="record-pane" role="tabpanel" :aria-labelledby="`record-tab-${tab}`" tabindex="0">
      <div v-if="tab === 'summary'" class="dock-details">
        <div class="dock-description"><p dir="auto">{{ evidence.event?.text || 'הקובץ המקורי זמין בלשונית מקור.' }}</p><div class="dock-source"><FileText :size="13"/><span dir="ltr">{{ evidence.sourceFile }}:{{ evidence.line }}</span><span v-if="evidence.sheet">{{ evidence.sheet }}</span><span>נתוני התחקיר</span></div><p v-if="evidence.event?.precision" class="precision-note">דיוק הזמן במקור: {{ evidence.event.precision }}</p></div>
        <dl class="dock-facts"><div><dt>מערכת</dt><dd dir="ltr">{{ systemName }}</dd></div><div><dt>מטרה</dt><dd dir="ltr">{{ evidence.event?.target || '—' }}</dd></div><div><dt>חומרה</dt><dd :class="{ warning: evidence.event?.severity !== 'INFO' }">{{ severity }}</dd></div><div><dt>סוג אירוע</dt><dd dir="auto">{{ evidence.event?.type || '—' }}</dd></div></dl>
      </div>
      <dl v-else-if="tab === 'fields'" class="record-fields"><div v-if="evidence.event"><dt>זמן UTC</dt><dd dir="ltr">{{ evidence.event.time }}</dd></div><div v-if="evidence.event?.recordedTime"><dt>זמן רישום UTC</dt><dd dir="ltr">{{ evidence.event.recordedTime }}</dd></div><div v-for="(value, key) in evidence.event?.fields" :key="key"><dt dir="auto">{{ key }}</dt><dd dir="auto">{{ value }}</dd></div><div v-if="!evidence.event"><dt>רשומה</dt><dd>אין שדות מפוענחים לשורה זו. אפשר לקרוא את המקור.</dd></div></dl>
      <div v-else><div class="raw-lines" dir="ltr"><div v-for="line in evidence.lines" :key="line.number" :class="{ highlighted: line.highlight }"><span>{{ line.number }}</span><pre>{{ line.content }}</pre></div></div><details class="hash-details"><summary>שלמות הקובץ · SHA-256</summary><code>{{ evidence.sha256 }}</code></details></div>
    </div>
  </section>
</template>
