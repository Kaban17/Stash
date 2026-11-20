import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_SOURCE_PRESETS,
  GLOBAL_ASHBY_BOARDS,
  GLOBAL_GREENHOUSE_BOARDS,
  GLOBAL_LEVER_BOARDS,
  RF_HH_EMPLOYERS,
} from './src/data/seedInternships.ts';
import { isCompanyExcluded } from './src/utils/internshipFilters.ts';
import {
  isEntryLevelTitle,
  normalizeArbeitnowJob,
  normalizeAshbyJob,
  normalizeGreenhouseJob,
  normalizeHabrVacancy,
  normalizeHhVacancy,
  normalizeLeverJob,
  parseHabrCareerHtml,
  parseHtmlInternshipPage,
} from './src/parser/extractors.ts';
import type {
  ArbeitnowRawJob,
  AshbyRawJob,
  GreenhouseRawJob,
  HabrRawVacancy,
  HhRawVacancy,
  LeverRawJob,
} from './src/parser/extractors.ts';
import type { Internship, SourceRunResult } from './src/types/internship.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HH_USER_AGENT = 'StazhTrek/1.0 (rf-internship-tracker@stazhtrek.app)';

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 7500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function runHhTopEmployersSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  const activeEmployers = RF_HH_EMPLOYERS.filter(
    (emp) => !isCompanyExcluded(emp.name, excludedCompanies)
  );
  const skippedEmployers = RF_HH_EMPLOYERS.length - activeEmployers.length;

  if (activeEmployers.length === 0) {
    return {
      items: [],
      result: {
        sourceId: 'hh_top_rf',
        sourceName: 'HeadHunter API — Топ-12 IT-компаний РФ',
        status: 'ok',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message: 'Все работодатели источника исключены из парсинга',
      },
    };
  }

  try {
    const params = new URLSearchParams();
    params.set('text', query || 'стажировка OR стажёр');
    params.set('area', '113'); // Russia
    params.set('per_page', '30');
    params.set('order_by', 'publication_time');
    for (const emp of activeEmployers) {
      params.append('employer_id', emp.id);
    }

    const res = await fetchWithTimeout(`https://api.hh.ru/vacancies?${params.toString()}`, {
      headers: { 'User-Agent': HH_USER_AGENT, 'HH-User-Agent': HH_USER_AGENT },
    });

    if (!res.ok) {
      return {
        items: [],
        result: {
          sourceId: 'hh_top_rf',
          sourceName: 'HeadHunter API — Топ-12 IT-компаний РФ',
          status: 'error',
          fetchedCount: 0,
          durationMs: Date.now() - started,
          message:
            res.status === 403
              ? 'api.hh.ru ограничил запрос с облачного IP (HTTP 403) — используйте Хабр Карьеру или импорт по URL/тексту'
              : `HTTP ${res.status} от api.hh.ru`,
        },
      };
    }

    const data = (await res.json()) as { items?: HhRawVacancy[] };
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems
      .map((v) => normalizeHhVacancy(v, now))
      .filter((item) => !isCompanyExcluded(item.company, excludedCompanies));

    return {
      items,
      result: {
        sourceId: 'hh_top_rf',
        sourceName: 'HeadHunter API — Топ-12 IT-компаний РФ',
        status: 'ok',
        fetchedCount: items.length,
        durationMs: Date.now() - started,
        message:
          skippedEmployers > 0
            ? `Загружено ${items.length} стажировок (пропущено исключённых компаний: ${skippedEmployers})`
            : `Загружено ${items.length} стажировок от крупных работодателей РФ`,
      },
    };
  } catch (err) {
    return {
      items: [],
      result: {
        sourceId: 'hh_top_rf',
        sourceName: 'HeadHunter API — Топ-12 IT-компаний РФ',
        status: 'error',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Таймаут запроса к api.hh.ru'
            : `Ошибка сети: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`,
      },
    };
  }
}

