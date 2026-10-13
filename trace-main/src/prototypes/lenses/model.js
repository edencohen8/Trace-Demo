// THROWAWAY: eight dark-mode refinements of the operator-selected time-lens layout.
import {inject} from 'vue';
export {sources,recordsAll,DURATION,INCIDENT,clock,duration,binsFor,coverageGap} from '../timelines/data';
export const useLens=()=>inject('lens');
export const designs=[
 {key:'L1',name:'Flat Rails',title:'מיקוד שקט · סרגלים שטוחים',description:'מסלול אופקי שטוח ונקי לכל מערכת. כל הרשומות יושבות ישירות על הציר ללא היסט גובה או ענפים.'},
 {key:'L2',name:'Event Chips',title:'מיקוד שקט · תגיות אירוע',description:'אירועים מוצגים כתגיות שטוחות עם שמות וזמנים ישירות על הציר, לקריאה שוטפת ללא צורך בריחוף.'},
 {key:'L3',name:'Unified Stream',title:'מיקוד שקט · ציר מאוחד',description:'שילוב כל 5 המערכות על גבי ציר כרונולוגי יחיד ושטוח, המבליט את סדר הפעולות הכולל.'},
 {key:'L4',name:'State Bands',title:'מיקוד שקט · רצועות מצב',description:'פסי פעילות רציפים המדגישים פערי מקור, אינטרוולים ומצבי חריגה כרצועות צבע שטוחות.'},
 {key:'L5',name:'Digital Filmstrip',title:'מיקוד שקט · סרט דיגיטלי',description:'חלוקת שניות בדיוק מירבי עם שנתות זמן, סרגל קריאה אינטראקטיבי ופעימות שטוחות.'},
 {key:'L6',name:'Correlation Flow',title:'מיקוד שקט · שרשרת קורלציה',description:'חיבור ויזואלי של הודעות קשורות (כגון MSG-740) לאורך הזמן ברצף שטוח המבליט את שרשרת התקלה.'},
 {key:'L7',name:'Event Cards',title:'מיקוד שקט · כרטיסים כרונולוגיים',description:'ציר זמן שטוח משולב עם רצף כרטיסי אירוע אינטראקטיביים עם כפתורי מעבר צעד־אחר־צעד.'},
 {key:'L8',name:'Metric Ribbons',title:'מיקוד שקט · רצועות מדדים',description:'ראשי מערכת עם מדדי בריאות וכמות חריגות, לצד פסי פעילות מוארים וסמלים שטוחים.'}
];
export const reason=e=>e.severity==='critical'?'הרשומה סומנה קריטית במקור המדומה.':e.severity==='warning'?'הרשומה סומנה חריגה בתרחיש המדומה.':'הרשומה אינה מסומנת חריגה.';
export const rawRecord=e=>e.raw??{event_id:e.id,source:e.source,timestamp:e.t,target:e.target,severity:e.severity,title:e.title,detail:e.detail,...(e.end?{end_timestamp:e.end}:{}),time_unit:'seconds_since_08:00'};
