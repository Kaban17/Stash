import type {
  ApplicationStatus,
  FilterState,
  Internship,
  SortConfig,
} from '../types/internship.ts';
import { getDeadlineMeta } from './deadline.ts';

export const EXPIRED_HIDE_THRESHOLD_DAYS = 7;

export function isExpiredBeyondThreshold(
  deadline: string | null,
  referenceDate: Date = new Date(),
  thresholdDays: number = EXPIRED_HIDE_THRESHOLD_DAYS
): boolean {
  const meta = getDeadlineMeta(deadline, referenceDate);
  return meta.daysLeft !== null && meta.daysLeft < -thresholdDays;
}

export function filterOutLegacySeeds(items: Internship[]): Internship[] {
  return items.filter(
    (item) => typeof item?.id === 'string' && !item.id.startsWith('seed-')
  );
}

const LEGAL_FORM_PREFIX_RE = /^(ооо|ао|пао|зао|оао|нко|ип|llc|inc|ltd)\s+/i;

export function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, ' ')
    .replace(LEGAL_FORM_PREFIX_RE, '')
    .replace(/[\s._/(),]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isCompanyExcluded(
  companyName: string,
  excludedCompanies: readonly string[]
): boolean {
  if (!companyName || excludedCompanies.length === 0) return false;
  const target = normalizeCompanyKey(companyName);
  if (!target) return false;

  for (const raw of excludedCompanies) {
    const excluded = normalizeCompanyKey(raw);
    if (!excluded) continue;
    if (target === excluded) return true;
    // Match whole-word brand variants (e.g. "Ozon" excludes "Ozon Tech", "Palantir" excludes "Palantir Technologies")
    // without false positives on short substrings inside unrelated words.
    if (excluded.length >= 2) {
      const pattern = new RegExp(`(^|[\\s-])${escapeRegExp(excluded)}($|[\\s-])`, 'i');
      if (pattern.test(target)) return true;
    }
  }
  return false;
}

export function addExcludedCompanies(
  current: readonly string[],
  rawInput: string
): string[] {
  const parts = rawInput
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return [...current];

  const seen = new Set(current.map((c) => normalizeCompanyKey(c)).filter(Boolean));
  const next = [...current];

  for (const part of parts) {
    const key = normalizeCompanyKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(part);
  }
  return next;
}

export function removeExcludedCompany(
  current: readonly string[],
  companyName: string
): string[] {
  const targetKey = normalizeCompanyKey(companyName);
  if (!targetKey) return [...current];
  return current.filter((item) => normalizeCompanyKey(item) !== targetKey);
}

export function toggleExcludedCompany(
  current: readonly string[],
  companyName: string
): string[] {
  const cleaned = companyName.trim();
  const targetKey = normalizeCompanyKey(cleaned);
  if (!targetKey) return [...current];

  const exists = current.some((item) => normalizeCompanyKey(item) === targetKey);
  if (exists) {
    return current.filter((item) => normalizeCompanyKey(item) !== targetKey);
  }
  return [...current, cleaned];
}

const STATUS_ORDER: Record<ApplicationStatus, number> = {
  offer: 1,
  interview: 2,
  test_task: 3,
  applied: 4,
  planned: 5,
  not_applied: 6,
  rejected: 7,
};

const IN_PROGRESS_STATUSES = new Set<ApplicationStatus>([
  'applied',
  'test_task',
  'interview',
  'offer',
]);

export interface DashboardMetrics {
  total: number;
  urgentCount: number;
  inProgressCount: number;
  nearestDeadline: {
    company: string;
    title: string;
    dateFormatted: string;
    daysLeft: number;
  } | null;
}

export function computeDashboardMetrics(
  items: Internship[],
  referenceDate: Date = new Date()
): DashboardMetrics {
  let urgentCount = 0;
  let inProgressCount = 0;
  let nearest: DashboardMetrics['nearestDeadline'] = null;

  for (const item of items) {
    const meta = getDeadlineMeta(item.deadline, referenceDate);
    const isRejectedOrOffer =
      item.applicationStatus === 'rejected' || item.applicationStatus === 'offer';

    if (
      !isRejectedOrOffer &&
      (meta.urgency === 'urgent' || meta.urgency === 'overdue')
    ) {
      urgentCount += 1;
    }

    if (IN_PROGRESS_STATUSES.has(item.applicationStatus)) {
      inProgressCount += 1;
    }

    if (
      !isRejectedOrOffer &&
      meta.daysLeft !== null &&
      meta.daysLeft >= 0 &&
      (nearest === null || meta.daysLeft < nearest.daysLeft)
    ) {
      nearest = {
        company: item.company,
        title: item.title,
        dateFormatted: meta.formattedDate,
        daysLeft: meta.daysLeft,
      };
    }
  }

  return {
    total: items.length,
    urgentCount,
    inProgressCount,
    nearestDeadline: nearest,
  };
}

const WORK_FORMAT_ORDER: Record<string, number> = {
  Удалённо: 1,
  Гибрид: 2,
  Офис: 3,
  'Не указано': 4,
};

export function filterAndSortInternships(
  items: Internship[],
  filters: FilterState,
  sort: SortConfig,
  referenceDate: Date = new Date()
): Internship[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.market !== 'all') {
      const itemMarket = item.market || 'ru';
      if (itemMarket !== filters.market) return false;
    }
    if (filters.company !== 'all' && item.company !== filters.company) {
      return false;
    }
    if (filters.city !== 'all' && item.city !== filters.city) {
      return false;
    }
    if (filters.backendMlOnly && item.direction !== 'Backend' && item.direction !== 'ML / Data') {
      return false;
    }
    if (filters.direction !== 'all' && item.direction !== filters.direction) {
      return false;
    }
    if (filters.workFormat !== 'all' && item.workFormat !== filters.workFormat) {
      return false;
    }
    if (filters.grade !== 'all') {
      const itemGrade = item.grade || 'intern';
      if (filters.grade === 'intern' && itemGrade === 'junior') return false;
      if (filters.grade === 'junior' && itemGrade === 'intern') return false;
      if (filters.grade === 'intern_junior' && itemGrade !== 'intern_junior') return false;
    }

    const meta = getDeadlineMeta(item.deadline, referenceDate);
    if (filters.hideExpired && isExpiredBeyondThreshold(item.deadline, referenceDate)) {
      return false;
    }

    if (filters.quickFilter === 'urgent') {
      if (meta.urgency !== 'urgent' && meta.urgency !== 'overdue') {
        return false;
      }
    } else if (filters.quickFilter === 'to_apply') {
      if (item.applicationStatus !== 'not_applied' && item.applicationStatus !== 'planned') {
        return false;
      }
    } else if (filters.quickFilter === 'in_progress') {
      if (!IN_PROGRESS_STATUSES.has(item.applicationStatus)) {
        return false;
      }
    } else if (filters.quickFilter === 'starred') {
      if (!item.isStarred) return false;
    }

    if (query) {
      const haystack =
        `${item.company} ${item.title} ${item.direction} ${item.city} ${item.workFormat} ${item.requirements} ${item.notes} ${item.sourceName}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const dir = sort.order === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    if (sort.field === 'deadline') {
      if (!a.deadline && !b.deadline) return a.company.localeCompare(b.company, 'ru');
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      const cmp = a.deadline.localeCompare(b.deadline);
      return cmp !== 0 ? cmp * dir : a.company.localeCompare(b.company, 'ru');
    }

    if (sort.field === 'company') {
      const cmp = a.company.localeCompare(b.company, 'ru');
      return cmp !== 0 ? cmp * dir : a.title.localeCompare(b.title, 'ru');
    }

    if (sort.field === 'direction') {
      const cmp = a.direction.localeCompare(b.direction, 'ru');
      return cmp !== 0 ? cmp * dir : a.company.localeCompare(b.company, 'ru');
    }

    if (sort.field === 'city') {
      const cmp = a.city.localeCompare(b.city, 'ru');
      return cmp !== 0 ? cmp * dir : a.company.localeCompare(b.company, 'ru');
    }

    if (sort.field === 'workFormat') {
      const orderA = WORK_FORMAT_ORDER[a.workFormat] ?? 99;
      const orderB = WORK_FORMAT_ORDER[b.workFormat] ?? 99;
      if (orderA !== orderB) return (orderA - orderB) * dir;
      return a.company.localeCompare(b.company, 'ru');
    }

    if (sort.field === 'salary') {
      const salA = a.salaryTo ?? a.salaryFrom ?? -1;
      const salB = b.salaryTo ?? b.salaryFrom ?? -1;
      if (salA === -1 && salB === -1) return 0;
      if (salA === -1) return 1;
      if (salB === -1) return -1;
      return (salA - salB) * dir;
    }

    if (sort.field === 'status') {
      return (STATUS_ORDER[a.applicationStatus] - STATUS_ORDER[b.applicationStatus]) * dir;
    }

    if (sort.field === 'publishedAt') {
      const pA = a.publishedAt || '';
      const pB = b.publishedAt || '';
      return pA.localeCompare(pB) * dir;
    }

    return 0;
  });
}

function buildDedupeKey(item: Pick<Internship, 'externalId' | 'company' | 'title'>): string {
  if (item.externalId) return `ext:${item.externalId.toLowerCase()}`;
  return `ct:${item.company.trim().toLowerCase()}::${item.title.trim().toLowerCase()}`;
}

/**
 * Merges incoming parsed internships into the existing tracked list while preserving
 * user-managed status, notes, star flag, and custom deadline overrides.
 */
export function deduplicateInternships(
  existing: Internship[],
  incoming: Internship[]
): { merged: Internship[]; addedCount: number; updatedCount: number } {
  const byKey = new Map<string, Internship>();
  const byTitleKey = new Map<string, string>();

  for (const item of existing) {
    const key = buildDedupeKey(item);
    byKey.set(key, item);
    byTitleKey.set(`${item.company.toLowerCase()}::${item.title.toLowerCase()}`, key);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of incoming) {
    const directKey = buildDedupeKey(item);
    const titleKey = `${item.company.toLowerCase()}::${item.title.toLowerCase()}`;
    const matchedKey = byKey.has(directKey) ? directKey : byTitleKey.get(titleKey);

    if (matchedKey) {
      const prev = byKey.get(matchedKey)!;
      byKey.set(matchedKey, {
        ...item,
        id: prev.id,
        applicationStatus: prev.applicationStatus,
        notes: prev.notes,
        isStarred: prev.isStarred,
        // Preserve exact user-edited deadline if incoming is only estimated or missing
        deadline: prev.deadlineIsExact && !item.deadlineIsExact ? prev.deadline : item.deadline ?? prev.deadline,
        deadlineIsExact: prev.deadlineIsExact || item.deadlineIsExact,
      });
      updatedCount += 1;
    } else {
      byKey.set(directKey, item);
      byTitleKey.set(titleKey, directKey);
      addedCount += 1;
    }
  }

  return {
    merged: Array.from(byKey.values()),
    addedCount,
    updatedCount,
  };
}
