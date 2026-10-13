<script setup>
import {computed} from 'vue';import {useLens,sources,clock,duration,rawRecord,reason} from './model';import {AtSign,Copy,Check,FileJson,TriangleAlert,X} from 'lucide-vue-next';import {ref,watch} from 'vue';
defineProps({mode:{default:'split'}});
const {selected,state,attach,select,related}=useLens();const copied=ref(false);
const fields=computed(()=>{const e=selected.value;if(!e)return [];return [
 ['מזהה רשומה',e.id],['מערכת מקור',sources.find(s=>s.id===e.source)?.label],['מזהה ישות',e.target],['חומרה במקור',e.severity],
 [e.soft?'זמן מיוחס':'זמן מערכת','05.10.2026 '+clock(e.t)+' +03:00'],['סיום / משך',e.end?clock(e.end)+' · '+duration(e.end-e.t):'אירוע נקודתי'],
 ['סוג ראיה',e.soft?'קול · ראיה רכה':'רישום מערכת'],['ודאות זמן',e.soft?'בינונית · לפי תוכן התמלול':'חותמת זמן מערכת'],
 ['מזהה הודעה',e.raw?.message_id||'לא סופק'],['זמן קליטה נפרד','לא סופק'],['הפניית מקור','simulated/'+e.source+'/'+e.id],['מצב נתונים','נתוני הדגמה']
]});
watch(()=>state.selectedId,()=>copied.value=false);
async function copy(){await navigator.clipboard.writeText(JSON.stringify(rawRecord(selected.value),null,2));copied.value=true}
</script><template><section v-if="selected" class="evidence-inspector" :class="'inspector-'+mode" aria-label="נתוני מקור ומטא דאטה">
<header><div><span class="section-label">פריט מידע · {{selected.id}}</span><h2>{{selected.title}}</h2><p>{{selected.detail}}</p></div><button aria-label="סגירת פרטי מקור" @click="state.selectedId=null"><X/></button></header>
<div v-if="selected.severity!=='normal'" class="anomaly-reason"><TriangleAlert/><span><b>למה הפריט מודגש?</b> {{reason(selected)}} הסימון מזמין בדיקה, ואינו מוכיח סיבתיות.</span></div>
<div class="inspector-content"><dl class="metadata"><div v-for="[label,value] in fields" :key="label"><dt>{{label}}</dt><dd>{{value}}</dd></div></dl><section class="raw-content"><div class="raw-heading"><span><FileJson/>{{selected.raw?'רשומת המקור המדומה':'רשומת הדגמה מנורמלת'}}</span><button @click="copy" aria-label="העתקת נתוני המקור"><Check v-if="copied"/><Copy v-else/></button></div><pre dir="ltr">{{JSON.stringify(rawRecord(selected),null,2)}}</pre></section></div>
<footer><button class="attach-evidence" @click="attach(selected.id)"><AtSign/>{{state.tags.includes(selected.id)?'מצורף לטיוטה':'תיוג בצ׳אט'}}</button><div v-if="related.length" class="related-points"><span>{{selected.raw?.message_id?'אותו מזהה הודעה':'אותה ישות · ±2 דקות'}}:</span><button v-for="e in related.slice(0,4)" :key="e.id" @click="select(e.id)">{{e.id}}</button></div></footer>
</section><section v-else class="evidence-placeholder"><FileJson/><div><h3>המקור נמצא כאן</h3><p>בחרו נקודה להצגת הרשומה המלאה והמטא־דאטה שלה.</p></div></section></template>