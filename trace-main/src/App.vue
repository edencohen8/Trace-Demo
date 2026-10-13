<script setup>
import { ref, computed, nextTick } from 'vue';
import { Activity, ArrowUp, ArrowUpLeft, AudioLines, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, FileText, Focus, Layers3, ListFilter, Maximize2, MessageSquare, MousePointer2, PanelLeftClose, PanelLeftOpen, Radio, Radar, Search, Server, X, ZoomIn, ZoomOut } from 'lucide-vue-next';
import { sources, events, time } from './data';
const icons={Radio,Radar,MousePointer2,Server,AudioLines};
const selected=ref(null), query=ref(''), onlyAlerts=ref(false), activeSources=ref(sources.map(s=>s.id));
const range=ref([60,300]), chatOpen=ref(true), tab=ref('events'), raw=ref(false), input=ref(''), busy=ref(false), thread=ref([]), chatBody=ref(null), evidenceIds=ref([]), toast=ref('');
const suggestions=['למה לא הייתה תגובה במשך 102 שניות?','מאיזו נקודה התחיל הכשל?','מה המפעיל ראה ועשה?'];
let saved=[]; try {saved=JSON.parse(localStorage.getItem('trace-lessons')||'[]')} catch {}
const lessons=ref(Array.isArray(saved)?saved:[]);
const source=id=>sources.find(s=>s.id===id);
const visible=computed(()=>events.filter(e=>activeSources.value.includes(e.source)&&(!onlyAlerts.value||e.severity!=='normal')&&(!query.value||[e.title,e.detail,e.id,e.target].join(' ').toLowerCase().includes(query.value.toLowerCase()))));
const inRange=computed(()=>visible.value.filter(e=>(e.end??e.t)>=range.value[0]&&e.t<=range.value[1]));
const detailPanel=ref(null);
const windowSize=computed(()=>range.value[1]-range.value[0]);
function moveWindow(start){const bounded=Math.max(0,Math.min(360-windowSize.value,Number(start)));range.value=[bounded,bounded+windowSize.value]}
function pan(direction){moveWindow(range.value[0]+direction*windowSize.value/4)}
function setZoom(factor){const width=Math.max(60,Math.min(360,windowSize.value*factor));const start=Math.max(0,Math.min(360-width,(range.value[0]+range.value[1]-width)/2));range.value=[start,start+width]}
function laneEvents(id){const lanes=[];return inRange.value.filter(e=>e.source===id).map(e=>{const start=Math.max(0,pos(e.t)),end=Math.min(100,pos(e.end??e.t));const labelStart=start>72?Math.max(0,start-20):start;let lane=lanes.findIndex(right=>right+3<labelStart);if(lane<0)lane=lanes.length;lanes[lane]=Math.max(end,labelStart+20);return {...e,lane,xStart:start,xEnd:end}})}
function rowHeight(id){return Math.max(1,...laneEvents(id).map(e=>e.lane+1))*48+14}
const duration=e=>e.end?Math.round(e.end-e.t)+' שנ׳':'אירוע נקודתי';
const ticks=computed(()=>Array.from({length:7},(_,i)=>Math.round(range.value[0]+windowSize.value*i/6)));
const pos=t=>((t-range.value[0])/(range.value[1]-range.value[0])*100);
const notice=text=>{toast.value=text;setTimeout(()=>toast.value='',3000)};
async function pick(e){selected.value=e;raw.value=false;tab.value='events';await nextTick();detailPanel.value?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
function jump(id){const e=events.find(e=>e.id===id); if(!e)return;query.value='';onlyAlerts.value=false;if(!activeSources.value.includes(e.source))activeSources.value.push(e.source);if(e.t<range.value[0]||e.t>range.value[1])range.value=[90,270];pick(e);tab.value='events'}
function toggleSource(id){activeSources.value=activeSources.value.includes(id)?activeSources.value.filter(s=>s!==id):[...activeSources.value,id]}

async function scrollChat(){await nextTick();if(chatBody.value)chatBody.value.scrollTop=chatBody.value.scrollHeight}
async function ask(question=input.value){
 if(!question.trim()||busy.value)return;
 thread.value.push({role:'user',text:question}); input.value='';busy.value=true;await scrollChat();
 setTimeout(async()=>{
 let response;
 if(/102|תגובה|כשל|התרע|מפעיל|7500|קרה|סכם/.test(question)){
 const operator=/ראה|עשה|מפעיל/.test(question)&&!/102/.test(question);
 response={role:'assistant',title:operator?'הפעולה הראשונה תועדה אחרי 102 שניות':'הקוד נקלט. שרשרת ההתרעה נקטעה.',text:operator?'בחלון שנבדק, פתיחת פרטי המטרה ב־14:33:42 היא הפעולה הראשונה שתועדה עבור T-041. בתמלול המפעיל מדווח שלא קיבל התרעה. אין בידינו הקלטת מסך שמאפשרת לקבוע בדיוק מה ראה.':'ה־IFF קלט את קוד 7500 ב־14:32:00. שנייה לאחר מכן שירות ההתרעות נעצר, ולא נמצאה מסירה לעמדת המפעיל. בדיקה ידנית של המטרה תועדה רק ב־14:33:42.',refs:operator?['EV-110','EV-111']:['EV-106','EV-107','EV-111'],confidence:operator?'בינונית':'גבוהה',explanation:'הערכה להמחשה בלבד, על בסיס התרחיש המדומה. רשומות ההודעות והשירות תומכות בכשל במסירה; התמלול הוא ראיה רכה. היעדר רישום פעולה אינו מוכיח היעדר תשומת לב.',approved:false};
 evidenceIds.value=response.refs;
 } else response={role:'assistant',title:'השאלה הזו מחוץ לתרחיש ההדגמה',text:'בפרוטוטייפ זמינות תשובות מוכנות על קליטת 7500, שירות ההתרעות ופעולות המפעיל. אפשר לבחור אחת משאלות הפתיחה או לחקור את האירועים בציר הזמן.',refs:[]};
 thread.value.push(response);busy.value=false;await scrollChat();
 },900);
}
function approve(message){message.approved=true;const lesson={title:message.title,text:message.text,refs:message.refs}; if(!lessons.value.some(l=>l.title===lesson.title))lessons.value.push(lesson);try{localStorage.setItem('trace-lessons',JSON.stringify(lessons.value))}catch{notice('הלקח נשמר למפגש הנוכחי בלבד');return}notice('המסקנה נשמרה בלקחים')}
function exportNotes(){const blob=new Blob([JSON.stringify({investigation:'TRACE-041',simulated:true,lessons:lessons.value},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='trace-041-lessons.json';a.click();URL.revokeObjectURL(url);notice('הלקחים יוצאו לקובץ')}
</script>

<template>
<div class="app-shell">
 <header class="topbar">
  <a class="brand" href="#" aria-label="TRACE דף התחקיר"><Activity :size="24"/><span>TRACE</span></a>
  <span class="header-divider"></span><span class="breadcrumb">סביבת תחקיר</span><ChevronLeft :size="14" class="muted"/><span>תחקיר 041</span>
  <div class="top-end"><span class="demo-badge"><span></span>נתונים מדומים</span><span class="avatar" title="סביבת תחקיר משותפת">תח</span></div>
 </header>
 <div class="app-body">
  <nav class="rail" aria-label="ניווט ראשי">
   <button :class="{active:tab==='events'}" @click="tab='events'" aria-label="סביבת האירועים" title="סביבת האירועים"><Layers3 :size="21"/></button>
   <button :class="{active:tab==='lessons'}" @click="tab='lessons'" aria-label="לקחים שמורים" title="לקחים שמורים"><Bookmark :size="20"/><span v-if="lessons.length" class="rail-dot"></span></button>
   <span class="rail-bottom">V.01</span>
  </nav>
  <main>
   <section class="heading">
    <div><div class="eyebrow">תחקיר אירוע <span> / </span><bdi>TRACE–041</bdi></div><h1>התרעה שלא הגיעה</h1><p>שחזור רצף האירועים במטרה <bdi>T-041</bdi><span class="dot-separator">·</span>5 באוקטובר 2026</p></div>
    <div class="heading-actions"><span class="status"><span></span>בתחקיר</span><button class="button" @click="exportNotes"><Download :size="15"/>ייצוא לקחים</button></div>
   </section>
   <div class="workspace" :class="{'chat-hidden':!chatOpen}">
    <div class="investigation">
     <section class="panel timeline-panel">
      <div class="panel-heading"><div class="title-with-icon"><Activity :size="18"/><h2>ציר האירועים</h2><span class="subtle-count">5 מקורות</span></div><button class="text-button" @click="range=[0,360];query='';onlyAlerts=false;activeSources=sources.map(s=>s.id)"><Maximize2 :size="14"/>כל האירוע</button></div>
      <div class="timeline-tools">
       <div class="time-window"><Clock3 :size="15"/><bdi>{{time(range[0])}} — {{time(range[1])}}</bdi><span>שעון מקומי</span></div>
       <div class="tool-buttons"><button class="icon-button" @click="setZoom(.5)" :disabled="windowSize<=60" aria-label="התקרבות לציר"><ZoomIn :size="17"/></button><button class="icon-button" @click="setZoom(2)" :disabled="windowSize>=360" aria-label="התרחקות בציר"><ZoomOut :size="17"/></button><button class="button small" @click="range=[90,270]"><Focus :size="15"/>מיקוד באירוע</button></div>
      </div>
      <div class="window-navigation" dir="ltr"><button class="icon-button" @click="pan(-1)" :disabled="range[0]<=0" aria-label="חלון זמן מוקדם יותר" title="מוקדם יותר"><ChevronLeft :size="17"/></button><span class="mono">14:30</span><input type="range" min="0" :max="360-windowSize" step="1" :value="range[0]" :disabled="windowSize===360" @input="moveWindow($event.target.value)" aria-label="הזזת חלון הזמן" :aria-valuetext="time(range[0])+' — '+time(range[1])"/><span class="mono">14:36</span><button class="icon-button" @click="pan(1)" :disabled="range[1]>=360" aria-label="חלון זמן מאוחר יותר" title="מאוחר יותר"><ChevronRight :size="17"/></button></div>
      <div class="filters timeline-filters"><label class="search"><Search :size="15"/><input v-model="query" placeholder="חיפוש בציר הזמן…" aria-label="חיפוש אירועים"/><button v-if="query" @click="query=''" aria-label="ניקוי חיפוש"><X :size="14"/></button></label><button class="button small" :class="{chosen:onlyAlerts}" @click="onlyAlerts=!onlyAlerts" :aria-pressed="onlyAlerts"><ListFilter :size="15"/>חריגות בלבד</button></div>
      <div class="timeline-scroll">
       <div class="timeline">
        <div class="axis"><div class="axis-label"><Server :size="14"/><span>מערכות ומקורות</span></div><div class="tick-area"><span v-for="(tick,i) in ticks" :key="i" :style="{left:(i*100/6)+'%'}">{{time(tick)}}</span></div></div>
        <div v-for="s in sources" :key="s.id" class="source-row" :style="{height:rowHeight(s.id)+'px'}" :class="{disabled:!activeSources.includes(s.id)}">
         <button class="source-label" @click="toggleSource(s.id)" :aria-label="s.system+' — הצגה או הסתרה בציר'" :title="'הצגה או הסתרה: '+s.system" :aria-pressed="activeSources.includes(s.id)" :style="{'--source':s.color}"><component :is="icons[s.icon]" :size="17"/><span class="system-copy"><strong>{{s.system}}</strong><small>{{s.name}}</small></span><span class="source-toggle"></span></button>
         <div class="track">
          <div v-for="n in 7" :key="n" class="grid-line" :style="{left:((n-1)*100/6)+'%'}"></div>
          <button v-for="e in laneEvents(s.id)" :key="e.id" class="timeline-event" :class="[e.severity,{selected:selected?.id===e.id,linked:evidenceIds.includes(e.id),soft:e.soft,interval:e.end,'short-interval':e.end&&(e.xEnd-e.xStart)<9,derived:e.derived,'label-before':e.xStart>72}]" :style="{left:e.xStart+'%',width:e.end?(e.xEnd-e.xStart)+'%':'18px',top:(e.lane*48+35)+'px','--source':s.color}" @click="pick(e)" :aria-label="e.title+' '+time(e.t)+(e.end?' עד '+time(e.end):'')" :aria-pressed="selected?.id===e.id" :title="e.title+' · '+time(e.t)+(e.end?' — '+time(e.end):'')">
           <span class="event-caption">{{e.title}}<small><bdi>{{e.target}}</bdi><span v-if="e.end"> · {{duration(e)}}</span></small></span><span v-if="e.end" class="interval-bar"><span>{{duration(e)}}</span></span><span v-else class="marker"></span>
          </button>
         </div>
        </div>
       </div>
      </div>
      <div class="timeline-footer"><span><i class="legend-dot"></i>אירוע מתועד</span><span><i class="legend-dot critical"></i>חריגה</span><span><i class="legend-dot soft"></i>ראיה רכה</span><span><i class="legend-interval"></i>אירוע מתמשך</span><span class="timeline-hint">לחיצה על אירוע פותחת פירוט למטה</span></div>
     </section>
     <section v-if="tab==='events'" class="panel selection-panel" ref="detailPanel" aria-live="polite">
      <template v-if="selected"><div class="panel-heading"><div class="title-with-icon"><component :is="icons[source(selected.source).icon]" :size="18" :style="{color:source(selected.source).color}"/><h2>פרטי האירוע</h2><span class="subtle-count">{{source(selected.source).name}}</span></div><button class="icon-button" @click="selected=null" aria-label="סגירת פרטי אירוע"><X :size="16"/></button></div>
       <div class="selected-content"><div class="selected-summary"><div class="eyebrow"><bdi>{{selected.id}}</bdi><span> / </span><bdi>{{selected.target}}</bdi></div><h3>{{selected.title}}</h3><p>{{selected.detail}}</p><span class="evidence-type">{{selected.derived?'פער מחושב · מבוסס על רשומות התרחיש':selected.soft?'ראיה רכה · תמלול':'ראיה מתועדת · רשומת מערכת'}}</span></div><div class="selected-timing"><span>זמן האירוע</span><bdi>{{time(selected.t)}}<template v-if="selected.end"> — {{time(selected.end)}}</template></bdi><span class="duration-tag">{{duration(selected)}}</span><button class="text-button ask-about" @click="chatOpen=true;ask('מה המשמעות של '+selected.title+'?')"><MessageSquare :size="14"/>שאלו על האירוע<ArrowUpLeft :size="14"/></button></div></div>
       <div class="source-record"><button class="raw-toggle" @click="raw=!raw" :aria-expanded="raw"><FileText :size="14"/>רשומת המקור<ChevronDown :size="14" :class="{rotate:raw}"/></button><pre v-if="raw">{{JSON.stringify(selected.raw||{event_id:selected.id,source:selected.source,time:time(selected.t),end_time:selected.end?time(selected.end):undefined,entity:selected.target,text:selected.detail},null,2)}}</pre></div>
      </template><div v-else class="selection-empty"><MousePointer2 :size="20"/><div><h3>בחרו אירוע בציר הזמן</h3><p>התוכן, הזמנים ורשומת המקור יופיעו כאן.</p></div></div>
     </section>
     <section v-else class="panel"><div class="panel-heading"><h2>לקחים שמורים</h2><button class="text-button" @click="tab='events'">חזרה לפרטי האירוע</button></div>
      <div class="lessons"><div v-if="!lessons.length" class="empty-state"><Bookmark :size="28"/><h3>המסקנות שתאשרו יישמרו כאן</h3><p>בדקו את הראיות בתשובת הסוכן ואשרו מסקנה לשמירה כלקח.</p></div><article v-for="(lesson,i) in lessons" :key="i" class="lesson"><span class="status"><Check :size="14"/>מסקנה מאושרת</span><h3>{{lesson.title}}</h3><p>{{lesson.text}}</p><button v-for="id in lesson.refs" :key="id" class="citation" @click="jump(id)">{{id}}<ArrowUpLeft :size="12"/></button></article></div>
     </section>
    </div>
    <aside v-if="chatOpen" class="panel chat-panel">
     <div class="panel-heading"><div class="title-with-icon"><MessageSquare :size="18"/><h2>שותף לתחקיר</h2></div><button class="icon-button" @click="chatOpen=false" aria-label="הסתרת צ׳אט"><PanelLeftClose :size="17"/></button></div>
     <div class="chat-context"><span class="context-dot"></span>התחקיר הנוכחי<span>5 מקורות זמינים</span></div>
     <div class="chat-body" ref="chatBody" aria-live="polite">
      <div v-if="!thread.length" class="chat-welcome"><div class="agent-mark"><Activity :size="27"/></div><div class="eyebrow">מתחילים מהשאלה הנכונה</div><h3>מה קרה בין הקליטה<br>לבין התגובה?</h3><p>נבחן יחד את רצף האירועים, נחבר בין המקורות ונחזור לראיות.</p><div class="suggestions"><button v-for="q in suggestions" :key="q" @click="ask(q)">{{q}}<ArrowUpLeft :size="15"/></button></div><div class="context-note"><Layers3 :size="16"/><span>כל תשובה מחוברת לאירועים<br>שאפשר לבדוק בציר הזמן.</span></div></div>
      <article v-for="(m,i) in thread" :key="i" class="message" :class="m.role"><template v-if="m.role==='user'"><span class="message-author">השאלה שלכם</span><p>{{m.text}}</p></template><template v-else><div class="message-author"><Activity :size="15"/>TRACE<span>תשובת הדגמה</span></div><h3>{{m.title}}</h3><p>{{m.text}}</p><div v-if="m.refs.length" class="citations"><button v-for="id in m.refs" :key="id" class="citation" @click="jump(id)"><bdi>{{id}}</bdi><ArrowUpLeft :size="12"/></button></div><details v-if="m.confidence" class="confidence"><summary><span class="context-dot"></span>רמת ביטחון {{m.confidence}} <ChevronDown :size="13"/></summary><p>{{m.explanation}}</p></details><button v-if="m.refs.length" class="approve button" :disabled="m.approved" @click="approve(m)"><Check :size="15"/>{{m.approved?'נשמר בלקחים':'אישור מסקנה ושמירה'}}</button></template></article>
      <div v-if="busy" class="thinking"><span></span>מציג את ניתוח תרחיש ההדגמה…</div>
     </div>
     <div class="chat-bottom"><button v-if="thread.length" class="text-button restart" @click="thread=[];evidenceIds=[]">חזרה לשאלות הפתיחה</button><form class="composer" @submit.prevent="ask()"><textarea v-model="input" aria-label="שאלה לסוכן התחקיר" placeholder="שאלו על האירוע…" rows="2" @keydown.enter.exact.prevent="ask()"></textarea><div><span>Enter לשליחה</span><button class="send-button" :disabled="!input.trim()||busy" type="submit" aria-label="שליחת שאלה"><ArrowUp :size="18"/></button></div></form><p class="prototype-note">פרוטוטייפ אינטראקטיבי · תשובות מוכנות להמחשה</p></div>
    </aside>
    <button v-else class="open-chat button" @click="chatOpen=true"><PanelLeftOpen :size="17"/>פתיחת הצ׳אט</button>
   </div>
   <footer class="app-footer"><span><span class="context-dot"></span>כל חמשת המקורות נטענו</span><span>מידע מסומלץ בלבד <span class="dot-separator">·</span> סביבת תחקיר רטרוספקטיבית</span><bdi>TRACE / PROTOTYPE 01</bdi></footer>
  </main>
 </div>
 <div v-if="toast" class="toast" role="status"><Check :size="17"/>{{toast}}</div>
</div>
</template>