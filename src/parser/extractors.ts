import * as cheerio from 'cheerio';
import type { Direction, GradeLevel, Internship, WorkFormat } from '../types/internship.ts';
import { addDaysIso, parseRussianDeadline } from '../utils/deadline.ts';

export interface HhRawVacancy {
  id: string;
  name: string;
  employer?: {
    id?: string;
    name?: string;
  };
  area?: {
    name?: string;
  };
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
    gross?: boolean | null;
  } | null;
  schedule?: {
    id?: string;
    name?: string;
  } | null;
  work_format?: Array<{ id?: string; name?: string }> | null;
  snippet?: {
    requirement?: string | null;
    responsibility?: string | null;
  } | null;
  published_at?: string | null;
  alternate_url?: string | null;
}

const KNOWN_RF_COMPANIES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /яндекс|yandex/i, canonical: 'Яндекс' },
  { pattern: /т-банк|тинькофф|t-bank|tinkoff|tbank/i, canonical: 'Т-Банк' },
  { pattern: /\bvk\b|вконтакте|(?:^|[\s"«])вк(?:$|[\s"»])|vk\s+tech|mail\.ru/i, canonical: 'VK' },
  { pattern: /сбер|sber/i, canonical: 'Сбер' },
  { pattern: /ozon|озон/i, canonical: 'Ozon' },
  { pattern: /авито|avito/i, canonical: 'Авито' },
  { pattern: /мтс|\bmts\b/i, canonical: 'МТС' },
  { pattern: /альфа-банк|альфа\s+банк|alfabank|alfa-bank/i, canonical: 'Альфа-Банк' },
  { pattern: /kaspersky|касперск/i, canonical: 'Лаборатория Касперского' },
  { pattern: /контур|kontur/i, canonical: 'СКБ Контур' },
  { pattern: /selectel|селектел/i, canonical: 'Selectel' },
  { pattern: /positive\s+technologies|позитив/i, canonical: 'Positive Technologies' },
  { pattern: /wildberries|вайлдберриз/i, canonical: 'Wildberries' },
  { pattern: /2гис|2gis/i, canonical: '2ГИС' },
  { pattern: /газпромбанк|gazprombank/i, canonical: 'Газпромбанк' },
  { pattern: /газпром\s*нефт/i, canonical: 'Газпром нефть' },
  { pattern: /сибур|sibur/i, canonical: 'СИБУР Диджитал' },
  { pattern: /ростелеком|rostelecom/i, canonical: 'Ростелеком' },
  { pattern: /ламода|lamoda/i, canonical: 'Lamoda Tech' },
  { pattern: /циан|cian/i, canonical: 'Циан' },
  { pattern: /x5\s*tech|x5\s*group|перекресток|пятерочка/i, canonical: 'X5 Tech' },
  { pattern: /самокат|samokat/i, canonical: 'Самокат Tech' },
  { pattern: /точка\s*банк|банк\s*точка/i, canonical: 'Точка Банк' },
  { pattern: /райффайзен|raiffeisen/i, canonical: 'Райффайзенбанк' },
  { pattern: /совкомбанк|sovcombank/i, canonical: 'Совкомбанк Технологии' },
  { pattern: /yadro|ядро/i, canonical: 'YADRO' },
  { pattern: /cloud\.ru/i, canonical: 'Cloud.ru' },
  { pattern: /visionlabs/i, canonical: 'VisionLabs' },
  { pattern: /ntechlab/i, canonical: 'NtechLab' },
  { pattern: /иннотех|холдинг\s+т1|\bт1\b/i, canonical: 'Холдинг Т1' },
  { pattern: /крок|\bcroc\b/i, canonical: 'КРОК' },
  { pattern: /цфт|центр\s+финансовых\s+технологий/i, canonical: 'ЦФТ' },
  { pattern: /авиасейлс|aviasales/i, canonical: 'Авиасейлс' },
  { pattern: /островок|ostrovok/i, canonical: 'Островок' },
  { pattern: /втб|\bvtb\b/i, canonical: 'ВТБ' },
  { pattern: /мегафон|megafon/i, canonical: 'МегаФон' },
  { pattern: /билайн|beeline|вымпелком/i, canonical: 'Билайн' },
];

