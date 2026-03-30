const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysSinceEpoch(year: number, month: number, day: number): number {
  let days = 0;
  for (let y = 1970; y < year; y++) {
    days += isLeapYear(y) ? 366 : 365;
  }
  for (let m = 1; m < month; m++) {
    const dim = DAYS_IN_MONTH[m - 1];
    if (dim) {
      days += dim;
    }
    if (m === 2 && isLeapYear(year)) {
      days += 1;
    }
  }
  days += day - 1;
  return days;
}

function parseIsoParts(iso: string) {
  const match = iso.match(ISO_PATTERN);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    min: Number(match[5]),
    sec: Number(match[6]),
  };
}

// Compute difference in seconds: isoA - isoB, component-wise to avoid overflow.
function diffSeconds(isoA: string, isoB: string): number {
  const a = parseIsoParts(isoA);
  const b = parseIsoParts(isoB);
  if (!(a && b)) {
    return 0;
  }
  const daysA = daysSinceEpoch(a.year, a.month, a.day);
  const daysB = daysSinceEpoch(b.year, b.month, b.day);
  const dayDiff = daysA - daysB;
  const timeA = a.hour * 3600 + a.min * 60 + a.sec;
  const timeB = b.hour * 3600 + b.min * 60 + b.sec;
  return dayDiff * 24 * 3600 + (timeA - timeB);
}

function toIsoString(date: Date): string {
  try {
    return date.toISOString();
  } catch {
    return "";
  }
}

function isValidDateStr(iso: string): boolean {
  return ISO_PATTERN.test(iso);
}

export function formatRelativeTime(
  dateString: string,
  options: { short?: boolean; nowIso?: string } = {}
): string {
  const date = new Date(dateString);
  const dateIso = toIsoString(date);
  if (!isValidDateStr(dateIso)) {
    return "Invalid date";
  }

  const nowIso = options.nowIso ?? toIsoString(new Date());
  const diffSec = diffSeconds(nowIso, dateIso);
  const absDiffSec = Math.abs(diffSec);
  const diffMin = Math.floor(absDiffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const isFuture = diffSec < 0;

  if (absDiffSec < 60) {
    return "just now";
  }

  if (isFuture) {
    if (diffMin < 60) {
      return `in ${diffMin}m`;
    }
    if (diffHour < 24) {
      return `in ${diffHour}h`;
    }
    if (diffDay === 1 && !options.short) {
      return "tomorrow";
    }
    if (diffDay < 7) {
      return `in ${diffDay}d`;
    }
    return date.toLocaleDateString();
  }

  if (diffMin < 60) {
    return options.short ? `${diffMin}m` : `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return options.short ? `${diffHour}h` : `${diffHour}h ago`;
  }
  if (diffDay === 1 && !options.short) {
    return "yesterday";
  }
  if (diffDay < 7) {
    return options.short ? `${diffDay}d` : `${diffDay}d ago`;
  }
  return date.toLocaleDateString();
}
