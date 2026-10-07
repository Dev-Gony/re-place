import { queryDb } from "./db";

export type CampaignSnapshot = {
  id: number;
  platform: string | null;
  title: string | null;
  link: string | null;
  reward: string | null;
  region: string | null;
  deadline_at: string | null;
};

export async function getCampaignSnapshot(
  campaignId: number,
): Promise<CampaignSnapshot | null> {
  const result = await queryDb<CampaignSnapshot>(
    `select id, platform, title, link, reward, region, deadline_at
       from campaigns
      where id = $1
      limit 1`,
    [campaignId],
  );

  return result.rows[0] ?? null;
}

export function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
  };
}

export function normalizeOptionalText(value: unknown, max = 2000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

function validCalendarDate(year: number, month: number, day: number) {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysByMonth[month - 1];
}

export function normalizeDeadline(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!validCalendarDate(year, month, day)) return null;
    return `${yearText}-${monthText}-${dayText}T00:00:00.000Z`;
  }

  const dateTime = ISO_DATE_TIME_PATTERN.exec(trimmed);
  if (!dateTime) return null;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    timeZone,
  ] = dateTime;
  if (
    !validCalendarDate(Number(yearText), Number(monthText), Number(dayText)) ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59
  ) {
    return null;
  }

  if (timeZone !== "Z") {
    const [offsetHour, offsetMinute] = timeZone.slice(1).split(":").map(Number);
    if (
      offsetHour > 14 ||
      offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)
    ) {
      return null;
    }
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeOptionalDeadline(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  return normalizeDeadline(value) ?? undefined;
}
