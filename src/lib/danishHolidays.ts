const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysToISODate(isoDate: string, days: number) {
  const date = parseISODate(isoDate);
  if (!date) return "";
  return formatISODate(new Date(date.getTime() + days * MS_PER_DAY));
}

function easterSundayISO(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatISODate(new Date(Date.UTC(year, month - 1, day)));
}

function movableHolidayNames(year: number) {
  const easter = easterSundayISO(year);
  const holidays = new Map([
    [addDaysToISODate(easter, -3), "Skærtorsdag"],
    [addDaysToISODate(easter, -2), "Langfredag"],
    [easter, "Påskedag"],
    [addDaysToISODate(easter, 1), "2. påskedag"],
    [addDaysToISODate(easter, 39), "Kristi himmelfartsdag"],
    [addDaysToISODate(easter, 49), "Pinsedag"],
    [addDaysToISODate(easter, 50), "2. pinsedag"],
  ]);
  if (year < 2024) holidays.set(addDaysToISODate(easter, 26), "Store bededag");
  return holidays;
}

export function getDanishAgreementHolidayName(isoDate: string) {
  const date = parseISODate(isoDate);
  if (!date) return undefined;

  const year = date.getUTCFullYear();
  const monthDay = isoDate.slice(5);
  const fixedHolidayNames = new Map([
    ["01-01", "Nytårsdag"],
    ["12-25", "1. juledag"],
    ["12-26", "2. juledag"],
  ]);
  const fixedHoliday = fixedHolidayNames.get(monthDay);
  if (fixedHoliday) return fixedHoliday;

  const movableHoliday = movableHolidayNames(year).get(isoDate);
  if (movableHoliday) return movableHoliday;

  return date.getUTCDay() === 0 ? "Søndag" : undefined;
}

export function isDanishAgreementHoliday(isoDate: string) {
  return Boolean(getDanishAgreementHolidayName(isoDate));
}
