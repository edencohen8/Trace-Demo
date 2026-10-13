<script setup>
import {clock} from './data';defineProps({start:Number,end:Number});
</script><template><div class="time-axis" dir="ltr"><span v-for="i in 5" :key="i">{{clock(start+(end-start)*(i-1)/4)}}</span></div></template>