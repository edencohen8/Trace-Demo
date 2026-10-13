<script setup>
import {computed} from 'vue';import {useLens,binsFor,DURATION,clock} from './model';import {ChevronLeft,ChevronRight} from 'lucide-vue-next';
const props=defineProps({mode:{default:'line'}});
const {state,filtered,setRange}=useLens();
const count=computed(()=>props.mode==='chapters'?32:64);
const bins=computed(()=>binsFor(filtered.value,0,DURATION,count.value));
const max=computed(()=>Math.max(1,...bins.value.map(b=>b.count)));
function choose(b){setRange(b.start,b.end-b.start);}
const active=b=>b.start<state.start+state.span&&b.end>state.start;
</script><template><section class="lens-overview" :class="'overview-'+mode" aria-label="סקירת התחקיר">
<div class="overview-heading"><div><span class="section-label">כל התחקיר</span><b>08:00 — 24:00</b><small>{{filtered.length.toLocaleString()}} רשומות</small></div><span>{{mode==='volume'||mode==='instruments'?'גובה = מספר רשומות · ':''}}כל מקטע {{DURATION/count/60}} דק׳ · בחרו להעמקה</span></div>
<div class="overview-track" dir="ltr"><button v-for="(b,i) in bins" :key="b.start" class="overview-interval" :class="{suspicious:b.alert,active:active(b)}" :aria-pressed="active(b)" :aria-label="clock(b.start)+' עד '+clock(b.end)+' · '+b.count+' רשומות · '+b.alert+' חריגות'" :title="clock(b.start)+' — '+clock(b.end)+' · '+b.count+' רשומות · '+b.alert+' חריגות'" @click="choose(b)"><i :style="{height:Math.max(3,b.count/max*(mode==='volume'||mode==='instruments'?42:24))+'px'}"></i><span v-if="b.alert" class="interval-alert">!</span><small v-if="mode==='chapters'&&i%2===0">{{clock(b.start).slice(0,5)}}</small></button><div class="overview-window" :style="{left:state.start/DURATION*100+'%',width:state.span/DURATION*100+'%'}"></div></div>
<div class="overview-hour-ticks" dir="ltr"><i v-for="i in 17" :key="i" :style="{left:(i-1)/16*100+'%'}"></i></div><div class="overview-axis" dir="ltr"><time v-for="i in 5" :key="i">{{clock((i-1)*DURATION/4).slice(0,5)}}</time></div>
<div class="overview-focus-label"><span>החלון המוגדל</span><b dir="ltr">{{clock(state.start)}} — {{clock(state.start+state.span)}}</b><span>↓</span></div><div v-if="mode==='precision'" class="overview-scrubber"><span>הזזת החלון</span><input type="range" :value="state.start" min="0" :max="DURATION-state.span" step="1" aria-label="הזזת חלון הזמן" @input="setRange(Number($event.target.value),state.span)"/></div>
</section></template>