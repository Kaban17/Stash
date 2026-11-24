/**
 * Utilities for formatting and classifying direct vacancy URLs shown in the table.
 */

const DIRECT_VACANCY_PATTERNS: RegExp[] = [
  /career\.habr\.com\/vacancies\/\d+/i,
  /hh\.ru\/vacancy\/\d+/i,
  /[?&]gh_jid=\d+/i,
  /greenhouse\.io\/[^/]+\/jobs\/\d+/i,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f-]{8,}/i,
  /jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{8,}/i,
  /arbeitnow\.com\/jobs\/companies\/[^/]+\/[^/]+/i,
  /amododesign\.com\/career\/[a-z0-9-]+/i,
  /ycombinator\.com\/companies\/[^/]+\/jobs\/[a-z0-9_-]+/i,
  /smartrecruiters\.com\/[^/]+\/[a-z0-9_-]+/i,
  /yandex\.ru\/yaintern\/[a-z0-9-]+/i,
  /\/vacanc(y|ies)\/[a-z0-9_-]{3,}/i,
  /\/career\/[a-z0-9_-]{3,}/i,
  /\/jobs?\/[a-z0-9_-]{4,}/i,
];

/**
 * Formats a full vacancy URL into a clean, readable label for compact table display
 * while preserving the domain and identifying vacancy path/query segment.
 */
export function formatDirectLinkLabel(rawUrl: string, maxLength = 34): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '—';

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '');
    const cleanPath = parsed.pathname.replace(/\/+$/, '');

    // Preserve identifying ATS query parameters such as ?gh_jid=12345 or ?cat=stazhirovki
    const ghJid = parsed.searchParams.get('gh_jid');
    const cat = parsed.searchParams.get('cat');
    const querySuffix = ghJid
      ? `?gh_jid=${ghJid}`
      : cat
        ? `?cat=${cat}`
        : '';

    const fullCompact = `${host}${cleanPath}${querySuffix}`;
    if (fullCompact.length <= maxLength) {
      return fullCompact;
    }

    // Keep host + trailing identifying segment when the intermediate path is verbose
    const segments = cleanPath.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const lastSeg = segments[segments.length - 1];
      const shortenedLast =
        lastSeg.length > 12 && /^[0-9a-f-]{12,}$/i.test(lastSeg)
          ? `${lastSeg.slice(0, 8)}…`
          : lastSeg;
      const candidate = `${host}/…/${shortenedLast}${querySuffix}`;
      if (candidate.length <= maxLength) {
        return candidate;
      }
    }

    return `${fullCompact.slice(0, Math.max(12, maxLength - 1))}…`;
  } catch {
    const stripped = trimmed.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
    if (stripped.length <= maxLength) return stripped;
    return `${stripped.slice(0, Math.max(12, maxLength - 1))}…`;
  }
}

/**
 * Returns true if the URL points to a specific vacancy or concrete program track
 * rather than a generic company homepage.
 */
export function isDirectVacancyUrl(rawUrl: string): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  return DIRECT_VACANCY_PATTERNS.some((pattern) => pattern.test(trimmed));
}
