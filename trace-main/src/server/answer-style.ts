import type { Finding } from '../agent/types.ts';

const COMPONENT_NAMES: Record<string, string[]> = {
  'radar-psr-01': ['מכ״ם', 'מכ"ם', 'בקר החיישן'],
  'iff-receiver': ['מקלט הזיהוי', 'מערכת הזיהוי'],
  'track-core': ['מעבד העקיבה', 'שירות העקיבה'],
  'position-bridge': ['מתאם המיקום'],
  'alert-router': ['מערכת ההתראות', 'שירות ההתראות'],
  'ui-gateway': ['שרת התצוגה', 'ממשק התצוגה'],
  operator: ['המפעיל', 'יומן המפעיל'],
};

export const ANSWER_STYLE = `
סגנון התשובה למשתמש:
- כתוב בעברית טבעית וברורה כברירת מחדל. השתמש בשפה אחרת רק אם המשתמש מבקש זאת במפורש.
- התחל בממצא החשוב. לשאלה פשוטה ענה במשפט אחד עד שלושה. לסיכום: 30–70 מילים בשתי פסקאות קצרות, אלא אם התבקשה הרחבה. בבקשת סיכום אל תחזור על רשימת הבדיקות או הרכיבים מהתשובה הקודמת.
- הסבר מה קרה ומה המשמעות. אל תספר על שלבי העבודה שלך ואל תחזור על אותו ממצא בכותרת, בטענה ובנימוק.
- השתמש בפסקאות קצרות או בעד שלוש נקודות. אפשר להדגיש מסקנה או תווית קצרה באמצעות **טקסט מודגש**. אל תשתמש בטבלה אלא אם היא נחוצה להשוואה שהתבקשה.
- העדף שמות ברורים: המכ״ם, מקלט הזיהוי, מעבד העקיבה, מתאם המיקום, מערכת ההתראות ושרת התצוגה. אין צורך לחזור על מזהי השירות באנגלית.
- במקום site_external כתוב ״המיקום מהמקור החיצוני״, במקום site_manual כתוב ״המיקום שהוזן ידנית״. GPS אפשר לציין פעם אחת כ״מיקום הלוויין (GPS)״.
- ציין מונח באנגלית רק כשהוא נחוץ לזיהוי או להבנת הממצא. הסבר אותו בקצרה בפעם הראשונה. השאר מזהי ראיות ללא שינוי.
- העדף ״נתונים״ על ״טלמטריה״, ״בדיקות״ על ״סבבים״, ו״הרכיב דיווח שהוא תקין״ על ״איכות תקפה״. כתוב כמו חוקר שמסביר למשתמש, לא כמו תרגום של דוח טכני.
- הצג שעות מקומיות בלבד בפורמט שעות:דקות, ושניות רק אם הן חשובות. באזור הזמן של המקרים האלה מוסיפים שלוש שעות ל-UTC. כתוב פעם אחת ״השעות מקומיות״. הצג UTC רק אם המשתמש ביקש זאת במפורש.
- עגל מדידות בתיאור לפי הצורך להבנה, בלי לשנות את המשמעות. ערכים מדויקים זמינים ברשומת המקור.
- צרף אסמכתא או שתיים ליד כל טענה מהותית. הימנע מרצף ארוך של אסמכתאות כפולות.
- שמור במפורש על אי-ודאות: ״נמצא״ עבור תצפית, ״ייתכן״ עבור השערה, ״לא ניתן לקבוע״ כשאין מספיק ראיות. אל תהפוך בדיקה חלקית לשלילה ודאית.
- בתחקיר, סיים במשפט קצר על מה שעדיין לא ידוע. שאלת הבהרה צריכה להיות קצרה ובעברית.
- אל תחזור על אותה הסתייגות בכמה מקומות. גם אם התשובות הקודמות ארוכות, שמור על הסגנון הקצר הזה.
מילון רכיבים פנימי לצורך תרגום בלבד: ${JSON.stringify(COMPONENT_NAMES)}
`.trim();

export function needsShorterAnswer(text: string, question: string): boolean {
  if (/בפירוט|בפירוט רב|הרחב|תפרט|מפורט|in detail|detailed|comprehensive/i.test(question)) return false;
  const prose = text.replace(/\[[^\]]+\]/g, '').replace(/[*#`]/g, '');
  return prose.trim().split(/\s+/).length > 120;
}

// Coverage checks still require the component to appear in the actual answer.
// Hebrew names count, so the validator does not force English IDs into prose.
export function mentionedComponents(text: string, required: string[]): string[] {
  return required.filter((id) => (COMPONENT_NAMES[id] ?? []).some((name) => text.includes(name)));
}

export function findingsSummary(findings: Finding[]): string {
  return findings.map((finding) => {
    const label = finding.status === 'ABSTENTION' ? 'מה עדיין לא ידוע' : finding.status === 'NEGATIVE' || finding.status === 'CONTRADICTION' ? 'הסבר חלופי' : 'מה נמצא';
    const refs = [...new Set(finding.evidence_citations.map((citation) => citation.badge))].slice(0, 2).join(' ');
    return `**${label}:** ${finding.claim} ${refs}`;
  }).join('\n\n');
}
