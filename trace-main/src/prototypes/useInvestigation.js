import { inject } from 'vue';
import { events, sources, time } from '../data';
export { events, sources, time };
export const keyEvents=['EV-106','EV-107','EV-110','EV-111','EV-112'].map(id=>events.find(e=>e.id===id));
export const useInvestigation=()=>inject('investigation');
export const sourceName=e=>sources.find(s=>s.id===e.source)?.system;
