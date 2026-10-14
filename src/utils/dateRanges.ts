export const DEFAULT_LOCAL_TIME_ZONE = 'Africa/Cairo';

type DateParts = { year: number; month: number; day: number };

export function getLocalDateParts(value: Date | string, timeZone = DEFAULT_LOCAL_TIME_ZONE): DateParts {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('تاريخ مرجعي غير صالح.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function toLocalYmd(value: Date | string, timeZone = DEFAULT_LOCAL_TIME_ZONE): string {
  const { year, month, day } = getLocalDateParts(value, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function offsetMs(instantMs: number, timeZone: string): number {
  const zoneName = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instantMs)).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = zoneName.match(/^GMT(?:(\+|-)(\d{2}):?(\d{2})?)?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * ((Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 60 * 1000);
}

function localDateTimeToUtc(ymd: string, endOfDay: boolean, timeZone: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return new Date(localAsUtc - offsetMs(localAsUtc, timeZone)).toISOString();
}

export function toLocalDayRange(value: Date | string = new Date(), timeZone = DEFAULT_LOCAL_TIME_ZONE): { startIso: string; endIso: string; ymd: string } {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : toLocalYmd(value, timeZone);
  return {
    ymd,
    startIso: localDateTimeToUtc(ymd, false, timeZone),
    endIso: localDateTimeToUtc(ymd, true, timeZone),
  };
}

export function shiftLocalYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}
