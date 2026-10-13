export const sources = [
{id:'messages',system:'מערכת IFF',name:'תעבורת הודעות',short:'הודעות',color:'#8baff0',icon:'Radio'},
{id:'sensor',system:'בקר הסנסור',name:'סטטוס סנסור',short:'סנסור',color:'#79b8d5',icon:'Radar'},
{id:'operator',system:'עמדת המפעיל',name:'פעולות מפעיל',short:'מפעיל',color:'#c0a6db',icon:'MousePointer2'},
{id:'services',system:'שרת השירותים',name:'לוגי שירותים',short:'שירותים',color:'#dfb779',icon:'Server'},
{id:'voice',system:'מערכת הקשר',name:'תמלולי קול',short:'קול',color:'#a7b3c3',icon:'AudioLines'}];
export const events = [
{id:'GAP-01',t:120,end:222,source:'operator',title:'ללא פעולה מתועדת',detail:'בין קליטת קוד 7500 לפתיחת פרטי המטרה חלפו 102 שניות, ללא פעולה מתועדת למטרה T-041. זהו פער מחושב בין EV-106 ל־EV-111, ולא רשומת מקור עצמאית.',severity:'warning',target:'T-041',derived:true},
{id:'EV-101',t:24,source:'messages',title:'עדכון עקיבה שגרתי',detail:'התקבל עדכון מיקום עבור מטרה T-208. ההודעה נקלטה בהצלחה.',severity:'normal',target:'T-208'},
{id:'EV-102',t:52,source:'sensor',title:'סנסור במצב תקין',detail:'בדיקת תקינות מחזורית הסתיימה ללא חריגות.',severity:'normal',target:'SENSOR-A'},
{id:'EV-103',t:77,source:'operator',title:'בחירת מטרה',detail:'המפעיל בעמדה OP-01 בחר מטרה T-208 לצפייה.',severity:'normal',target:'T-208'},
{id:'EV-104',t:94,source:'services',title:'השהיה בשירות ארכוב',detail:'השהיה של 320ms בשירות הארכוב. השירות חזר לפעילות רגילה. אין מזהה משותף לשרשרת ההתרעה.',severity:'warning',target:'ARCHIVE'},
{id:'EV-105',t:110,end:118,source:'voice',title:'דיווח מצב שגרתי',detail:'״התמונה יציבה, ממשיכים במעקב.״ זמן מיוחס לפי תוכן התמלול; ודאות בינונית.',severity:'normal',target:'OP-01',soft:true},
{id:'EV-106',t:120,source:'messages',title:'נקלט קוד 7500',detail:'נקלט שידור IFF עם קוד 7500 ממטרה T-041. ההודעה הועברה לשירות ההתרעות.',severity:'critical',target:'T-041',raw:{event_id:'EV-106',timestamp:'2026-10-05T14:32:00+03:00',source:'iff_messages',track_id:'T-041',code:'7500',message_id:'MSG-740',forwarded_to:'alert-service'}},
{id:'EV-107',t:121,end:267,source:'services',title:'שירות ההתרעות נעצר',detail:'תהליך שירות ההתרעות הסתיים בשגיאה בעת עיבוד MSG-740. השירות לא היה זמין במשך 146 שניות, עד להפעלתו מחדש ב־14:34:27. לא נמצאה רשומת מסירה לעמדה OP-01 בחלון שנבדק.',severity:'critical',target:'T-041',raw:{event_id:'EV-107',timestamp:'2026-10-05T14:32:01+03:00',service:'alert-service',message_id:'MSG-740',status:'PROCESS_EXIT',delivery_ack:null,recovered_at:'2026-10-05T14:34:27+03:00'}},
{id:'EV-108',t:143,source:'sensor',title:'הקליטה ממשיכה כסדרה',detail:'הסנסור ממשיך לקלוט את T-041. אין שינוי בסטטוס התקינות.',severity:'normal',target:'T-041'},
{id:'EV-109',t:185,source:'messages',title:'שידור 7500 חוזר',detail:'שידור נוסף עם אותו קוד נקלט ממטרה T-041.',severity:'warning',target:'T-041'},
{id:'EV-110',t:209,end:220,source:'voice',title:'״לא קיבלתי התרעה״',detail:'״אני רואה שינוי בקוד, אבל לא קיבלתי התרעה בעמדה.״ התמלול תומך בהיעדר התרעה; לבדו אינו מוכיח מה הוצג במסך.',severity:'warning',target:'T-041',soft:true},
{id:'EV-111',t:222,source:'operator',title:'בדיקה ידנית של המטרה',detail:'המפעיל פתח את פרטי T-041, 102 שניות לאחר קליטת הקוד הראשונה. זו הפעולה הראשונה שתועדה למטרה זו בחלון שנבדק.',severity:'warning',target:'T-041'},
{id:'EV-112',t:267,source:'services',title:'שירות ההתרעות חזר',detail:'השירות הופעל מחדש ובדיקת התקינות הושלמה.',severity:'normal',target:'ALERT-SERVICE'},
{id:'EV-113',t:298,source:'operator',title:'סימון האירוע לתחקיר',detail:'המפעיל הוסיף סימון לבדיקת רצף ההתרעה.',severity:'normal',target:'T-041'},
{id:'EV-114',t:330,source:'sensor',title:'בדיקת תקינות תקופתית',detail:'כל ערוצי הקליטה זמינים.',severity:'normal',target:'SENSOR-A'}];
events.sort((a,b)=>a.t-b.t);
export const time = t => '14:' + String(30+Math.floor(t/60)).padStart(2,'0') + ':' + String(Math.floor(t%60)).padStart(2,'0');
