export type DeadlineUrgency = 'overdue' | 'urgent' | 'soon' | 'normal' | 'rolling';

export interface DeadlineMeta {
  daysLeft: number | null;
  urgency: DeadlineUrgency;
  label: string;
  formattedDate: string;
}

export interface ParsedDeadlineResult {
  deadline: string | null;
  isExact: boolean;
}

const RUSSIAN_MONTHS: Record<string, number> = {
  январ: 1,
  феврал: 2,
  март: 3,
  апрел: 4,
  ма: 5, // мая / май
  июн: 6,
  июл: 7,
  август: 8,
  сентябр: 9,
  октябр: 10,
  ноябр: 11,
  декабр: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function matchRussianMonth(word: string): number | null {
  const lower = word.toLowerCase().trim();
  if (lower === 'мая' || lower === 'май' || lower === 'мае' || lower === 'маю') {
    return 5;
  }
  for (const [stem, monthNum] of Object.entries(RUSSIAN_MONTHS)) {
    if (stem !== 'ма' && lower.startsWith(stem)) {
      return monthNum;
    }
  }
  return null;
}

function resolveYearForMonthDay(month: number, day: number, referenceDate: Date): number {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();
  // If the mentioned date is more than 60 days in the past, assume next year
  const thisYearTs = Date.UTC(refYear, month - 1, day);
  const refTs = Date.UTC(refYear, refMonth - 1, refDay);
  const diffDays = Math.round((thisYearTs - refTs) / 86_400_000);
  if (diffDays < -60) {
    return refYear + 1;
  }
  return refYear;
}

/**
 * Extracts an explicit internship application deadline from Russian or English text.
 * Supports patterns like:
 * - "до 25 ноября 2026"
 * - "дедлайн: 03.12.2026"
 * - "по 15 декабря"
 * - "приём заявок до 10.01.2027"
 * - "2026-12-20"
 */
export function parseRussianDeadline(
  text: string,
  referenceDate: Date = new Date()
): ParsedDeadlineResult {
  if (!text || !text.trim()) {
    return { deadline: null, isExact: false };
  }

  const normalized = text.replace(/\s+/g, ' ');

  // 1. Contextual Russian word date: "до 25 ноября 2026", "дедлайн 5 декабря", "по 12 января"
  const contextualWordRegex =
    /(?:до|по|дедлайн|крайний\s+срок|при[её]м\s+заявок\s+до|заявки\s+до|закрытие\s+набора|deadline)[:\s-]*(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/i;
  const wordMatch = normalized.match(contextualWordRegex);
  if (wordMatch) {
    const day = Number(wordMatch[1]);
    const month = matchRussianMonth(wordMatch[2]);
    if (month) {
      const year = wordMatch[3]
        ? Number(wordMatch[3])
        : resolveYearForMonthDay(month, day, referenceDate);
      const iso = toIsoDate(year, month, day);
      if (iso) {
        return { deadline: iso, isExact: true };
      }
    }
  }

  // 2. Contextual numeric DD.MM.YYYY or DD.MM.YY or DD/MM/YYYY
  const contextualNumRegex =
    /(?:до|по|дедлайн|крайний\s+срок|при[её]м\s+заявок\s+до|заявки\s+до|deadline)[:\s-]*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/i;
  const numMatch = normalized.match(contextualNumRegex);
  if (numMatch) {
    const day = Number(numMatch[1]);
    const month = Number(numMatch[2]);
    let year: number;
    if (numMatch[3]) {
      year = numMatch[3].length === 2 ? 2000 + Number(numMatch[3]) : Number(numMatch[3]);
    } else {
      year = resolveYearForMonthDay(month, day, referenceDate);
    }
    const iso = toIsoDate(year, month, day);
    if (iso) {
      return { deadline: iso, isExact: true };
    }
  }

  // 3. Explicit ISO date YYYY-MM-DD (e.g., from JSON-LD validThrough)
  const isoRegex = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
  const isoMatch = normalized.match(isoRegex);
  if (isoMatch) {
    const iso = toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (iso) {
      return { deadline: iso, isExact: true };
    }
  }

  return { deadline: null, isExact: false };
}

export function addDaysIso(isoDate: string, days: number): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function formatIsoDateRu(isoDate: string | null): string {
  if (!isoDate) return '—';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function getDeadlineMeta(
  deadline: string | null,
  referenceDate: Date = new Date()
): DeadlineMeta {
  if (!deadline) {
    return {
      daysLeft: null,
      urgency: 'rolling',
      label: 'Открытый набор',
      formattedDate: 'Без срока',
    };
  }

  const match = deadline.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return {
      daysLeft: null,
      urgency: 'rolling',
      label: 'Не указан',
      formattedDate: deadline,
    };
  }

  const targetUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const todayUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const daysLeft = Math.round((targetUtc - todayUtc) / 86_400_000);
  const formattedDate = `${match[3]}.${match[2]}.${match[1]}`;

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      daysLeft,
      urgency: 'overdue',
      label: `Просрочен ${overdueDays} дн.`,
      formattedDate,
    };
  }

  if (daysLeft === 0) {
    return {
      daysLeft: 0,
      urgency: 'urgent',
      label: 'Сегодня последний день',
      formattedDate,
    };
  }

  if (daysLeft === 1) {
    return {
      daysLeft: 1,
      urgency: 'urgent',
      label: 'Завтра дедлайн',
      formattedDate,
    };
  }

  if (daysLeft <= 7) {
    return {
      daysLeft,
      urgency: 'urgent',
      label: `Осталось ${daysLeft} дн.`,
      formattedDate,
    };
  }

  if (daysLeft <= 14) {
    return {
      daysLeft,
      urgency: 'soon',
      label: `Через ${daysLeft} дн.`,
      formattedDate,
    };
  }

  return {
    daysLeft,
    urgency: 'normal',
    label: `Через ${daysLeft} дн.`,
    formattedDate,
  };
}