export function normalizeCompanyName(rawName: string): string {
  const cleaned = rawName
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Компания РФ';
  for (const item of KNOWN_RF_COMPANIES) {
    if (item.pattern.test(cleaned)) {
      return item.canonical;
    }
  }
  return cleaned;
}

export function isEntryLevelTitle(title: string): boolean {
  return /(стаж[её]р|стажировк|\bintern\b|internship|co-op|coop|trainee|apprentice|werkstudent|working student|new\s*grad|graduate|early\s*career|entry[\s-]level|\bjunior\b|\bjr\.?\b|джуниор|джун|младш|university\s*grad|campus|fellowship|residency)/i.test(
    title
  );
}

export function detectGrade(title: string, fallback: GradeLevel = 'intern'): GradeLevel {
  const lower = title.toLowerCase();
  const isIntern =
    /(стаж[её]р|стажировк|\bintern\b|internship|co-op|trainee|werkstudent|working student|apprentice|bootcamp|camp|impulse|safeboard|young&&yandex|residency|fellow)/i.test(
      lower
    );
  const isJunior =
    /(junior|\bjr\.?\b|джуниор|джун|младш|new\s*grad|university\s*grad|graduate|entry[\s-]level|early\s*career|associate\s+engineer)/i.test(
      lower
    );
  if (isIntern && isJunior) return 'intern_junior';
  if (isJunior) return 'junior';
  if (isIntern) return 'intern';
  return fallback;
}

export function classifyDirection(title: string, description = ''): Direction {
  const titleLower = title.toLowerCase();
  const text = `${title} ${description}`.toLowerCase();

  if (
    /(machine learning|\bml\b|data scien|deep learning|нейросет|nlp|\bcv\b|computer vision|llm|\bai\b|искусственн|recsys|pytorch|tensorflow|applied scientist|research scientist|research engineer|reinforcement learning|generative|autonomous|robotics|perception)/i.test(
      text
    )
  ) {
    return 'ML / Data';
  }
  if (/(\bqa\b|тестиров|автотест|sdet|quality assurance|test engineer)/i.test(text)) {
    return 'QA';
  }
  if (/(backend|back-end|бэкенд|бэкэнд|серверн)/i.test(titleLower)) {
    return 'Backend';
  }
  if (
    /(аналитик|analyst|\bbi\b|data engineer|инженер данных|продуктовый аналитик|системный аналитик|analytics engineer)/i.test(
      text
    )
  ) {
    return 'Аналитика';
  }
  if (
    /(frontend|front-end|фронтенд|react|vue|angular|typescript|javascript|верстк|веб-разработ|web engineer)/i.test(
      text
    )
  ) {
    return 'Frontend';
  }
  if (/(ios|android|swift|kotlin|flutter|react native|мобильн|mobile engineer)/i.test(text)) {
    return 'Mobile';
  }
  if (
    /(devops|sre|site reliability|информационн\w*\s+безопасн|инфобез|appsec|cyber|secops|security engineer|безопасност|инфраструктур|infrastructure|kubernetes|linux|cloud engineer|platform engineer|systems engineer)/i.test(
      text
    )
  ) {
    return 'DevOps / Sec';
  }
  if (
    /(product manager|product design|продакт|продукт|ux|ui|дизайн|design|менеджер проекта|project manager)/i.test(
      text
    )
  ) {
    return 'Продукт / Дизайн';
  }
  if (
    /(backend|back-end|бэкенд|бэкэнд|go\b|golang|python|java\b|c\+\+|c#|node\.?js|rust|php|scala|ruby|elixir|разработчик\s+c\+\+|серверн|fastapi|django|spring|\.net|software engineer|software developer|distributed systems|storage|database|api engineer|full[\s-]?stack)/i.test(
      text
    )
  ) {
    return 'Backend';
  }
  return 'Другое';
}

