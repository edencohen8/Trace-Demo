const labels: Record<string, string> = {
  RadarScan: 'סריקות', DetectionCandidate: 'מועמדי גילוי', SensorHealth: 'דיווחי מצב חיישן',
  TrackUpdate: 'עדכוני מסלול', UiTrackPublished: 'עדכוני תצוגה', IFFReply: 'תשובות זיהוי',
  PositionReport: 'דיווחי מיקום', FilterConfigApplied: 'שינוי תצורה', TrackTerminated: 'סיום מסלול',
  UiTrackRemoved: 'הסרה מהתצוגה', AlertRuleMatch: 'התאמה לכלל התראה', NotificationRequest: 'בקשת התראה',
  NotificationDelivered: 'מסירת התראה', DispatcherState: 'מצב משגר ההתראות',
  ComponentLog: 'דיווח רכיב', OperatorNote: 'דיווח מפעיל',
  RadarState: 'מצב סריקה', InhibitSectorState: 'מצב חסימה בפועל', DisplayState: 'מצב תצוגה',
  Detection: 'גילויים', TargetTrack: 'עקבות', InitialReport: 'דיווח האירוע', RepeatPassReport: 'דיווח מעבר חוזר',
  RequestSent: 'שליחת בקשה', ReceiptAcknowledgement: 'אישור קבלה', ApplicationAcknowledgement: 'אישור החלה',
  RequestApplied: 'החלת בקשה', RequestRejected: 'דחיית בקשה', DisplayChanged: 'שינוי תצוגה',
  SoftwareVersion: 'גרסת תוכנה', ResultDelivery: 'מסירת תוצאה', ResultSubscription: 'קבלת תוצאות', Heartbeat: 'דיווח זמינות',
};
export const timelineLabel = (type: string): string => labels[type] ?? type;
