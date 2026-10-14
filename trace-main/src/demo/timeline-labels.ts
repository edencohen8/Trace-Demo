const labels: Record<string, string> = {
  RadarScan: 'סריקות', DetectionCandidate: 'מועמדי גילוי', SensorHealth: 'דיווחי מצב חיישן',
  TrackUpdate: 'עדכוני מסלול', UiTrackPublished: 'עדכוני תצוגה', IFFReply: 'תשובות זיהוי',
  PositionReport: 'דיווחי מיקום', FilterConfigApplied: 'שינוי תצורה', TrackTerminated: 'סיום מסלול',
  UiTrackRemoved: 'הסרה מהתצוגה', AlertRuleMatch: 'התאמה לכלל התראה', NotificationRequest: 'בקשת התראה',
  NotificationDelivered: 'מסירת התראה', DispatcherState: 'מצב משגר ההתראות',
  ComponentLog: 'דיווח רכיב', OperatorNote: 'דיווח מפעיל',
};
export const timelineLabel = (type: string): string => labels[type] ?? type;
