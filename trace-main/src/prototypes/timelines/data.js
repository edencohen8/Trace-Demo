// THROWAWAY: deterministic simulated evidence for ten timeline experiments.
import {events as original,sources as originalSources} from '../../data';
export const DURATION=16*3600;
export const INCIDENT=6*3600+32*60;
export const sources=originalSources.map(s=>({...s,label:s.system}));
export const clock=t=>{const x=Math.max(0,Math.floor(t))+8*3600;return [Math.floor(x/3600),Math.floor(x/60)%60,x%60].map(n=>String(n).padStart(2,'0')).join(':')};
export const duration=s=>s>=3600?(s/3600).toFixed(s%3600?1:0)+' שעות':s>=60?(s/60).toFixed(s%60?1:0)+' דק׳':s+' שנ׳';
export const coverageGap={start:INCIDENT+600,end:INCIDENT+780,source:'sensor'};
const targets=['T-041','T-208','T-312','T-509'];
// Seeded irregular traffic: independent activity episodes, quiet periods and local bursts.
// Reproducible for comparisons; illustrative behavior, not a model of a real installation.
let seed=4102026;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const pick=items=>items[Math.floor(random()*items.length)];
const timestamp=t=>'2026-10-05T'+clock(t)+'+03:00';
const kinds={
 messages:[['TRACK_UPDATE','עדכון מיקום מטרה'],['IFF_REPLY','תשובת IFF נקלטה'],['TRACK_ASSOCIATED','שיוך הודעה לעקיבה'],['QUALITY_UPDATE','עדכון איכות עקיבה']],
 sensor:[['HEALTH_SAMPLE','דגימת תקינות'],['SCAN_COMPLETE','מחזור סריקה הושלם'],['CHANNEL_STATUS','דיווח מצב ערוץ'],['SIGNAL_QUALITY','מדידת איכות קליטה']],
 services:[['REQUEST_COMPLETE','בקשה עובדה'],['QUEUE_SAMPLE','דגימת תור עיבוד'],['CACHE_REFRESH','עדכון מטמון'],['HEALTH_CHECK','בדיקת זמינות שירות']],
 operator:[['TRACK_SELECTED','בחירת מטרה'],['DETAILS_OPENED','פתיחת פרטי מטרה'],['FILTER_CHANGED','שינוי מסנן תצוגה'],['NOTE_ADDED','הוספת הערת מפעיל']],
 voice:[['RADIO_UPDATE','עדכון בקשר'],['READBACK','אישור קבלת דיווח'],['HANDOVER','העברת תמונת מצב'],['CLARIFICATION','בקשת הבהרה']]
};
const means={messages:4.8,sensor:16,services:9,operator:39,voice:135};
const records=[];
for(const s of sources){
 let t=random()*80,phaseEnd=0,pace=1,burst=0,sessionTarget=pick(targets),sessionEnd=0;
 for(let i=0;t<DURATION;i++){
  if(t>=phaseEnd){phaseEnd=t+90+random()*1600;pace=random()<.18?3+random()*6:.35+random()*1.9}
  if(t>=sessionEnd){sessionTarget=pick(targets);sessionEnd=t+15+random()*180}
  if(!burst&&random()<.045)burst=2+Math.floor(random()*6);
  const gap=burst?(.3+random()*2.7):-Math.log(Math.max(.0001,1-random()))*means[s.id]*pace;
  if(burst)burst--;
  t=Math.round((t+Math.max(1,gap)));
  if(t>=DURATION)break;
  const target=s.id==='operator'?sessionTarget:pick(targets);
  if(s.id==='sensor'&&t>=coverageGap.start&&t<coverageGap.end)continue;
  if(s.id==='operator'&&target==='T-041'&&t>=INCIDENT&&t<INCIDENT+102)continue;
  if(s.id==='services'&&t>=INCIDENT+1&&t<INCIDENT+147)continue;
  const id='SIM-'+s.id+'-'+i;
  let [kind,title]=pick(kinds[s.id]);
  let severity='normal',end,detail,raw;
  if(s.id==='messages'){
   const quality=Math.round(70+random()*29);
   raw={event_id:id,timestamp:timestamp(t),source:'iff_messages',type:kind,track_id:target,message_id:'MSG-BG-'+i,sequence:i,quality,latency_ms:Math.round(4+random()*37)};
   detail='הודעת '+kind+' עבור '+target+'; איכות עקיבה '+quality+'%. נתון רקע מסומלץ.';
  }else if(s.id==='sensor'){
   const degraded=t>=INCIDENT+7200&&t<INCIDENT+7290;
   if(degraded){title='דגימת איכות קליטה נמוכה';severity='warning'}
   raw={event_id:id,timestamp:timestamp(t),sensor_id:'SENSOR-A',channel:pick(['CH-1','CH-2','CH-4']),type:kind,track_id:target,quality:degraded?'degraded':'nominal',snr_db:Math.round((degraded?8:19)+random()*12),scan_ms:Math.round(720+random()*340)};
   detail='דגימת ערוץ '+raw.channel+'; יחס אות לרעש '+raw.snr_db+' dB. מדידה מסומלצת.';
  }else if(s.id==='services'){
   const latency=Math.round(8+Math.pow(random(),3)*420);
   const delayed=random()<.004;
   if(delayed){title='עיבוד בקשה התעכב';severity='warning'}
   if(kind==='CACHE_REFRESH'&&random()<.4)end=t+2+Math.floor(random()*19);
   raw={event_id:id,timestamp:timestamp(t),service:pick(['alert-service','track-store','archive-worker']),type:kind,request_id:'REQ-'+i,track_id:target,elapsed_ms:delayed?800+Math.floor(random()*950):latency,queue_depth:Math.floor(Math.pow(random(),2)*23),status:delayed?'SLOW_REQUEST':'OK'};
   detail='שירות '+raw.service+'; זמן עיבוד '+raw.elapsed_ms+'ms, '+raw.queue_depth+' פריטים בתור. רשומה מסומלצת.';
  }else if(s.id==='operator'){
   raw={event_id:id,timestamp:timestamp(t),workstation:pick(['OP-01','OP-02']),user_id:'SIM-OPERATOR',type:kind,track_id:target,panel:pick(['track-details','map','event-inbox'])};
   detail='פעולת '+kind+' בעמדה '+raw.workstation+' עבור '+target+'. פעולה מסומלצת.';
  }else{
   end=t+3+Math.floor(Math.pow(random(),1.5)*32);
   const text=pick(['מבקש עדכון על המטרה.','קיבלתי, ממשיכים לעקוב.','התמונה עודכנה, מעביר לעמדה השנייה.','חזור על המזהה, הקליטה הייתה מקוטעת.','המטרה בבדיקה, אעדכן כשיהיה שינוי.']);
   raw={event_id:id,timestamp:timestamp(t),channel:pick(['RADIO-A','RADIO-B']),type:kind,speaker:pick(['OP-01','OP-02','SUPERVISOR']),track_id:target,text,recorded_at:null,time_basis:'attributed_from_transcript',duration_seconds:end-t};
   detail='״'+text+'״ תמלול מדומה; זמן מיוחס לפי התוכן, ודאות בינונית.';
  }
  if(end)end=Math.min(end,DURATION);
  records.push({id,t,source:s.id,target,title,severity,detail,raw,...(end?{end}:{}),...(s.id==='voice'?{soft:true}:{})});
 }
}
const offset=INCIDENT-120;
for(const e of original.filter(e=>!e.derived))records.push({...e,t:e.t+offset,...(e.end?{end:e.end+offset}:{}),anchor:true});
let retryTime=INCIDENT+2400;
for(let i=0;i<80;i++){
 retryTime+=Math.max(1,Math.round(-Math.log(Math.max(.001,1-random()))*2.1));
 records.push({id:'ARCH-'+i,t:retryTime,source:'services',target:'ARCHIVE',severity:'warning',title:pick(['ניסיון ארכוב חוזר','הכתיבה לארכיון התעכבה','פריט הוחזר לתור הארכוב']),detail:'מקבץ שגיאות מסומלץ בשירות הארכוב. אין מזהה הודעה משותף לתרחיש ההתרעה.',raw:{event_id:'ARCH-'+i,timestamp:timestamp(retryTime),service:'archive-worker',retry:i,backoff_ms:Math.round(200+random()*2600),status:'RETRY_PENDING'}});
}
records.push({id:'SENSOR-QUALITY',t:INCIDENT+7200,end:INCIDENT+7290,source:'sensor',target:'SENSOR-A',severity:'warning',title:'איכות קליטה נמוכה',detail:'ירידה מדומה באיכות הקליטה למשך 90 שניות; אין קשר מוכח לשירות ההתרעות.'});
export const recordsAll=records.sort((a,b)=>a.t-b.t||a.id.localeCompare(b.id));
export const stateSpans=[
 {source:'messages',start:0,end:DURATION,label:'קליטה פעילה',kind:'normal',evidence:'EV-106'},
 {source:'sensor',start:0,end:coverageGap.start,label:'קליטה תקינה',kind:'normal',evidence:'EV-108'},
 {source:'sensor',start:coverageGap.start,end:coverageGap.end,label:'חסר קובץ מקור · מצב לא ידוע',kind:'unknown'},
 {source:'sensor',start:coverageGap.end,end:INCIDENT+7200,label:'קליטה תקינה',kind:'normal',evidence:'EV-114'},
 {source:'sensor',start:INCIDENT+7200,end:INCIDENT+7290,label:'איכות נמוכה',kind:'warning',evidence:'SENSOR-QUALITY'},
 {source:'sensor',start:INCIDENT+7290,end:DURATION,label:'קליטה תקינה',kind:'normal',evidence:'EV-114'},
 {source:'services',start:0,end:INCIDENT+1,label:'שירות התרעות זמין',kind:'normal',evidence:'EV-107'},
 {source:'services',start:INCIDENT+1,end:INCIDENT+147,label:'שירות התרעות לא זמין',kind:'critical',evidence:'EV-107'},
 {source:'services',start:INCIDENT+147,end:DURATION,label:'שירות התרעות זמין',kind:'normal',evidence:'EV-112'},
 {source:'operator',start:INCIDENT,end:INCIDENT+102,label:'ללא פעולה מתועדת ל־T-041',kind:'derived',evidence:'EV-111'},
 {source:'voice',start:INCIDENT+89,end:INCIDENT+100,label:'״לא קיבלתי התרעה״',kind:'soft',evidence:'EV-110'}
];
export function binsFor(records,start,end,count=40){
 const size=(end-start)/count;
 const bins=Array.from({length:count},(_,i)=>({start:start+i*size,end:start+(i+1)*size,count:0,alert:0,bySource:Object.fromEntries(sources.map(s=>[s.id,0]))}));
 for(const e of records){if(e.t<start||e.t>=end)continue;const b=bins[Math.min(count-1,Math.floor((e.t-start)/size))];b.count++;b.bySource[e.source]++;if(e.severity!=='normal')b.alert++}
 return bins;
}
export const options=[
 {key:'T1',name:'Source lanes',title:'מסלולים לפי מערכת',question:'מה קרה במערכות השונות באותו רגע?',hint:'מבט רחב מציג מקבצי זמן; זום מפריד אותם לרשומות ולאינטרוולים.',tradeoff:'נקודת מוצא טבעית לתחקיר; מספר רב של מערכות דורש קיבוץ מסלולים.'},
 {key:'T2',name:'Density matrix',title:'מפת צפיפות',question:'באיזו מערכת ובאיזה חלון מסתתר דפוס חריג?',hint:'עוצמת התא = מספר רשומות. מסגרת כתומה = לפחות חריגה אחת.',tradeoff:'מצוינת לסריקת שעות רבות; הסדר המדויק נחשף רק בפתיחת תא.'},
 {key:'T3',name:'Activity river',title:'זרם הפעילות',question:'מתי השתנה נפח הפעילות, ומי תרם לשינוי?',hint:'גובה הזרם = נפח רשומות; כל שכבה היא מערכת. לחצו על חלון להעמקה.',tradeoff:'מבליטה התפרצויות ושינוי בתמהיל; מקור רועש עלול להאפיל על מקורות שקטים.'},
 {key:'T4',name:'Entity tracks',title:'מסלולים לפי ישות',question:'מה עבר על אותה מטרה בכל המערכות?',hint:'השורות הן מטרות ורכיבים; צבע הרשומה מציין את המערכת המדווחת.',tradeoff:'טובה להצלבה בין מערכות; איכות המבט תלויה בזמינות מזהים משותפים.'},
 {key:'T5',name:'State ribbons',title:'מצבים ורציפות',question:'איזה מצב נמשך, ומה התרחש במקביל אליו?',hint:'אינטרוולים מציגים מצב, פער נתונים ואי־פעולה בנפרד; לחצו כדי לבדוק את הראיות.',tradeoff:'מבליטה משכים וחפיפות; מחייבת מודל מצבים וכללי גזירת מצב מוסכמים.'},
 {key:'T6',name:'Chronicle',title:'יומן מסונכרן',question:'מה כל מערכת תיעדה בכל פרק זמן?',hint:'הזמן מתקדם מלמעלה למטה; עמודות המערכות מיושרות לאותו חלון.',tradeoff:'קריאה מילולית ונוחה בחדר תחקיר; השוואת זמנים רחוקים דורשת גלילה.'},
 {key:'T7',name:'Time lens',title:'עדשת זמן',question:'איך בודקים שניות בלי לאבד את הסיפור של כל היום?',hint:'בחרו נקודה בפס היום. העדשה פותחת חמש דקות, עם ההקשר המלא מעליה.',tradeoff:'משלבת הקשר ופירוט; חשוב להבחין בין שני סולמות הזמן.'},
 {key:'T8',name:'Message paths',title:'מסלול הודעה',question:'עד איפה הגיעה הודעה, ואיפה חסרה ראיית המשך?',hint:'בחרו מזהה משותף. הקווים מראים רק העברות המתועדות בתרחיש.',tradeoff:'חזקה לאיתור פער במסירה; אינה תחליף לסריקה כללית כשאין מזהה מקשר.'},
 {key:'T9',name:'Small multiples',title:'דופק לכל מערכת',question:'האם שינוי במקור אחד מופיע גם במקור אחר?',hint:'אותו ציר זמן בחמישה גרפים. לכל מערכת סולם נפח משלה כדי לחשוף גם מקורות שקטים.',tradeoff:'טובה להשוואת תבניות; אין להשוות גובה מוחלט בין גרפים בעלי סולם שונה.'},
 {key:'T10',name:'Window comparison',title:'חלון מול חלון',question:'מה שונה בחלון האירוע לעומת חלון השוואה?',hint:'שני חלונות של חמש דקות מיושרים לזמן יחסי. החליפו את נקודת ההשוואה.',tradeoff:'מבליטה שינוי מול שגרה; בחירת חלון השוואה לא מייצג עלולה להטעות.'}
];