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
  return /(стаж[её]р|стажировк|\binterns?\b|internship|co-op|coop|trainee|apprentice|werkstudent|working student|new\s*grads?|graduate|early\s*career|entry[\s-]level|\bjunior\b|\bjr\.?\b|джуниор|джун|младш|university\s*grad|campus|fellowship|residency)/i.test(
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
    /(backend|back-end|бэкенд|бэкэнд|go\b|golang|python|java\b|c\+\+|c#|node\.?js|rust|php|scala|ruby|elixir|разработчик\s+c\+\+|серверн|fastapi|django|spring|\.net|software\s+dev(?:elopment|eloper)?|software\s+engineer|\bsde\b|firmware|embedded|distributed systems|storage|database|api engineer|full[\s-]?stack)/i.test(
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

function sanitizeExternalUrl(rawHref: string | undefined, baseOrigin: string): string | null {
  const trimmed = (rawHref || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

const ENGLISH_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseEnglishDeadline(
  text: string,
  referenceDate: Date
): { deadline: string | null; isExact: boolean } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const m1 = text.match(
    /(?:apply\s+by|deadline(?:\s+is)?|closes?(?:\s+on)?|due\s+by)\s*[:\-]?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i
  );
  if (m1) {
    const month = ENGLISH_MONTHS[m1[1].toLowerCase()];
    const day = Number(m1[2]);
    const year = m1[3] ? Number(m1[3]) : referenceDate.getUTCFullYear();
    if (month && day >= 1 && day <= 31 && year >= 2024 && year <= 2035) {
      return { deadline: `${year}-${pad(month)}-${pad(day)}`, isExact: true };
    }
  }
  const m2 = text.match(
    /(?:apply\s+by|deadline(?:\s+is)?|closes?(?:\s+on)?|due\s+by)\s*[:\-]?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s*(\d{4}))?/i
  );
  if (m2) {
    const day = Number(m2[1]);
    const month = ENGLISH_MONTHS[m2[2].toLowerCase()];
    const year = m2[3] ? Number(m2[3]) : referenceDate.getUTCFullYear();
    if (month && day >= 1 && day <= 31 && year >= 2024 && year <= 2035) {
      return { deadline: `${year}-${pad(month)}-${pad(day)}`, isExact: true };
    }
  }
  return { deadline: null, isExact: false };
}

function isHnJobSeekerPost(headerLine: string, bodyText: string): boolean {
  const sample = `${headerLine} ${bodyText.slice(0, 380)}`;
  if (/^\s*(location|remote|willing to relocate|technologies|r[eé]sum[eé]|cv|email)\s*:/i.test(headerLine)) {
    return true;
  }
  if (/\bwilling to relocate\s*:/i.test(sample) || /\br[eé]sum[eé]\s*\/\s*cv\s*:/i.test(sample)) {
    return true;
  }
  if (/\bi['’]?m\s+a\s+[^.]{0,60}\blooking for\b/i.test(sample)) {
    return true;
  }
  return false;
}

function isHnEntryLevelPosting(headerLine: string, bodyText: string): boolean {
  if (isEntryLevelTitle(headerLine)) return true;
  return (
    /\b(202\d\s+interns?|summer\s+internships?|engineering\s+intern|ai\s+engineer\s+intern|software\s+engineer\s+intern|ml\s+intern|data\s+science\s+intern|early[\s-]career|new\s*grads?|entry[\s-]level|junior\s+to\s+senior|junior\s+(software|backend|frontend|fullstack|full-stack|ml|ai|data|engineer|developer))\b/i.test(
      bodyText
    ) ||
    /(hiring|looking for|openings?|positions?|roles?).{0,80}\b(interns?|internship|co-op|new\s*grads?|early[\s-]career|entry[\s-]level|junior|apprentice|fellowship|working\s*student)\b/i.test(
      bodyText
    )
  );
}

function pickBestHnJobUrl(urls: string[], fallbackUrl: string): string {
  const filtered = urls.filter((u) => {
    const lower = u.toLowerCase();
    if (lower.includes('news.ycombinator.com/user')) return false;
    if (lower.includes('drive.google.com')) return false;
    if (/linkedin\.com\/in\//i.test(lower)) return false;
    if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/?$/i.test(lower)) return false;
    return true;
  });

  if (filtered.length === 0) return fallbackUrl;

  const jobUrlPattern =
    /(jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.ashbyhq\.com|smartrecruiters\.com|workable\.com|ycombinator\.com\/companies\/[^/]+\/jobs|linkedin\.com\/jobs\/view|\/careers?\b|\/jobs?\b|\/intern|\/apply|\/join)/i;
  const preferred = filtered.find((u) => jobUrlPattern.test(u));
  return preferred || filtered[0];
}

function extractCompactForeignSalary(text: string): {
  salaryText: string;
  salaryFrom: number | null;
  salaryTo: number | null;
} {
  const match = text.match(
    /([$€£])\s?(\d{2,3}(?:[,\s]\d{3}|\.\d+)?\s?k?)\s*(?:[-–—to]+\s*([$€£])?\s?(\d{2,3}(?:[,\s]\d{3}|\.\d+)?\s?k?))?/i
  );
  if (!match) {
    return { salaryText: 'По итогам (Global)', salaryFrom: null, salaryTo: null };
  }

  const symbol = match[1];
  const parseMoney = (raw?: string): number | null => {
    if (!raw) return null;
    const cleaned = raw.trim().toLowerCase();
    if (cleaned.endsWith('k')) {
      const n = Number(cleaned.slice(0, -1).replace(/,/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
    }
    const n = Number(cleaned.replace(/[,\s]/g, ''));
    return Number.isFinite(n) && n >= 1000 ? Math.round(n) : null;
  };

  const from = parseMoney(match[2]);
  const to = parseMoney(match[4]);
  if (!from && !to) {
    return { salaryText: 'По итогам (Global)', salaryFrom: null, salaryTo: null };
  }
  const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  if (from && to && from !== to) {
    return { salaryText: `${symbol}${fmt(from)} – ${symbol}${fmt(to)}`, salaryFrom: from, salaryTo: to };
  }
  const single = from ?? to!;
  return { salaryText: `${symbol}${fmt(single)}`, salaryFrom: from, salaryTo: to };
}

function isHnMetaSegment(seg: string): boolean {
  const trimmed = seg.trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(full[\s-]?time|part[\s-]?time|contract|internships?\s+only|visa\s+sponsored?)$/i.test(trimmed)) {
    return true;
  }
  if (/^([$€£]|chf|usd|eur|gbp)\s*\d/i.test(trimmed)) return true;
  if (/^(remote|onsite|on-site|hybrid)(\s*\([^)]*\))?$/i.test(trimmed)) return true;
  return false;
}

function isHnLocationSegment(seg: string): boolean {
  return /\b(remote|onsite|on-site|hybrid|usa|us\b|uk\b|eu\b|global|worldwide|london|new york|nyc|san francisco|sf\b|berlin|paris|geneva|switzerland|belgium|germany|canada|india|singapore|tokyo|austin|seattle|boston|tempe|california|virginia|brussels)\b/i.test(
    seg
  );
}

/**
 * Parses a technology listing page from https://hnhiring.com/technologies/<slug>.
 */
export function parseHnHiringHtml(
  html: string,
  techSlug: string,
  referenceDate: Date = new Date(),
  options: { entryLevelOnly?: boolean } = {}
): Internship[] {
  const entryLevelOnly = options.entryLevelOnly !== false;
  const $ = cheerio.load(html);
  const results: Internship[] = [];
  const seen = new Set<string>();
  const fallbackUrl = `https://hnhiring.com/technologies/${encodeURIComponent(techSlug)}`;

  $('li.job').each((_, el) => {
    const job = $(el);
    const author = job.find('.user a').first().text().trim() || 'hn';
    const rawDate = job.find('.type-info').first().text().trim();
    const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : referenceDate.toISOString().slice(0, 10);

    const bodyEl = job.find('.body').first();
    if (!bodyEl.length) return;

    // Extract the leading pipe-separated header before <p> tags cleanly
    const directTextParts: string[] = [];
    bodyEl.contents().each((__, node) => {
      if (node.type === 'text') {
        const t = (node.data || '').trim();
        if (t) directTextParts.push(t);
      } else if (node.type === 'tag' && node.name === 'a' && directTextParts.length > 0) {
        const t = $(node).text().trim();
        if (t) directTextParts.push(t);
      } else if (node.type === 'tag' && node.name === 'p' && directTextParts.length > 0) {
        return false;
      }
    });

    const paragraphs = bodyEl
      .find('p')
      .map((__, p) => $(p).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    const headerLine = (directTextParts.join(' ') || paragraphs[0] || '')
      .replace(/\s+/g, ' ')
      .trim();
    const bodyText = [headerLine, ...paragraphs].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!headerLine || headerLine.length < 6) return;

    if (isHnJobSeekerPost(headerLine, bodyText)) return;
    if (entryLevelOnly && !isHnEntryLevelPosting(headerLine, bodyText)) return;

    const segments = headerLine
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    const rawCompany = (segments[0] || 'HN Startup')
      .replace(/^\*+\s*/, '')
      .replace(/\s*[:\-–]\s*https?:\/\/\S+/gi, '')
      .replace(/https?:\/\/\S+/gi, '')
      .trim();
    const company = (rawCompany || 'HN Startup').slice(0, 64);

    const restSegments = segments.slice(1);
    const roleCandidates = restSegments.filter(
      (s) => !isHnMetaSegment(s) && (!isHnLocationSegment(s) || /(engineer|developer|intern|grad|analyst|scientist|research|ops|designer|manager|architect|specialist|data|ml|ai)/i.test(s))
    );
    let title =
      roleCandidates.find((s) => isEntryLevelTitle(s)) ||
      roleCandidates[0] ||
      `Software / ${techSlug.toUpperCase()} Role`;
    title = title.replace(/https?:\/\/\S+/gi, '').trim().slice(0, 120) || 'Software Engineer';

    const locSegment =
      restSegments.find((s) => isHnLocationSegment(s) && s !== title) ||
      restSegments.find((s) => /\b(remote|onsite|on-site|hybrid)\b/i.test(s)) ||
      '';
    const cityClean = locSegment
      .replace(/\b(onsite|on-site|hybrid|full-time|part-time)\b/gi, '')
      .replace(/^[(\s,:-]+|[)\s,:-]+$/g, '')
      .trim();
    const city = (cityClean || (/remote/i.test(bodyText) ? 'Remote (Global)' : 'Global')).slice(0, 48);

    const workFormatRaw = detectWorkFormat(`${headerLine} ${bodyText.slice(0, 400)}`);
    const workFormat: WorkFormat = workFormatRaw === 'Не указано' ? 'Удалённо' : workFormatRaw;

    const extractedUrls = bodyEl
      .find('a[href]')
      .map((__, a) => sanitizeExternalUrl($(a).attr('href'), 'https://hnhiring.com'))
      .get()
      .filter((u): u is string => Boolean(u));
    const sourceUrl = pickBestHnJobUrl(extractedUrls, fallbackUrl);

    const explicitDeadline = parseEnglishDeadline(bodyText, referenceDate);
    const deadline = explicitDeadline.deadline || computeOpenAtsDeadline(publishedAt, 35, referenceDate);
    const salary = extractCompactForeignSalary(`${headerLine} ${bodyText.slice(0, 400)}`);

    const idKey = `${author.toLowerCase()}|${company.toLowerCase()}|${title.toLowerCase().slice(0, 48)}`;
    const idHash = Buffer.from(idKey).toString('base64url').slice(0, 18);
    const externalId = `hnhiring-${idHash}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const descSnippet = (paragraphs[0] || bodyText).slice(0, 320);

    results.push({
      id: externalId,
      externalId,
      company,
      title,
      direction: classifyDirection(title, `${techSlug} ${headerLine} ${descSnippet}`),
      grade: detectGrade(`${title} ${headerLine}`, 'junior'),
      market: 'global',
      city,
      workFormat,
      salaryText: salary.salaryText,
      salaryFrom: salary.salaryFrom,
      salaryTo: salary.salaryTo,
      deadline,
      deadlineIsExact: explicitDeadline.isExact,
      publishedAt,
      sourceUrl,
      sourceName: 'HN Hiring',
      sourceType: 'hnhiring',
      requirements: `HN Hiring (${techSlug}): ${descSnippet}`,
      applicationStatus: 'not_applied',
      notes: '',
      isStarred: false,
      parsedAt: referenceDate.toISOString(),
    });
  });

  return results;
}

/**
 * Parses open positions from https://amododesign.com/careers/.
 */
export function parseAmodoCareersHtml(
  html: string,
  referenceDate: Date = new Date()
): Internship[] {
  const $ = cheerio.load(html);
  const results: Internship[] = [];
  const seen = new Set<string>();
  const todayIso = referenceDate.toISOString().slice(0, 10);

  $('.job-box').each((index, el) => {
    const box = $(el);
    const title = box.find('h4').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    // Focus on Graduate, General Application, and non-senior roles
    if (/\b(senior|staff|principal|head of|director)\b/i.test(title)) {
      return;
    }

    const rawHref = box.find('a[href]').first().attr('href');
    const sourceUrl =
      sanitizeExternalUrl(rawHref, 'https://amododesign.com') ||
      'https://amododesign.com/careers/';

    let slug = `role-${index}`;
    try {
      const segments = new URL(sourceUrl).pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        slug = segments[segments.length - 1].toLowerCase().replace(/[^a-z0-9_-]/g, '');
      }
    } catch {
      // keep fallback slug
    }
    const externalId = `amodo-${slug || index}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const categoryText = box.find('.category-text').first().text().replace(/\s+/g, ' ').trim();
    const sectionHeading =
      box.closest('.row').prevAll('h2').first().text().replace(/\s+/g, ' ').trim() ||
      'Current openings';

    const salary = extractCompactForeignSalary(categoryText);
    const salaryText =
      salary.salaryFrom || salary.salaryTo ? salary.salaryText : 'По итогам (UK)';

    const grade: GradeLevel = /general application/i.test(title)
      ? 'intern_junior'
      : detectGrade(title, 'junior');

    const detailsNote = [
      sectionHeading ? `Раздел: ${sectionHeading}.` : '',
      categoryText ? `Условия: ${categoryText}.` : '',
      'Офисы: Sheffield и London (UK).',
    ]
      .filter(Boolean)
      .join(' ');

    results.push({
      id: externalId,
      externalId,
      company: 'Amodo Design',
      title,
      direction: classifyDirection(title, `${sectionHeading} ${categoryText}`),
      grade,
      market: 'global',
      city: 'Sheffield / London',
      workFormat: 'Офис',
      salaryText,
      salaryFrom: salary.salaryFrom,
      salaryTo: salary.salaryTo,
      deadline: null,
      deadlineIsExact: false,
      publishedAt: todayIso,
      sourceUrl,
      sourceName: 'Amodo Design',
      sourceType: 'amodo',
      requirements: detailsNote,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  });
  });

  return results;
}

export interface AmazonRawJob {
  id_icims?: string;
  id?: string;
  title?: string;
  normalized_location?: string;
  location?: string;
  city?: string;
  country_code?: string;
  job_path?: string;
  posted_date?: string;
  job_category?: string;
  business_category?: string;
  basic_qualifications?: string;
}

function parseEnglishPostedDate(rawDate: string | undefined, fallbackIso: string): string {
  if (!rawDate) return fallbackIso;
  const cleaned = rawDate.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s*(\d{4})$/i
  );
  if (!match) return fallbackIso;
  const month = ENGLISH_MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31 || year < 2020 || year > 2035) return fallbackIso;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeAmazonJob(
  raw: AmazonRawJob,
  referenceDate: Date = new Date()
): Internship {
  const todayIso = referenceDate.toISOString().slice(0, 10);
  const title = stripHtml(raw.title) || 'Software Development Engineer Intern';
  const idPart = String(raw.id_icims || raw.id || title.slice(0, 20));
  const locName = (raw.normalized_location || raw.location || raw.city || 'Global').trim();
  const publishedAt = parseEnglishPostedDate(raw.posted_date, todayIso);
  const deadline = computeOpenAtsDeadline(publishedAt, 45, referenceDate);
  const category = [raw.job_category, raw.business_category].filter(Boolean).join(' · ');
  const qual = stripHtml(raw.basic_qualifications).slice(0, 240);

  const sourceUrl =
    sanitizeExternalUrl(raw.job_path, 'https://www.amazon.jobs') ||
    'https://www.amazon.jobs/content/en/career-programs/university';

  const workFormat = detectWorkFormat(`${locName} ${title} ${qual}`);

  return {
    id: `amazon-${idPart}`,
    externalId: `amazon-${idPart}`,
    company: 'Amazon / AWS',
    title,
    direction: classifyDirection(title, `${category} ${qual}`),
    grade: detectGrade(title, 'intern'),
    market: 'global',
    city: locName.split(',')[0].trim().slice(0, 48) || 'Global',
    workFormat: workFormat === 'Не указано' ? 'Офис' : workFormat,
    salaryText: 'По итогам (Global)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl,
    sourceName: 'Amazon Jobs',
    sourceType: 'amazon',
    requirements: qual
      ? `${category ? `${category}. ` : ''}${qual}`
      : `Официальная вакансия Amazon / AWS. Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}

export interface NetflixRawJob {
  id: number | string;
  name?: string;
  location?: string;
  locations?: string[];
  department?: string;
  business_unit?: string;
  canonicalPositionUrl?: string;
  t_create?: number;
  t_update?: number;
  work_location_option?: string;
}

export function normalizeNetflixJob(
  raw: NetflixRawJob,
  referenceDate: Date = new Date()
): Internship {
  const todayIso = referenceDate.toISOString().slice(0, 10);
  const title = stripHtml(raw.name) || 'Software Engineer Intern';
  const locName = (raw.location || raw.locations?.[0] || 'Los Gatos, CA').trim();
  const dept = [raw.department, raw.business_unit].filter(Boolean).join(' · ');
  const ts = raw.t_update || raw.t_create;
  const publishedAt =
    typeof ts === 'number' && ts > 0
      ? new Date(ts * 1000).toISOString().slice(0, 10)
      : todayIso;
  const deadline = computeOpenAtsDeadline(publishedAt, 45, referenceDate);

  const sourceUrl =
    sanitizeExternalUrl(
      raw.canonicalPositionUrl || `/careers/job/${raw.id}`,
      'https://explore.jobs.netflix.net'
    ) || `https://explore.jobs.netflix.net/careers/job/${raw.id}`;

  const workFormat = detectWorkFormat(
    `${raw.work_location_option || ''} ${locName} ${title}`
  );

  return {
    id: `netflix-${raw.id}`,
    externalId: `netflix-${raw.id}`,
    company: 'Netflix',
    title,
    direction: classifyDirection(title, dept),
    grade: detectGrade(title, 'intern'),
    market: 'global',
    city: locName.split(',')[0].trim().slice(0, 48) || 'Los Gatos',
    workFormat: workFormat === 'Не указано' ? 'Гибрид' : workFormat,
    salaryText: 'По итогам (Global)',
    salaryFrom: null,
    salaryTo: null,
    deadline,
    deadlineIsExact: false,
    publishedAt,
    sourceUrl,
    sourceName: 'Netflix Careers',
    sourceType: 'netflix',
    requirements: dept
      ? `Отдел: ${dept}. Локация: ${locName}.`
      : `Официальная вакансия Netflix Careers. Локация: ${locName}.`,
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt: referenceDate.toISOString(),
  };
}