export function detectWorkFormat(text: string, scheduleId?: string): WorkFormat {
  const lower = text.toLowerCase();
  if (scheduleId === 'remote' || /удален|удалён|remote|virtual first|distributed|anywhere/.test(lower)) {
    if (/гибрид|hybrid/.test(lower)) return 'Гибрид';
    return 'Удалённо';
  }
  if (/гибрид|hybrid/.test(lower)) {
    return 'Гибрид';
  }
  if (/офис|office|очно|on-site|onsite|in-person|in office/.test(lower) || scheduleId === 'fullDay') {
    return 'Офис';
  }
  return 'Не указано';
}

export function formatSalary(
  from?: number | null,
  to?: number | null,
  currency?: string | null
): string {
  const currSymbol = !currency || currency === 'RUR' || currency === 'RUB' ? '₽' : currency;
  const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  if (from && to && from !== to) {
    return `${fmt(from)} – ${fmt(to)} ${currSymbol}`;
  }
  if (from) {
    return `от ${fmt(from)} ${currSymbol}`;
  }
  if (to) {
    return `до ${fmt(to)} ${currSymbol}`;
  }
  return 'По итогам';
}

export function stripHtml(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeHhVacancy(
  raw: HhRawVacancy,
  referenceDate: Date = new Date(),
  defaultGrade: GradeLevel = 'intern'
): Internship {
  const title = stripHtml(raw.name) || 'Стажировка';
  const company = normalizeCompanyName(raw.employer?.name || 'Компания РФ');
  const requirement = stripHtml(raw.snippet?.requirement);
  const responsibility = stripHtml(raw.snippet?.responsibility);
  const combinedDesc = [requirement, responsibility].filter(Boolean).join(' ');

  const publishedIso = raw.published_at ? raw.published_at.slice(0, 10) : null;
  const explicit = parseRussianDeadline(`${title} ${combinedDesc}`, referenceDate);

  let deadline = explicit.deadline;
  let deadlineIsExact = explicit.isExact;

  if (!deadline && publishedIso) {
    deadline = addDaysIso(publishedIso, 30);
    deadlineIsExact = false;
  }

  const formatHints = [
    ...(raw.work_format?.map((f) => f.name || f.id || '') || []),
    raw.schedule?.name || '',
    combinedDesc,
  ].join(' ');

  const salaryFrom = raw.salary?.from ?? null;
  const salaryTo = raw.salary?.to ?? null;

  return {
    id: `hh-${raw.id}`,
    externalId: `hh-${raw.id}`,
    company,
    title,
    direction: classifyDirection(title, combinedDesc),
    grade: detectGrade(title, defaultGrade),
    market: 'ru',
    city: raw.area?.name || 'Россия',
    workFormat: detectWorkFormat(formatHints, raw.schedule?.id),
    salaryText: formatSalary(salaryFrom, salaryTo, raw.salary?.currency),
    salaryFrom,
    salaryTo,
    deadline,
    deadlineIsExact,
    publishedAt: publishedIso,
    sourceUrl: raw.alternate_url || `https://hh.ru/vacancy/${raw.id}`,
    sourceName: 'hh.ru',
    sourceType: 'hh_api',
    requirements: combinedDesc || 'Подробные требования указаны на странице вакансии hh.ru.',
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface HabrRawVacancy {
  id: number | string;
  href?: string;
  title?: string;
  remoteWork?: boolean;
  salaryQualification?: { title?: string } | null;
  publishedDate?: { date?: string; title?: string } | null;
  locations?: Array<{ title?: string }> | null;
  location?: { title?: string } | null;
  company?: { title?: string; alias_name?: string } | null;
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
    formatted?: string | null;
  } | null;
  skills?: Array<{ title?: string }> | null;
  divisions?: Array<{ title?: string }> | null;
}

export function normalizeHabrVacancy(
  raw: HabrRawVacancy,
  referenceDate: Date = new Date(),
  defaultGrade: GradeLevel = 'intern'
): Internship {
  const title = stripHtml(raw.title) || 'Стажировка';
  const company = normalizeCompanyName(raw.company?.title || 'IT-компания РФ');
  const skillsList = (raw.skills || []).map((s) => s.title || '').filter(Boolean);
  const divisionsList = (raw.divisions || []).map((d) => d.title || '').filter(Boolean);
  const combinedDesc = [...divisionsList, ...skillsList].join(', ');

  const publishedAt = raw.publishedDate?.date
    ? raw.publishedDate.date.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);

  const parsedDeadline = parseRussianDeadline(`${title} ${combinedDesc}`, referenceDate);
  const deadline = parsedDeadline.deadline || addDaysIso(publishedAt, 30);

  const locationNames = [
    ...(raw.locations || []).map((l) => l.title || ''),
    raw.location?.title || '',
  ].filter(Boolean);
  const city = locationNames[0] || (raw.remoteWork ? 'Удалённо (РФ)' : 'Россия');

  let workFormat: WorkFormat = raw.remoteWork ? 'Удалённо' : detectWorkFormat(`${title} ${combinedDesc}`);
  if (raw.remoteWork && locationNames.length > 0) {
    workFormat = 'Гибрид';
  } else if (!raw.remoteWork && locationNames.length > 0 && workFormat === 'Не указано') {
    workFormat = 'Офис';
  }

  const salaryFrom = raw.salary?.from ?? null;
  const salaryTo = raw.salary?.to ?? null;
  const salaryText =
    raw.salary?.formatted?.trim() || formatSalary(salaryFrom, salaryTo, raw.salary?.currency);

  const href = raw.href || `/vacancies/${raw.id}`;
  const sourceUrl = href.startsWith('http') ? href : `https://career.habr.com${href}`;
  const qualTitle = raw.salaryQualification?.title || '';
  const grade = detectGrade(`${title} ${qualTitle}`, defaultGrade);

  return {
    id: `habr-${raw.id}`,
    externalId: `habr-${raw.id}`,
    company,
    title,
    direction: classifyDirection(title, combinedDesc),
    grade,
    market: 'ru',
    city,
    workFormat,
    salaryText,
    salaryFrom,
    salaryTo,
    deadline,
    deadlineIsExact: parsedDeadline.isExact,
    publishedAt,
    sourceUrl,
    sourceName: 'Хабр Карьера',
    sourceType: 'habr_career',
    requirements:
      skillsList.length > 0
        ? `Стек и навыки: ${skillsList.join(', ')}.`
        : 'Подробные требования указаны на Хабр Карьере.',
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export function parseHabrCareerHtml(html: string, referenceDate: Date = new Date()): Internship[] {
  const $ = cheerio.load(html);
  const results: Internship[] = [];

  $('.vacancy-card').each((index, el) => {
    const card = $(el);
    const titleEl = card.find('.vacancy-card__title-link').first();
    const title = titleEl.text().trim();
    if (!title) return;

    const href = titleEl.attr('href') || '';
    const sourceUrl = href.startsWith('http') ? href : `https://career.habr.com${href}`;
    const companyRaw =
      card.find('.vacancy-card__company a').first().text().trim() ||
      card.find('.vacancy-card__company').first().text().trim() ||
      card.find('.vacancy-card__company-title').first().text().trim() ||
      'IT-компания РФ';
    const metaText = card.find('.vacancy-card__meta').text().trim();
    const skillsText = card.find('.vacancy-card__skills').text().trim();
    const salaryTextRaw = card.find('.vacancy-card__salary .basic-salary').text().trim();
    const dateAttr = card.find('time').attr('datetime');
    const publishedAt = dateAttr ? dateAttr.slice(0, 10) : referenceDate.toISOString().slice(0, 10);

    const parsedDeadline = parseRussianDeadline(`${title} ${metaText} ${skillsText}`, referenceDate);
    const deadline = parsedDeadline.deadline || addDaysIso(publishedAt, 30);

    const idMatch = href.match(/(\d+)/);
    const externalId = idMatch ? `habr-${idMatch[1]}` : `habr-${index}-${title.slice(0, 12)}`;

    const salaryNums = salaryTextRaw.match(/\d[\d\s]*/g)?.map((n) => Number(n.replace(/\s+/g, ''))) || [];

    results.push({
      id: externalId,
      externalId,
      company: normalizeCompanyName(companyRaw),
      title,
      direction: classifyDirection(title, skillsText),
      city: metaText.split('•')[0]?.trim() || 'Россия',
      workFormat: detectWorkFormat(`${metaText} ${title}`),
      salaryText: salaryTextRaw || 'По итогам',
      salaryFrom: salaryNums[0] ?? null,
      salaryTo: salaryNums[1] ?? null,
      deadline,
      deadlineIsExact: parsedDeadline.isExact,
      publishedAt,
      sourceUrl,
      sourceName: 'Хабр Карьера',
      sourceType: 'habr_career',
      requirements: skillsText || 'Навыки и требования указаны на Хабр Карьере.',
      applicationStatus: 'not_applied',
      notes: '',
      isStarred: false,
      parsedAt: referenceDate.toISOString(),
    });
  });

  return results;
}

/**
 * Parses an arbitrary Russian career / internship HTML page using JSON-LD JobPosting,
 * OpenGraph meta tags, and semantic headings/text heuristics.
 */
export function parseHtmlInternshipPage(
  html: string,
  url: string,
  referenceDate: Date = new Date()
): Internship {
  const $ = cheerio.load(html);

  let title = '';
  let company = '';
  let description = '';
  let city = 'Москва / РФ';
  let deadline: string | null = null;
  let deadlineIsExact = false;
  let salaryFrom: number | null = null;
  let salaryTo: number | null = null;

  // 1. Try JSON-LD JobPosting structured data first
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const rawJson = $(el).contents().text();
      if (!rawJson) return;
      const parsed = JSON.parse(rawJson);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (node && (node['@type'] === 'JobPosting' || node['@type']?.includes?.('JobPosting'))) {
          if (!title && typeof node.title === 'string') title = stripHtml(node.title);
          if (!company && node.hiringOrganization?.name) {
            company = normalizeCompanyName(String(node.hiringOrganization.name));
          }
          if (!description && typeof node.description === 'string') {
            description = stripHtml(node.description).slice(0, 320);
          }
          if (node.validThrough && typeof node.validThrough === 'string') {
            const iso = parseRussianDeadline(node.validThrough, referenceDate);
            if (iso.deadline) {
              deadline = iso.deadline;
              deadlineIsExact = true;
            }
          }
          const loc = node.jobLocation?.address?.addressLocality;
          if (loc) city = String(loc);
          const minVal = Number(node.baseSalary?.value?.minValue);
          const maxVal = Number(node.baseSalary?.value?.maxValue);
          if (!Number.isNaN(minVal) && minVal > 0) salaryFrom = minVal;
          if (!Number.isNaN(maxVal) && maxVal > 0) salaryTo = maxVal;
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });

  // 2. Fallback to OpenGraph / Title / H1
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const ogSite = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const ogDesc =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    '';
  const h1Text = $('h1').first().text().trim();
  const docTitle = $('title').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);

  if (!title) {
    title = h1Text || ogTitle || docTitle || bodyText.split(/[.!\n]/)[0]?.trim() || 'Стажировка';
  }

  let hostname = 'career.ru';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // keep default
  }

  if (!company) {
    if (ogSite) {
      company = normalizeCompanyName(ogSite);
    } else {
      // Check if any known RF company appears in title/body text
      const textSample = `${title} ${bodyText.slice(0, 500)}`;
      const matchedKnown = KNOWN_RF_COMPANIES.find((c) => c.pattern.test(textSample));
      company = matchedKnown ? matchedKnown.canonical : normalizeCompanyName(hostname);
    }
  }

  if (!description) {
    description = ogDesc || bodyText.slice(0, 260);
  }

  if (!deadline) {
    const extracted = parseRussianDeadline(`${title} ${ogDesc} ${bodyText}`, referenceDate);
    deadline = extracted.deadline;
    deadlineIsExact = extracted.isExact;
  }

  // Extract salary in RUB from page text if not found in JSON-LD
  if (!salaryFrom && !salaryTo) {
    const salMatch = bodyText.match(/(?:от|до)?\s*(\d{2,3}[\s\u00a0]?\d{3})\s*(?:₽|руб)/i);
    if (salMatch) {
      const val = Number(salMatch[1].replace(/[\s\u00a0]/g, ''));
      if (val >= 15000 && val <= 500000) {
        salaryFrom = val;
      }
    }
  }

  const idSlug = Buffer.from(`${url}:${title.slice(0, 40)}`).toString('base64url').slice(0, 16);

  return {
    id: `url-${idSlug}`,
    externalId: `url-${idSlug}`,
    company,
    title: title.slice(0, 140),
    direction: classifyDirection(title, description),
    city,
    workFormat: detectWorkFormat(`${title} ${description} ${bodyText.slice(0, 1500)}`),
    salaryText: formatSalary(salaryFrom, salaryTo, 'RUB'),
    salaryFrom,
    salaryTo,
    deadline,
    deadlineIsExact,
    publishedAt: referenceDate.toISOString().slice(0, 10),
    sourceUrl: url,
    sourceName: hostname,
    sourceType: 'custom_url',
    requirements: description || 'Импортировано со страницы компании.',
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface GreenhouseRawJob {
  id: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string } | null;
  departments?: Array<{ name?: string }> | null;
  content?: string | null;
}

function computeOpenAtsDeadline(
  publishedAt: string,
  windowDays: number,
  referenceDate: Date
): string | null {
  const candidate = addDaysIso(publishedAt, windowDays);
  const todayIso = referenceDate.toISOString().slice(0, 10);
  // Active ATS requisitions are often evergreen (updated/re-used across seasons):
  // never mark a live open ATS role as overdue based on an old first_published date.
  if (!candidate || candidate < todayIso) return null;
  return candidate;
}

export function normalizeGreenhouseJob(
  raw: GreenhouseRawJob,
  companyName: string,
  boardSlug: string,
  referenceDate: Date = new Date()
): Internship {
  const title = stripHtml(raw.title) || 'Software Engineering Intern';
  const locName = raw.location?.name?.trim() || 'Global';
  const deptNames = (raw.departments || []).map((d) => d.name || '').filter(Boolean).join(', ');
  const publishedAt = (raw.updated_at || raw.first_published || '').slice(0, 10) ||
    referenceDate.toISOString().slice(0, 10);
  const deadline = computeOpenAtsDeadline(publishedAt, 45, referenceDate);
  const city = locName.split(';')[0].split('|')[0].trim().slice(0, 48) || 'Global';
  const workFormat = detectWorkFormat(`${locName} ${title} ${deptNames}`);

  return {
    id: `gh-${boardSlug}-${raw.id}`,
    externalId: `gh-${boardSlug}-${raw.id}`,
    company: companyName,
    title,
    direction: classifyDirection(title, deptNames),
    grade: detectGrade(title, 'intern'),
    market: 'global',
    city,
    workFormat: workFormat === 'Не указано' ? (/remote/i.test(locName) ? 'Удалённо' : 'Гибрид') : workFormat,
    salaryText: 'По итогам (Global)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl: raw.absolute_url || `https://boards.greenhouse.io/${boardSlug}/jobs/${raw.id}`,
    sourceName: 'Greenhouse',
    sourceType: 'greenhouse',
    requirements: deptNames
      ? `Отдел: ${deptNames}. Локация: ${locName}.`
      : `Официальная вакансия ${companyName} (Greenhouse). Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface AshbyRawJob {
  id: string;
  title?: string;
  department?: string | null;
  team?: string | null;
  location?: string | null;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  compensationTierSummary?: string | null;
}

export function normalizeAshbyJob(
  raw: AshbyRawJob,
  companyName: string,
  boardSlug: string,
  referenceDate: Date = new Date()
): Internship {
  const title = stripHtml(raw.title) || 'Engineering Intern / New Grad';
  const locName = raw.location?.trim() || (raw.isRemote ? 'Remote' : 'Global');
  const dept = [raw.department, raw.team].filter(Boolean).join(' · ');
  const publishedAt = raw.publishedAt
    ? raw.publishedAt.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);
  const deadline = computeOpenAtsDeadline(publishedAt, 45, referenceDate);

  let workFormat: WorkFormat = detectWorkFormat(
    `${raw.workplaceType || ''} ${locName} ${title}`
  );
  if (raw.isRemote && workFormat === 'Не указано') {
    workFormat = 'Удалённо';
  } else if (workFormat === 'Не указано') {
    workFormat = 'Гибрид';
  }

  return {
    id: `ashby-${boardSlug}-${raw.id}`,
    externalId: `ashby-${boardSlug}-${raw.id}`,
    company: companyName,
    title,
    direction: classifyDirection(title, dept),
    grade: detectGrade(title, 'intern'),
    market: 'global',
    city: locName.split(',')[0].trim().slice(0, 48) || 'Global',
    workFormat,
    salaryText: raw.compensationTierSummary?.trim() || 'По итогам (Global)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl: raw.jobUrl || raw.applyUrl || `https://jobs.ashbyhq.com/${boardSlug}/${raw.id}`,
    sourceName: 'Ashby',
    sourceType: 'ashby',
    requirements: dept
      ? `Команда: ${dept}. Локация: ${locName}.`
      : `Официальная вакансия ${companyName} (Ashby). Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface LeverRawJob {
  id: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
  };
}

export function normalizeLeverJob(
  raw: LeverRawJob,
  companyName: string,
  boardSlug: string,
  referenceDate: Date = new Date()
): Internship {
  const title = stripHtml(raw.text) || 'Software Engineer Intern';
  const locName = raw.categories?.location?.trim() || 'Global';
  const team = [raw.categories?.department, raw.categories?.team].filter(Boolean).join(' · ');
  const publishedAt = raw.createdAt
    ? new Date(raw.createdAt).toISOString().slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);
  const deadline = computeOpenAtsDeadline(publishedAt, 45, referenceDate);

  const workFormat = detectWorkFormat(
    `${raw.workplaceType || ''} ${locName} ${title}`
  );

  return {
    id: `lever-${boardSlug}-${raw.id}`,
    externalId: `lever-${boardSlug}-${raw.id}`,
    company: companyName,
    title,
    direction: classifyDirection(title, team),
    grade: detectGrade(title, 'intern'),
    market: 'global',
    city: locName.split(',')[0].trim().slice(0, 48) || 'Global',
    workFormat: workFormat === 'Не указано' ? 'Гибрид' : workFormat,
    salaryText: 'По итогам (Global)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl: raw.hostedUrl || `https://jobs.lever.co/${boardSlug}/${raw.id}`,
    sourceName: 'Lever',
    sourceType: 'lever',
    requirements: team
      ? `Команда: ${team}. Локация: ${locName}.`
      : `Официальная вакансия ${companyName} (Lever). Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface ArbeitnowRawJob {
  slug: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  location?: string;
  created_at?: number;
}

export function normalizeArbeitnowJob(
  raw: ArbeitnowRawJob,
  referenceDate: Date = new Date()
): Internship {
  const title = stripHtml(raw.title) || 'Junior / Working Student';
  const company = stripHtml(raw.company_name) || 'EU Tech Company';
  const tags = (raw.tags || []).join(', ');
  const locName = raw.location?.trim() || (raw.remote ? 'Remote (EU)' : 'Europe');
  const publishedAt = raw.created_at
    ? new Date(raw.created_at * 1000).toISOString().slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);
  const deadline = computeOpenAtsDeadline(publishedAt, 35, referenceDate);

  const workFormat: WorkFormat = raw.remote
    ? 'Удалённо'
    : detectWorkFormat(`${locName} ${tags} ${title}`);

  return {
    id: `arbeitnow-${raw.slug}`,
    externalId: `arbeitnow-${raw.slug}`,
    company,
    title,
    direction: classifyDirection(title, `${tags} ${stripHtml(raw.description).slice(0, 300)}`),
    grade: detectGrade(title, 'junior'),
    market: 'global',
    city: locName.split(',')[0].trim().slice(0, 48) || 'Europe',
    workFormat: workFormat === 'Не указано' ? 'Гибрид' : workFormat,
    salaryText: 'По итогам (EU)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl: raw.url || `https://www.arbeitnow.com/view/${raw.slug}`,
    sourceName: 'Arbeitnow EU',
    sourceType: 'arbeitnow',
    requirements: tags
      ? `Теги: ${tags}. Локация: ${locName}.`
      : `Европейская вакансия (Arbeitnow). Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}
