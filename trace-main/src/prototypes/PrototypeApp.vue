<script setup>
// Six throwaway designs of the existing investigation route, selected via ?variant=A..F.
// Question: which hierarchy and layout make a shared investigation feel clear and light?
import {computed,defineAsyncComponent,onMounted,onUnmounted,provide,reactive,ref,watch} from 'vue';
import {events} from './useInvestigation';
import PrototypeSwitcher from './PrototypeSwitcher.vue';
const variants=[
{key:'A',name:'Quiet',description:'קריאה מרווחת · רצף אנכי · עוזר מתקפל'},
{key:'B',name:'Playback',description:'אירוע אחד בכל רגע · שחזור מדורג · במה כהה'},
{key:'C',name:'Connections',description:'מפת קשרים · מערכות וראיות · פרטים במגירה'},
{key:'D',name:'Notebook',description:'מחברת תחקיר · טקסט במרכז · ראיות בשוליים'},
{key:'E',name:'Studio',description:'ציר זמן אוורירי · השוואת מקורות · עוזר לצד העבודה'},
{key:'F',name:'Conversation',description:'שיחה במרכז · ראיות לפי דרישה · הקשר בצד'}
];
const components={A:defineAsyncComponent(()=>import('./VariantA.vue')),B:defineAsyncComponent(()=>import('./VariantB.vue')),C:defineAsyncComponent(()=>import('./VariantC.vue')),D:defineAsyncComponent(()=>import('./VariantD.vue')),E:defineAsyncComponent(()=>import('./VariantE.vue')),F:defineAsyncComponent(()=>import('./VariantF.vue'))};
const initial=new URLSearchParams(location.search).get('variant')?.toUpperCase();
const current=ref(variants.some(v=>v.key===initial)?initial:'A');
const state=reactive({selected:null,selectionRevision:0,messages:[],approved:false});
function select(id){state.selected=events.find(e=>e.id===id)||null;state.selectionRevision++}
function ask(q){
state.messages.push({role:'user',text:q});
const relevant=/102|מפעיל|7500|כשל|התרע|קרה|תגובה|שירות|סנסור/.test(q);
state.messages.push({role:'assistant',text:relevant?'קוד 7500 נקלט ב־14:32:00. שנייה לאחר מכן שירות ההתרעות נעצר. לא נמצאה מסירה לעמדה, והפעולה הראשונה למטרה תועדה אחרי 102 שניות. התמלול תומך בכך שהמפעיל לא קיבל התרעה, אך אינו מוכיח מה הוצג במסך.':'במחקר העיצוב זמינות תשובות מוכנות על קוד 7500, שירות ההתרעות ותגובת המפעיל. נסו אחת משאלות הפתיחה.',refs:relevant?['EV-106','EV-107','EV-111']:[]});
}
provide('investigation',{state,select,ask});
function change(value){current.value=typeof value==='number'?variants[(variants.findIndex(v=>v.key===current.value)+value+6)%6].key:value;const url=new URL(location.href);url.searchParams.set('variant',current.value);history.replaceState({},'',url);window.scrollTo(0,0)}
function keyboard(e){if(e.target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();change(e.key==='ArrowRight'?1:-1)}}
watch(current,()=>{console.info('TRACE design study',{variant:current.value,selected:state.selected?.id??null,messages:state.messages,approved:state.approved})},{immediate:true});
onMounted(()=>window.addEventListener('keydown',keyboard));onUnmounted(()=>window.removeEventListener('keydown',keyboard));
</script><template><div class="design-study" :class="'design-'+current" dir="rtl"><component :is="components[current]" :key="current"/><PrototypeSwitcher v-if="showSwitcher" :variants="variants" :current="current" :state="state" @change="change"/></div></template>
<script>export default {computed:{showSwitcher(){return import.meta.env.DEV}}}</script>