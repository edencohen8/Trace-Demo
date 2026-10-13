<script setup>
import {computed} from 'vue';import {useTimeline} from './useTimeline';import {sources,binsFor,clock,coverageGap} from './data';import TimeAxis from './TimeAxis.vue';
const {state,filtered,inspect}=useTimeline();
const rows=computed(()=>sources.map(s=>({...s,bins:binsFor(filtered.value.filter(e=>e.source===s.id),state.start,state.end,24)})));
const max=computed(()=>Math.max(1,...rows.value.flatMap(s=>s.bins.map(b=>b.count))));
const gap=(s,b)=>s==='sensor'&&b.start<coverageGap.end&&b.end>coverageGap.start;
</script><template><div class="heatmap"><div class="lane-axis"><TimeAxis :start="state.start" :end="state.end"/><span>מערכת מקור</span></div>
<div class="heat-row" v-for="s in rows" :key="s.id"><div class="heat-cells" dir="ltr"><button v-for="b in s.bins" :key="b.start" :class="{alert:b.alert,unknown:gap(s.id,b)}" :style="{backgroundColor:'rgba(125,166,228,'+(0.05+b.count/max*.75)+')'}" :title="clock(b.start)+' · '+b.count+' רשומות · '+b.alert+' חריגות'+(gap(s.id,b)?' · כולל פער בנתוני המקור':'')" @click="inspect(b.start,b.end,{source:s.id})"><span>{{b.count}}</span><small v-if="b.alert">! {{b.alert}}</small><small v-if="gap(s.id,b)">∅</small></button></div><strong class="matrix-label">{{s.label}}</strong></div>
<div class="heat-legend"><span>מעט רשומות</span><i></i><span>הרבה רשומות</span><span>! חריגה · ∅ כולל נתונים חסרים</span></div></div></template>