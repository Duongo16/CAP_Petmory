/**
 * Date-only values belong to the Vietnamese business day, not to UTC.
 *
 * A browser date input gives `YYYY-MM-DD`. Converting that straight with
 * `new Date(value)` makes the result midnight UTC and creates off-by-one-day
 * behaviour around midnight in Viet Nam. Keep the conversion in one place.
 */
const VIET_NAM_OFFSET = '+07:00';

/** Today's calendar day in the business time zone, for date input limits. */
export function vietnamToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (kind: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** The first instant of a Vietnamese calendar day, serialized for an API. */
export function vietnamDayStart(day: string): string {
  return new Date(`${day}T00:00:00.000${VIET_NAM_OFFSET}`).toISOString();
}

/** The final instant of a Vietnamese calendar day, serialized for an API. */
export function vietnamDayEnd(day: string): string {
  return new Date(`${day}T23:59:59.999${VIET_NAM_OFFSET}`).toISOString();
}
