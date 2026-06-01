export type IsoDate = string; // Expected format: YYYY-MM-DD

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  return ISO_DATE_REGEX.test(value);
}

export function parseIsoDate(value: IsoDate): Date {
  // Parse as UTC midnight to avoid local timezone drift.
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatIsoDate(date: Date): IsoDate {
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function clampIsoDate(
  value: IsoDate,
  min: IsoDate,
  max: IsoDate,
): IsoDate {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function addDaysIsoDate(value: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

export function diffDaysIsoDate(a: IsoDate, b: IsoDate): number {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function eachDayInclusive(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDaysIsoDate(cursor, 1);
  }
  return days;
}

export function rangesOverlapInclusive(a: {
  start: IsoDate;
  end: IsoDate;
}): (b: { start: IsoDate; end: IsoDate }) => boolean {
  return (b) => !(a.end < b.start || b.end < a.start);
}

export function normalizeDateRange(range: {
  start: IsoDate;
  end: IsoDate;
}): { start: IsoDate; end: IsoDate } {
  if (range.start <= range.end) return range;
  return { start: range.end, end: range.start };
}
