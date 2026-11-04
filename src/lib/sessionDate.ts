// Change the calendar day only; keep the session's existing local time.
export function sessionDateUpdate(scheduledAt: string, day: Date) {
  const next = new Date(scheduledAt);
  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return { scheduled_at: next.toISOString() };
}