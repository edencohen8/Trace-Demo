<script setup>
import {computed} from 'vue';import {sources,binsFor,clock} from './data';import {useTimeline} from './useTimeline';import TimeAxis from './TimeAxis.vue';
const props=defineProps({start:Number,end:Number,group:{default:'source'},compact:Boolean});
const {filtered,state,select,inspect}=useTimeline();
const rows=computed(()=>props.group==='source'?sources.map(s=>({id:s.id,label:s.label,color:s.color})):['T-041','T-208','T-312','T-509','ARCHIVE','SENSOR-A','OP-01','ALERT-SERVICE'].map(id=>({id,label:id,color:'#96b5ee'})));
const span=computed(()=>props.end-props.start);
const data=computed(()=>rows.value.map(row=>{const all=filtered.value.filter(e=>e[props.group]===row.id&&e.t<props.end&&(e.end??e.t)>=props.start);return {...row,all,bins:binsFor(all,props.start,props.end,36)}}));
const pos=t=>Math.max(0,Math.min(100,(t-props.start)/span.value*100));
const paint=e=>sources.find(s=>s.id===e.source)?.color;
</script><template><div class="lane-plot" :class="{compact}">
<div class="lane-axis"><TimeAxis :start="start" :end="end"/><span>{{group==='source'?'מערכת מקור':'ישות / מזהה'}}</span></div>
<div v-for="row in data" :key="row.id" class="lane-row">
<div class="lane-track" dir="ltr">
<template v-if="span>360">
<button v-for="(b,i) in row.bins" :key="i" class="lane-bin" :class="{alert:b.alert}" :style="{left:i/36*100+'%',width:100/36+'%',height:Math.max(5,Math.min(38,7+Math.sqrt(b.count)*3))+'px',opacity:b.count?1:.15}" :title="clock(b.start)+' · '+b.count+' רשומות · '+b.alert+' חריגות'" @click="inspect(b.start,b.end,{[group]:row.id})"><span v-if="b.alert">!</span></button>
</template>
<template v-else>
<button v-for="(e,i) in row.all" :key="e.id" class="event-tick" :class="{alert:e.severity!=='normal',selected:e.id===state.selected?.id,interval:e.end,soft:e.soft}" :style="{left:pos(e.t)+'%',width:e.end?Math.max(.65,pos(e.end)-pos(e.t))+'%':'5px',top:(8+(i%3)*14)+'px',background:paint(e)}" :title="clock(e.t)+' · '+e.title+' · '+e.target" @click="select(e.id)"></button>
</template>
</div><div class="lane-label"><i :style="{background:row.color}"></i><strong>{{row.label}}</strong><small>{{row.all.length.toLocaleString()}} רשומות</small></div>
</div></div></template>