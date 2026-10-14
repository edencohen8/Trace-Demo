<script setup lang="ts">
import { computed } from 'vue';
import { Calculator, Link2, X } from 'lucide-vue-next';
import type { ResolvedCalculation } from './types.ts';
import CitationLink from './CitationLink.ts';

const props = defineProps<{ evidence: ResolvedCalculation }>();
const emit = defineEmits<{ citation: [badge: string]; attach: [badge: string]; close: [] }>();
const result = computed(() => props.evidence.result);
const label = (value: boolean | null) => value === null ? 'לא ידוע' : value ? 'כן' : 'לא';
const clock = (value: unknown) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(String(value)));
</script>

<template>
  <section class="source-inspector bottom-dock" aria-label="מציג תוצאת חישוב">
    <header class="dock-header">
      <div class="dock-identity"><Calculator :size="15"/><strong>{{ evidence.title }}</strong><span>תוצאה מחושבת</span></div>
      <div class="dock-actions"><button class="attach-button" @click="emit('attach', evidence.badge)"><Link2 :size="13"/>שאלו על החישוב</button><button class="icon-button" aria-label="סגירת מציג הלוגים" @click="emit('close')"><X :size="16"/></button></div>
    </header>
    <div class="record-pane calculation-pane" dir="rtl">
      <p>חלון הדיווח: <bdi>{{ clock(result.report.fields.window_start) }}–{{ clock(result.report.fields.window_end) }}</bdi> (זמן מקומי). המיקום מבוסס על דיווח אנושי ועל אי־הוודאות שנמסרה בו.</p>
      <dl class="calculation-facts">
        <div><dt>גילויים באזור</dt><dd>{{ result.detections.count }}</dd></div>
        <div><dt>רשומות עקיבה באזור</dt><dd>{{ result.tracks.count }}</dd></div>
        <div><dt>מזהי עקיבה שונים</dt><dd>{{ result.tracks.distinct_recorded_id_count }}</dd></div>
        <div><dt>כיסוי מספיק לקביעת היעדר</dt><dd>{{ label(result.detections.coverage_complete && result.tracks.coverage_complete) }}</dd></div>
        <div><dt>סריקה מכסה את כל החלון</dt><dd>{{ label(result.search.covers_report_throughout) }}</dd></div>
        <div><dt>מגזר פעיל מכסה את כל החלון</dt><dd>{{ label(result.inhibit.blocks_report_throughout) }}</dd></div>
      </dl>
      <p v-if="!result.detections.coverage_complete" class="coverage-warning">היעדר רשומות אינו מוכיח שלא הופק גילוי כאשר כיסוי ההקלטה אינו מספיק.</p>
      <p v-if="result.tracks.recorded_ids.length" class="subtle">מזהים ברשומות: <bdi v-for="id in result.tracks.recorded_ids" :key="`${id.source}:${id.target_id}`">{{ id.target_id }} </bdi>. כמה רשומות יכולות להשתייך לאותו מסלול.</p>
      <p v-if="result.tracks.missing_id_count" class="coverage-warning">{{ result.tracks.missing_id_count }} רשומות עקיבה ללא מזהה; אין להסיק מהן את מספר המסלולים.</p>
      <p class="subtle">נבדקו כל הרשומות בחלון ובאזור, ללא סינון לפי מזהה מטרה. החישוב משווה את אזור אי־הוודאות לגבולות הסריקה והחסימה ולתוקף דיווחי המצב. התאמה מרחבית אינה אישור זהות.</p>
      <div class="calculation-inputs"><strong>מקורות החישוב</strong><CitationLink v-for="badge in evidence.inputs" :key="badge" :badge="badge" @open="emit('citation', $event)"/></div>
      <p v-if="result.evidence_truncated" class="subtle">הסיכום חושב מכל הרשומות. רשימת דוגמאות הקלט מוגבלת; אפשר לצמצם את החלון כדי לבדוק פרטים נוספים.</p>
      <details><summary>פרטי החישוב והמגבלות</summary><pre dir="ltr">{{ JSON.stringify(result, null, 2) }}</pre></details>
      <details class="hash-details"><summary>טביעת אצבע ו־hashes של חבילת הראיות</summary><code>{{ evidence.fingerprint }}</code><pre dir="ltr">{{ JSON.stringify(evidence.inputHashes, null, 2) }}</pre></details>
    </div>
  </section>
</template>
