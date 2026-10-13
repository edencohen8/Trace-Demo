<script setup>
import {useTimeline} from './useTimeline';import LanePlot from './LanePlot.vue';
const {state}=useTimeline();
</script><template><LanePlot :start="state.start" :end="state.end"/><p class="plot-note">כל שורה היא מערכת. במבט רחב: לחיצה על מקבץ פותחת את הרשומות שבו. בחלון עד 6 דקות: כל סימן הוא רשומה, וקו אופקי הוא משך.</p></template>