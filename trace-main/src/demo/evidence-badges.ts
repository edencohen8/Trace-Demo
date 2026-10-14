// Shared parsing for original rows and real, case-scoped calculation handles.
export const EVIDENCE_BADGE_PATTERN = String.raw`\[(?:[a-zA-Z0-9_]+\.(?:csv|txt|xlsx|json):L[1-9]\d*|calc:[^\]\n]+)\]`;
export function evidenceBadges(text: string): string[] {
  return [...new Set(text.match(new RegExp(EVIDENCE_BADGE_PATTERN, 'g')) ?? [])];
}