async function runHhGeneralItSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  try {
    const params = new URLSearchParams({
      text: query || 'стажер разработчик OR стажер аналитик OR стажер ML',
      area: '113',
      per_page: '20',
      order_by: 'publication_time',
    });

    const res = await fetchWithTimeout(`https://api.hh.ru/vacancies?${params.toString()}`, {
      headers: { 'User-Agent': HH_USER_AGENT, 'HH-User-Agent': HH_USER_AGENT },
    });

    if (!res.ok) {
      return {
        items: [],
        result: {
          sourceId: 'hh_general_it',
          sourceName: 'HeadHunter API — Все IT-стажировки (РФ)',
          status: 'error',
          fetchedCount: 0,
          durationMs: Date.now() - started,
          message:
            res.status === 403
              ? 'api.hh.ru ограничил запрос с облачного IP (HTTP 403)'
              : `HTTP ${res.status} от api.hh.ru`,
        },
      };
    }

    const data = (await res.json()) as { items?: HhRawVacancy[] };
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const normalized = rawItems.map((v) => normalizeHhVacancy(v, now));
    const items = normalized.filter(
      (item) => !isCompanyExcluded(item.company, excludedCompanies)
    );
    const filteredOut = normalized.length - items.length;

    return {
      items,
      result: {
        sourceId: 'hh_general_it',
        sourceName: 'HeadHunter API — Все IT-стажировки (РФ)',
        status: 'ok',
        fetchedCount: items.length,
        durationMs: Date.now() - started,
        message:
          filteredOut > 0
            ? `Найдено ${items.length} открытых IT-стажировок по РФ (пропущено исключённых: ${filteredOut})`
            : `Найдено ${items.length} открытых IT-стажировок по РФ`,
      },
    };
  } catch (err) {
    return {
      items: [],
      result: {
        sourceId: 'hh_general_it',
        sourceName: 'HeadHunter API — Все IT-стажировки (РФ)',
        status: 'error',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Таймаут запроса к api.hh.ru'
            : `Ошибка сети: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`,
      },
    };
  }
}

async function runHabrCareerSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  try {
    const params = new URLSearchParams({
      type: 'all',
      per_page: '25',
    });
    if (query) {
      params.set('q', query);
    } else {
      params.set('qid', '1'); // Official "Стажёр (Intern)" grade on Habr Career
    }

    const jsonRes = await fetchWithTimeout(
      `https://career.habr.com/api/frontend/vacancies?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );

    if (jsonRes.ok) {
      const payload = (await jsonRes.json()) as { list?: HabrRawVacancy[] };
      const list = Array.isArray(payload.list) ? payload.list : [];
      const normalized = list.map((v) => normalizeHabrVacancy(v, now));
      const items = normalized.filter(
        (item) => !isCompanyExcluded(item.company, excludedCompanies)
      );
      const filteredOut = normalized.length - items.length;
      return {
        items,
        result: {
          sourceId: 'habr_career',
          sourceName: 'Хабр Карьера API — Все стажировки (Intern, РФ)',
          status: items.length > 0 ? 'ok' : 'partial',
          fetchedCount: items.length,
          durationMs: Date.now() - started,
          message:
            items.length > 0
              ? filteredOut > 0
                ? `Загружено ${items.length} актуальных стажировок с career.habr.com (пропущено исключённых: ${filteredOut})`
                : `Загружено ${items.length} актуальных стажировок с career.habr.com`
              : 'По указанному запросу на Хабр Карьере стажировок не найдено',
        },
      };
    }

    // Fallback to HTML scraper if JSON endpoint fails
    const htmlUrl = `https://career.habr.com/vacancies?q=${encodeURIComponent(query || 'стажировка')}&type=all`;
    const htmlRes = await fetchWithTimeout(htmlUrl);
    if (!htmlRes.ok) {
      return {
        items: [],
        result: {
          sourceId: 'habr_career',
          sourceName: 'Хабр Карьера API — Все стажировки (Intern, РФ)',
          status: 'error',
          fetchedCount: 0,
          durationMs: Date.now() - started,
          message: `HTTP ${htmlRes.status} от career.habr.com`,
        },
      };
    }

    const html = await htmlRes.text();
    const items = parseHabrCareerHtml(html, now)
      .filter((item) => !isCompanyExcluded(item.company, excludedCompanies))
      .slice(0, 20);
    return {
      items,
      result: {
        sourceId: 'habr_career',
        sourceName: 'Хабр Карьера API — Все стажировки (Intern, РФ)',
        status: items.length > 0 ? 'ok' : 'partial',
        fetchedCount: items.length,
        durationMs: Date.now() - started,
        message: `Распарсено ${items.length} карточек (HTML) с career.habr.com`,
      },
    };
  } catch (err) {
    return {
      items: [],
      result: {
        sourceId: 'habr_career',
        sourceName: 'Хабр Карьера API — Все стажировки (Intern, РФ)',
        status: 'error',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Таймаут ответа от career.habr.com'
            : `Не удалось подключиться: ${err instanceof Error ? err.message : 'ошибка'}`,
      },
    };
  }
}

async function runHabrJuniorBackendMlSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  try {
    const queries = query
      ? [query]
      : ['backend', 'python', 'machine learning'];

    const settled = await Promise.allSettled(
      queries.map(async (q) => {
        const params = new URLSearchParams({
          qid: '3', // Official "Младший (Junior)" grade on Habr Career
          type: 'all',
          per_page: '15',
          q,
        });
        const res = await fetchWithTimeout(
          `https://career.habr.com/api/frontend/vacancies?${params.toString()}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { list?: HabrRawVacancy[] };
        return Array.isArray(payload.list) ? payload.list : [];
      })
    );

    const seen = new Set<string>();
    const items: Internship[] = [];
    let filteredOut = 0;
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        for (const raw of outcome.value) {
          const normalized = normalizeHabrVacancy(raw, now, 'junior');
          if (!seen.has(normalized.externalId)) {
            seen.add(normalized.externalId);
            if (isCompanyExcluded(normalized.company, excludedCompanies)) {
              filteredOut += 1;
              continue;
            }
            items.push(normalized);
          }
        }
      }
    }

    return {
      items,
      result: {
        sourceId: 'habr_junior_backend_ml',
        sourceName: 'Хабр Карьера API — Junior Backend & ML (РФ)',
        status: items.length > 0 ? 'ok' : 'partial',
        fetchedCount: items.length,
        durationMs: Date.now() - started,
        message:
          items.length > 0
            ? filteredOut > 0
              ? `Загружено ${items.length} Junior-вакансий (Backend / ML / Python) с career.habr.com (пропущено исключённых: ${filteredOut})`
              : `Загружено ${items.length} актуальных Junior-вакансий (Backend / ML / Python) с career.habr.com`
            : 'Открытых Junior-вакансий по запросу не найдено',
      },
    };
  } catch (err) {
    return {
      items: [],
      result: {
        sourceId: 'habr_junior_backend_ml',
        sourceName: 'Хабр Карьера API — Junior Backend & ML (РФ)',
        status: 'error',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Таймаут ответа от career.habr.com (Junior)'
            : `Не удалось подключиться: ${err instanceof Error ? err.message : 'ошибка'}`,
      },
    };
  }
}

async function runDirectPortalsSource(
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  const portals = [
    { url: 'https://yandex.ru/yaintern', fallbackCompany: 'Яндекс' },
    { url: 'https://internship.vk.company/', fallbackCompany: 'VK' },
    { url: 'https://education.tbank.ru/start/', fallbackCompany: 'Т-Банк' },
  ];

  const activePortals = portals.filter(
    (portal) => !isCompanyExcluded(portal.fallbackCompany, excludedCompanies)
  );
  if (activePortals.length === 0) {
    return {
      items: [],
      result: {
        sourceId: 'rf_portals',
        sourceName: 'Карьерные порталы (Яндекс, Т-Банк, VK)',
        status: 'ok',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message: 'Все порталы источника исключены из парсинга',
      },
    };
  }

  const settled = await Promise.allSettled(
    activePortals.map(async (portal) => {
      const res = await fetchWithTimeout(portal.url, {}, 5500);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseHtmlInternshipPage(html, portal.url, now);
      return {
        ...parsed,
        company: parsed.company === 'Компания РФ' ? portal.fallbackCompany : parsed.company,
        sourceType: 'company_portal' as const,
      };
    })
  );

  const items: Internship[] = [];
  let succeeded = 0;
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      succeeded += 1;
      if (!isCompanyExcluded(outcome.value.company, excludedCompanies)) {
        items.push(outcome.value);
      }
    }
  }

  return {
    items,
    result: {
      sourceId: 'rf_portals',
      sourceName: 'Карьерные порталы (Яндекс, Т-Банк, VK)',
      status: succeeded === activePortals.length ? 'ok' : succeeded > 0 ? 'partial' : 'error',
      fetchedCount: items.length,
      durationMs: Date.now() - started,
      message:
        succeeded > 0
          ? `Проверено порталов: ${succeeded} из ${activePortals.length}`
          : 'Карьерные порталы недоступны или закрыты защитой от ботов — используйте hh.ru или ручной импорт HTML',
    },
  };
}

function matchesOptionalQuery(text: string, query: string): boolean {
  if (!query) return true;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t !== 'or' && t !== 'and');
  if (tokens.length === 0) return true;
  const hay = text.toLowerCase();
  return tokens.some((tok) => hay.includes(tok));
}

async function fetchGreenhouseBoardJobs(
  slug: string,
  company: string,
  now: Date,
  query: string,
  limit: number
): Promise<Internship[]> {
  const res = await fetchWithTimeout(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
    { headers: { Accept: 'application/json' } },
    6500
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: GreenhouseRawJob[] };
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs
    .filter((j) => isEntryLevelTitle(j.title || ''))
    .filter((j) =>
      matchesOptionalQuery(
        `${company} ${j.title || ''} ${j.location?.name || ''}`,
        query
      )
    )
    .slice(0, limit)
    .map((j) => normalizeGreenhouseJob(j, company, slug, now));
}

async function fetchAshbyBoardJobs(
  slug: string,
  company: string,
  now: Date,
  query: string,
  limit: number
): Promise<Internship[]> {
  const res = await fetchWithTimeout(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
    { headers: { Accept: 'application/json' } },
    6500
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: AshbyRawJob[] };
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs
    .filter((j) => isEntryLevelTitle(j.title || ''))
    .filter((j) =>
      matchesOptionalQuery(
        `${company} ${j.title || ''} ${j.location || ''} ${j.department || ''}`,
        query
      )
    )
    .slice(0, limit)
    .map((j) => normalizeAshbyJob(j, company, slug, now));
}

async function fetchLeverBoardJobs(
  slug: string,
  company: string,
  now: Date,
  query: string,
  limit: number
): Promise<Internship[]> {
  const res = await fetchWithTimeout(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    { headers: { Accept: 'application/json' } },
    6500
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const jobs = (await res.json()) as LeverRawJob[];
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((j) => isEntryLevelTitle(j.text || ''))
    .filter((j) =>
      matchesOptionalQuery(
        `${company} ${j.text || ''} ${j.categories?.location || ''} ${j.categories?.team || ''}`,
        query
      )
    )
    .slice(0, limit)
    .map((j) => normalizeLeverJob(j, company, slug, now));
}

async function runGreenhouseGlobalSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  const activeBoards = GLOBAL_GREENHOUSE_BOARDS.filter(
    (b) => !isCompanyExcluded(b.company, excludedCompanies)
  );
  const skippedBoards = GLOBAL_GREENHOUSE_BOARDS.length - activeBoards.length;

  if (activeBoards.length === 0) {
    return {
      items: [],
      result: {
        sourceId: 'greenhouse_global',
        sourceName: 'Greenhouse ATS API — Global BigTech & AI (Зарубеж)',
        status: 'ok',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message: 'Все компании Greenhouse исключены из парсинга',
      },
    };
  }

  const settled = await Promise.allSettled(
    activeBoards.map((b) =>
      fetchGreenhouseBoardJobs(b.slug, b.company, now, query, 5)
    )
  );
  const items: Internship[] = [];
  let succeededBoards = 0;
  for (const out of settled) {
    if (out.status === 'fulfilled') {
      succeededBoards += 1;
      items.push(...out.value);
    }
  }
  const skippedSuffix =
    skippedBoards > 0 ? ` (пропущено исключённых компаний: ${skippedBoards})` : '';
  return {
    items,
    result: {
      sourceId: 'greenhouse_global',
      sourceName: 'Greenhouse ATS API — Global BigTech & AI (Зарубеж)',
      status:
        items.length > 0
          ? 'ok'
          : succeededBoards > 0
            ? 'partial'
            : 'error',
      fetchedCount: items.length,
      durationMs: Date.now() - started,
      message:
        items.length > 0
          ? `Загружено ${items.length} Intern/New Grad вакансий с ${succeededBoards} из ${activeBoards.length} досок Greenhouse${skippedSuffix}`
          : `Опрошено ${succeededBoards} досок Greenhouse, подходящих позиций по запросу не найдено${skippedSuffix}`,
    },
  };
}

async function runAshbyGlobalSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  const activeBoards = GLOBAL_ASHBY_BOARDS.filter(
    (b) => !isCompanyExcluded(b.company, excludedCompanies)
  );
  const skippedBoards = GLOBAL_ASHBY_BOARDS.length - activeBoards.length;

  if (activeBoards.length === 0) {
    return {
      items: [],
      result: {
        sourceId: 'ashby_global',
        sourceName: 'Ashby ATS API — Frontier AI & High-Growth (Зарубеж)',
        status: 'ok',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message: 'Все компании Ashby исключены из парсинга',
      },
    };
  }

  const settled = await Promise.allSettled(
    activeBoards.map((b) =>
      fetchAshbyBoardJobs(b.slug, b.company, now, query, 5)
    )
  );
  const items: Internship[] = [];
  let succeededBoards = 0;
  for (const out of settled) {
    if (out.status === 'fulfilled') {
      succeededBoards += 1;
      items.push(...out.value);
    }
  }
  const skippedSuffix =
    skippedBoards > 0 ? ` (пропущено исключённых компаний: ${skippedBoards})` : '';
  return {
    items,
    result: {
      sourceId: 'ashby_global',
      sourceName: 'Ashby ATS API — Frontier AI & High-Growth (Зарубеж)',
      status:
        items.length > 0
          ? 'ok'
          : succeededBoards > 0
            ? 'partial'
            : 'error',
      fetchedCount: items.length,
      durationMs: Date.now() - started,
      message:
        items.length > 0
          ? `Загружено ${items.length} Intern/New Grad вакансий с ${succeededBoards} из ${activeBoards.length} досок Ashby${skippedSuffix}`
          : `Опрошено ${succeededBoards} досок Ashby, подходящих позиций по запросу не найдено${skippedSuffix}`,
    },
  };
}

async function runLeverGlobalSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  const activeBoards = GLOBAL_LEVER_BOARDS.filter(
    (b) => !isCompanyExcluded(b.company, excludedCompanies)
  );
  const skippedBoards = GLOBAL_LEVER_BOARDS.length - activeBoards.length;

  if (activeBoards.length === 0) {
    return {
      items: [],
      result: {
        sourceId: 'lever_global',
        sourceName: 'Lever ATS API — Palantir & Zoox (Зарубеж)',
        status: 'ok',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message: 'Все компании Lever исключены из парсинга',
      },
    };
  }

  const settled = await Promise.allSettled(
    activeBoards.map((b) =>
      fetchLeverBoardJobs(b.slug, b.company, now, query, 6)
    )
  );
  const items: Internship[] = [];
  let succeededBoards = 0;
  for (const out of settled) {
    if (out.status === 'fulfilled') {
      succeededBoards += 1;
      items.push(...out.value);
    }
  }
  const skippedSuffix =
    skippedBoards > 0 ? ` (пропущено исключённых компаний: ${skippedBoards})` : '';
  return {
    items,
    result: {
      sourceId: 'lever_global',
      sourceName: 'Lever ATS API — Palantir & Zoox (Зарубеж)',
      status:
        items.length > 0
          ? 'ok'
          : succeededBoards > 0
            ? 'partial'
            : 'error',
      fetchedCount: items.length,
      durationMs: Date.now() - started,
      message:
        items.length > 0
          ? `Загружено ${items.length} Intern/New Grad вакансий с ${succeededBoards} из ${activeBoards.length} досок Lever${skippedSuffix}`
          : `Опрошено ${succeededBoards} досок Lever, подходящих позиций по запросу не найдено${skippedSuffix}`,
    },
  };
}

async function runArbeitnowEuSource(
  query: string,
  now: Date,
  excludedCompanies: string[]
): Promise<{ items: Internship[]; result: SourceRunResult }> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(
      'https://www.arbeitnow.com/api/job-board-api',
      { headers: { Accept: 'application/json' } },
      7000
    );
    if (!res.ok) {
      return {
        items: [],
        result: {
          sourceId: 'arbeitnow_eu',
          sourceName: 'Arbeitnow API — Стажировки и Junior в Европе (EU)',
          status: 'error',
          fetchedCount: 0,
          durationMs: Date.now() - started,
          message: `HTTP ${res.status} от arbeitnow.com`,
        },
      };
    }

    const payload = (await res.json()) as { data?: ArbeitnowRawJob[] };
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const matched = rawList
      .filter((j) => isEntryLevelTitle(j.title || ''))
      .filter((j) =>
        matchesOptionalQuery(
          `${j.company_name || ''} ${j.title || ''} ${(j.tags || []).join(' ')} ${j.location || ''}`,
          query
        )
      )
      .map((j) => normalizeArbeitnowJob(j, now));

    const kept = matched.filter(
      (item) => !isCompanyExcluded(item.company, excludedCompanies)
    );
    const filteredOut = matched.length - kept.length;
    const items = kept.slice(0, 15);

    return {
      items,
      result: {
        sourceId: 'arbeitnow_eu',
        sourceName: 'Arbeitnow API — Стажировки и Junior в Европе (EU)',
        status: items.length > 0 ? 'ok' : 'partial',
        fetchedCount: items.length,
        durationMs: Date.now() - started,
        message:
          items.length > 0
            ? filteredOut > 0
              ? `Загружено ${items.length} европейских Intern / Working Student / Junior вакансий (пропущено исключённых: ${filteredOut})`
              : `Загружено ${items.length} европейских Intern / Working Student / Junior вакансий`
            : 'Подходящих вакансий на Arbeitnow EU по запросу не найдено',
      },
    };
  } catch (err) {
    return {
      items: [],
      result: {
        sourceId: 'arbeitnow_eu',
        sourceName: 'Arbeitnow API — Стажировки и Junior в Европе (EU)',
        status: 'error',
        fetchedCount: 0,
        durationMs: Date.now() - started,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Таймаут запроса к arbeitnow.com'
            : `Ошибка сети: ${err instanceof Error ? err.message : 'ошибка'}`,
      },
    };
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/sources', (_req, res) => {
    res.json({
      presets: DEFAULT_SOURCE_PRESETS,
      employers: RF_HH_EMPLOYERS,
    });
  });

  app.post('/api/parse', async (req, res) => {
    const enabledSources: string[] = Array.isArray(req.body?.sources)
      ? req.body.sources
      : DEFAULT_SOURCE_PRESETS.filter((s) => s.enabled).map((s) => s.id);
    const query: string = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const excludedCompanies: string[] = Array.isArray(req.body?.excludedCompanies)
      ? req.body.excludedCompanies
          .filter((entry: unknown): entry is string => typeof entry === 'string')
          .map((entry: string) => entry.trim())
          .filter((entry: string) => entry.length > 0)
      : [];

    const now = new Date();
    const tasks: Array<Promise<{ items: Internship[]; result: SourceRunResult }>> = [];

    if (enabledSources.includes('hh_top_rf')) {
      tasks.push(runHhTopEmployersSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('hh_general_it')) {
      tasks.push(runHhGeneralItSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('habr_career')) {
      tasks.push(runHabrCareerSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('habr_junior_backend_ml')) {
      tasks.push(runHabrJuniorBackendMlSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('rf_portals')) {
      tasks.push(runDirectPortalsSource(now, excludedCompanies));
    }
    if (enabledSources.includes('greenhouse_global')) {
      tasks.push(runGreenhouseGlobalSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('ashby_global')) {
      tasks.push(runAshbyGlobalSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('lever_global')) {
      tasks.push(runLeverGlobalSource(query, now, excludedCompanies));
    }
    if (enabledSources.includes('arbeitnow_eu')) {
      tasks.push(runArbeitnowEuSource(query, now, excludedCompanies));
    }

    const outputs = await Promise.all(tasks);
    const allItems: Internship[] = [];
    const sources: SourceRunResult[] = [];
    const seenIds = new Set<string>();

    for (const out of outputs) {
      sources.push(out.result);
      for (const item of out.items) {
        if (isCompanyExcluded(item.company, excludedCompanies)) continue;
        if (!seenIds.has(item.externalId)) {
          seenIds.add(item.externalId);
          allItems.push(item);
        }
      }
    }

    res.json({
      items: allItems,
      sources,
      totalFetched: allItems.length,
      parsedAt: now.toISOString(),
    });
  });

  app.post('/api/parse-url', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl || !isSafePublicUrl(rawUrl)) {
      res.status(400).json({
        error: 'Укажите корректную публичную ссылку, начинающуюся с https://',
      });
      return;
    }

    const now = new Date();

    try {
      // Special fast path for hh.ru/vacancy/<id> links using official public JSON API
      const hhMatch = rawUrl.match(/hh\.ru\/vacancy\/(\d+)/i);
      if (hhMatch) {
        const apiRes = await fetchWithTimeout(`https://api.hh.ru/vacancies/${hhMatch[1]}`, {
          headers: { 'HH-User-Agent': USER_AGENT },
        });
        if (apiRes.ok) {
          const rawVacancy = (await apiRes.json()) as HhRawVacancy & { description?: string };
          const normalized = normalizeHhVacancy(
            {
              ...rawVacancy,
              snippet: {
                requirement: rawVacancy.description?.slice(0, 600) || rawVacancy.snippet?.requirement,
                responsibility: rawVacancy.snippet?.responsibility,
              },
            },
            now
          );
          res.json({ item: normalized });
          return;
        }
      }

      const pageRes = await fetchWithTimeout(rawUrl);
      if (!pageRes.ok) {
        res.status(502).json({
          error: `Сайт вернул статус HTTP ${pageRes.status}. Вы можете вставить текст/HTML страницы во вкладке ниже или добавить стажировку вручную.`,
        });
        return;
      }

      const html = await pageRes.text();
      const item = parseHtmlInternshipPage(html, rawUrl, now);
      res.json({ item });
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error && err.name === 'AbortError'
            ? 'Сайт не ответил за 7.5 секунд. Попробуйте другой URL или добавьте запись вручную.'
            : `Не удалось загрузить страницу: ${err instanceof Error ? err.message : 'ошибка сети'}`,
      });
    }
  });

  app.post('/api/parse-company', async (req, res) => {
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    const market = req.body?.market === 'global' ? 'global' : 'ru';
    const atsProvider =
      req.body?.atsProvider === 'greenhouse' ||
      req.body?.atsProvider === 'ashby' ||
      req.body?.atsProvider === 'lever'
        ? (req.body.atsProvider as 'greenhouse' | 'ashby' | 'lever')
        : undefined;
    const atsSlug = typeof req.body?.atsSlug === 'string' ? req.body.atsSlug.trim() : '';

    if (!companyName) {
      res.status(400).json({ error: 'Укажите название компании для поиска.' });
      return;
    }

    const now = new Date();
    try {
      // Direct official global ATS API lookup (Greenhouse, Ashby, Lever)
      if (atsProvider && atsSlug) {
        let items: Internship[] = [];
        if (atsProvider === 'greenhouse') {
          items = await fetchGreenhouseBoardJobs(atsSlug, companyName, now, '', 20);
        } else if (atsProvider === 'ashby') {
          items = await fetchAshbyBoardJobs(atsSlug, companyName, now, '', 20);
        } else if (atsProvider === 'lever') {
          items = await fetchLeverBoardJobs(atsSlug, companyName, now, '', 20);
        }
        res.json({
          items,
          count: items.length,
          totalFetched: items.length,
          companyName,
          sourceLabel:
            atsProvider === 'greenhouse'
              ? 'Greenhouse API'
              : atsProvider === 'ashby'
                ? 'Ashby API'
                : 'Lever API',
        });
        return;
      }

      // Global company without a public Greenhouse/Ashby/Lever board -> search Arbeitnow EU
      if (market === 'global') {
        const euRes = await fetchWithTimeout(
          'https://www.arbeitnow.com/api/job-board-api',
          { headers: { Accept: 'application/json' } },
          6500
        );
        let items: Internship[] = [];
        if (euRes.ok) {
          const payload = (await euRes.json()) as { data?: ArbeitnowRawJob[] };
          const rawList = Array.isArray(payload.data) ? payload.data : [];
          const lowerCompany = companyName.toLowerCase();
          items = rawList
            .filter(
              (j) =>
                (j.company_name || '').toLowerCase().includes(lowerCompany) &&
                isEntryLevelTitle(j.title || '')
            )
            .slice(0, 15)
            .map((j) => normalizeArbeitnowJob(j, now));
        }
        res.json({
          items,
          count: items.length,
          totalFetched: items.length,
          companyName,
          sourceLabel: 'Arbeitnow EU',
        });
        return;
      }

      const queries = [
        { qid: '1', grade: 'intern' as const },
        { qid: '3', grade: 'junior' as const },
      ];

      const settled = await Promise.allSettled(
        queries.map(async ({ qid, grade }) => {
          const params = new URLSearchParams({
            q: companyName,
            qid,
            type: 'all',
            per_page: '12',
          });
          const r = await fetchWithTimeout(
            `https://career.habr.com/api/frontend/vacancies?${params.toString()}`,
            { headers: { Accept: 'application/json' } }
          );
          if (!r.ok) return [];
          const payload = (await r.json()) as { list?: HabrRawVacancy[] };
          return (Array.isArray(payload.list) ? payload.list : []).map((v) =>
            normalizeHabrVacancy(v, now, grade)
          );
        })
      );

      const seen = new Set<string>();
      const items: Internship[] = [];
      for (const out of settled) {
        if (out.status === 'fulfilled') {
          for (const item of out.value) {
            if (!seen.has(item.externalId)) {
              seen.add(item.externalId);
              items.push(item);
            }
          }
        }
      }

      res.json({
        items,
        count: items.length,
        totalFetched: items.length,
        companyName,
        sourceLabel: 'Хабр Карьера',
      });
    } catch (err) {
      res.status(502).json({
        error: `Ошибка при поиске вакансий ${companyName}: ${
          err instanceof Error ? err.message : 'ошибка сети'
        }`,
      });
    }
  });

  app.post('/api/parse-html', (req, res) => {
    const html = typeof req.body?.html === 'string' ? req.body.html.trim() : '';
    const sourceUrl =
      typeof req.body?.url === 'string' && req.body.url.trim()
        ? req.body.url.trim()
        : 'https://career.ru/internship';

    if (!html || html.length < 15) {
      res.status(400).json({
        error: 'Вставьте HTML-код или текст объявления о стажировке (минимум 15 символов).',
      });
      return;
    }

    const wrapped = html.includes('<') ? html : `<html><body><p>${html}</p></body></html>`;
    const item = parseHtmlInternshipPage(wrapped, sourceUrl, new Date());
    res.json({ item });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`StazhTrek server listening on http://localhost:${PORT}`);
  });
}

startServer();
