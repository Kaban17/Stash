import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, getDeadlineMeta, parseRussianDeadline } from './deadline.ts';
import {
  classifyDirection,
  detectGrade,
  isEntryLevelTitle,
  normalizeAmazonJob,
  normalizeArbeitnowJob,
  normalizeAshbyJob,
  normalizeCompanyName,
  normalizeGreenhouseJob,
  normalizeHhVacancy,
  normalizeLeverJob,
  normalizeNetflixJob,
  parseAmodoCareersHtml,
  parseHabrCareerHtml,
  parseHnHiringHtml,
  parseHtmlInternshipPage,
} from '../parser/extractors.ts';
import {
  addExcludedCompanies,
  computeDashboardMetrics,
  deduplicateInternships,
  filterAndSortInternships,
  filterOutLegacySeeds,
  isCompanyExcluded,
  isExpiredBeyondThreshold,
  removeExcludedCompany,
  toggleExcludedCompany,
} from './internshipFilters.ts';
import {
  loadUserPreferences,
  PREFERENCES_STORAGE_KEY,
  saveUserPreferences,
} from './preferences.ts';
import { generateCsvContent, generateIcsContent } from './exportUtils.ts';
import type { Internship } from '../types/internship.ts';

const REF_DATE = new Date('2026-11-19T12:00:00Z');

function buildSeedInternships(referenceDate: Date = REF_DATE): Internship[] {
  const todayIso = referenceDate.toISOString().slice(0, 10);
  const offset = (days: number) => addDaysIso(todayIso, days);
  const parsedAt = referenceDate.toISOString();
  const base = (overrides: Partial<Internship> & Pick<Internship, 'id' | 'externalId' | 'company' | 'title'>): Internship => ({
    direction: 'Backend',
    grade: 'intern',
    market: 'ru',
    city: 'Москва',
    workFormat: 'Гибрид',
    salaryText: '80 000 ₽',
    salaryFrom: 80000,
    salaryTo: 80000,
    deadline: offset(5),
    deadlineIsExact: true,
    publishedAt: offset(-5),
    sourceUrl: 'https://career.habr.com/vacancies/1000170001',
    sourceName: 'Хабр Карьера',
    sourceType: 'habr_career',
    requirements: 'Python, SQL',
    applicationStatus: 'not_applied',
    notes: '',
    isStarred: false,
    parsedAt,
    ...overrides,
  });

  return [
    base({ id: 'live-1', externalId: 'habr-1', company: 'Яндекс', title: 'Стажёр Backend', deadline: offset(3), workFormat: 'Гибрид', city: 'Москва' }),
    base({ id: 'live-2', externalId: 'habr-2', company: 'Т-Банк', title: 'Стажёр ML', direction: 'ML / Data', deadline: offset(4), workFormat: 'Удалённо', city: 'Москва' }),
    base({ id: 'live-3', externalId: 'habr-3', company: 'Авито', title: 'Стажёр Frontend', direction: 'Frontend', deadline: offset(6), workFormat: 'Удалённо', city: 'Москва' }),
    base({ id: 'live-4', externalId: 'habr-4', company: 'VK', title: 'Стажёр Go', deadline: offset(2), workFormat: 'Офис', city: 'Санкт-Петербург' }),
    base({ id: 'live-5', externalId: 'habr-5', company: 'YADRO', title: 'Junior ML Engineer', direction: 'ML / Data', grade: 'junior', deadline: offset(9), workFormat: 'Офис', city: 'Нижний Новгород' }),
    base({ id: 'live-6', externalId: 'habr-6', company: 'Ozon Tech', title: 'Junior Go Developer', direction: 'Backend', grade: 'junior', deadline: offset(12), workFormat: 'Удалённо', city: 'Екатеринбург' }),
    base({ id: 'live-7', externalId: 'habr-7', company: 'Альфа-Банк', title: 'Стажёр iOS', direction: 'Mobile', deadline: null }),
    base({ id: 'live-8', externalId: 'habr-8', company: 'Сбер', title: 'Стажёр Java', deadline: offset(15) }),
    base({ id: 'live-9', externalId: 'habr-9', company: 'МТС', title: 'Стажёр DevOps', direction: 'DevOps / Sec', deadline: offset(16) }),
    base({ id: 'live-10', externalId: 'habr-10', company: 'СКБ Контур', title: 'Стажёр C#', deadline: offset(17) }),
    base({ id: 'live-11', externalId: 'gh-1', company: 'Stripe', title: 'ML Intern', direction: 'ML / Data', market: 'global', city: 'Dublin', sourceType: 'greenhouse', sourceUrl: 'https://stripe.com/jobs/search?gh_jid=8333122', deadline: offset(8) }),
    base({ id: 'live-12', externalId: 'gh-2', company: 'Databricks', title: 'Data Science Intern', direction: 'ML / Data', market: 'global', city: 'Amsterdam', sourceType: 'greenhouse', deadline: offset(10) }),
    base({ id: 'live-13', externalId: 'lever-1', company: 'Palantir', title: 'New Grad Backend', direction: 'Backend', grade: 'junior', market: 'global', city: 'London', workFormat: 'Офис', sourceType: 'lever', deadline: offset(11) }),
    base({ id: 'live-14', externalId: 'ashby-1', company: 'OpenAI', title: 'Research Intern', direction: 'ML / Data', market: 'global', city: 'San Francisco', sourceType: 'ashby', deadline: offset(14) }),
  ];
}

test('parseRussianDeadline extracts Russian word dates, numeric dates, and ISO dates', () => {
  assert.deepEqual(
    parseRussianDeadline('Приём заявок открыт до 25 ноября 2026 года', REF_DATE),
    { deadline: '2026-11-25', isExact: true }
  );

  assert.deepEqual(
    parseRussianDeadline('Дедлайн: 05.12.2026 — успей подать резюме', REF_DATE),
    { deadline: '2026-12-05', isExact: true }
  );

  // Month earlier in year rolls over to next year when >60 days in past
  assert.deepEqual(
    parseRussianDeadline('Заявки принимаются по 15 января', REF_DATE),
    { deadline: '2027-01-15', isExact: true }
  );

  assert.deepEqual(
    parseRussianDeadline('validThrough: 2026-12-20', REF_DATE),
    { deadline: '2026-12-20', isExact: true }
  );

  assert.deepEqual(
    parseRussianDeadline('Открытый круглогодичный набор без ограничений', REF_DATE),
    { deadline: null, isExact: false }
  );
});

test('getDeadlineMeta computes accurate daysLeft and urgency labels', () => {
  const overdue = getDeadlineMeta('2026-11-16', REF_DATE);
  assert.equal(overdue.urgency, 'overdue');
  assert.equal(overdue.daysLeft, -3);
  assert.match(overdue.label, /Просрочен 3 дн/);

  const today = getDeadlineMeta('2026-11-19', REF_DATE);
  assert.equal(today.urgency, 'urgent');
  assert.equal(today.daysLeft, 0);

  const urgent = getDeadlineMeta('2026-11-23', REF_DATE);
  assert.equal(urgent.urgency, 'urgent');
  assert.equal(urgent.daysLeft, 4);

  const soon = getDeadlineMeta('2026-11-30', REF_DATE);
  assert.equal(soon.urgency, 'soon');
  assert.equal(soon.daysLeft, 11);

  const rolling = getDeadlineMeta(null, REF_DATE);
  assert.equal(rolling.urgency, 'rolling');
  assert.equal(rolling.daysLeft, null);
});

test('normalizeHhVacancy extracts company, direction, format, salary, and deadline', () => {
  const item = normalizeHhVacancy(
    {
      id: '98765432',
      name: 'Стажёр Python Backend-разработчик',
      employer: { id: '1740', name: 'ООО Яндекс.Технологии' },
      area: { name: 'Москва' },
      salary: { from: 85000, to: 110000, currency: 'RUR' },
      schedule: { id: 'remote', name: 'Удаленная работа' },
      snippet: {
        requirement: 'Знание Python, SQL. Приём заявок до 10 декабря 2026.',
        responsibility: 'Разработка микросервисов.',
      },
      published_at: '2026-11-15T10:00:00+0300',
      alternate_url: 'https://hh.ru/vacancy/98765432',
    },
    REF_DATE
  );

  assert.equal(item.company, 'Яндекс');
  assert.equal(item.direction, 'Backend');
  assert.equal(item.workFormat, 'Удалённо');
  assert.equal(item.deadline, '2026-12-10');
  assert.equal(item.deadlineIsExact, true);
  assert.equal(item.salaryFrom, 85000);
  assert.equal(item.salaryTo, 110000);
});

test('parseHtmlInternshipPage extracts JSON-LD JobPosting and fallback Russian deadlines', () => {
  const html = `
    <html>
      <head>
        <title>Стажировка в Т-Банк</title>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "title": "Стажёр Frontend React",
            "hiringOrganization": { "name": "Т-Банк" },
            "validThrough": "2026-12-01",
            "jobLocation": { "address": { "addressLocality": "Москва" } },
            "baseSalary": { "value": { "minValue": 90000, "maxValue": 115000 } }
          }
        </script>
      </head>
      <body><h1>Стажёр Frontend React</h1><p>Гибрид в офисе в Москве</p></body>
    </html>
  `;

  const parsed = parseHtmlInternshipPage(html, 'https://education.tbank.ru/frontend', REF_DATE);
  assert.equal(parsed.company, 'Т-Банк');
  assert.equal(parsed.direction, 'Frontend');
  assert.equal(parsed.deadline, '2026-12-01');
  assert.equal(parsed.deadlineIsExact, true);
  assert.equal(parsed.salaryFrom, 90000);
  assert.equal(parsed.workFormat, 'Гибрид');
});

test('parseHabrCareerHtml parses vacancy cards cleanly', () => {
  const html = `
    <div class="vacancy-card">
      <a class="vacancy-card__title-link" href="/vacancies/1000145">Стажёр ML-инженер</a>
      <div class="vacancy-card__company-title">Авито</div>
      <div class="vacancy-card__meta">Москва • Можно удалённо</div>
      <div class="vacancy-card__skills">Python, PyTorch, дедлайн 28.11.2026</div>
      <div class="vacancy-card__salary"><div class="basic-salary">от 95 000 ₽</div></div>
      <time datetime="2026-11-18T09:00:00+03:00"></time>
    </div>
  `;

  const items = parseHabrCareerHtml(html, REF_DATE);
  assert.equal(items.length, 1);
  assert.equal(items[0].company, 'Авито');
  assert.equal(items[0].direction, 'ML / Data');
  assert.equal(items[0].deadline, '2026-11-28');
  assert.equal(items[0].workFormat, 'Удалённо');
});

test('deduplicateInternships preserves user status, notes, and starred flag', () => {
  const existing = buildSeedInternships(REF_DATE).slice(0, 2);
  existing[0].applicationStatus = 'interview';
  existing[0].notes = 'Повторить системный дизайн';
  existing[0].isStarred = true;

  const incoming = [
    {
      ...existing[0],
      applicationStatus: 'not_applied' as const,
      notes: '',
      isStarred: false,
      salaryText: 'от 95 000 ₽',
    },
    {
      ...existing[1],
      id: 'new-ozon',
      externalId: 'hh-777777',
      company: 'Ozon',
      title: 'Стажёр Go-разработчик',
    },
  ];

  const { merged, addedCount, updatedCount } = deduplicateInternships(existing, incoming);
  assert.equal(addedCount, 1);
  assert.equal(updatedCount, 1);
  assert.equal(merged.length, 3);
  const yandex = merged.find((i) => i.externalId === existing[0].externalId)!;
  assert.equal(yandex.applicationStatus, 'interview');
  assert.equal(yandex.notes, 'Повторить системный дизайн');
  assert.equal(yandex.isStarred, true);
  assert.equal(yandex.salaryText, 'от 95 000 ₽');
});

test('filterAndSortInternships puts rolling/null deadlines last and filters accurately', () => {
  const items = buildSeedInternships(REF_DATE);
  const baseFilters = {
    search: '',
    company: 'all',
    market: 'all' as const,
    direction: 'all' as const,
    city: 'all',
    workFormat: 'all' as const,
    grade: 'all' as const,
    backendMlOnly: false,
    quickFilter: 'all' as const,
    hideExpired: false,
  };

  const sorted = filterAndSortInternships(
    items,
    baseFilters,
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );

  // Rolling internship (Альфа-Банк) must appear at the very end
  assert.equal(sorted[sorted.length - 1].deadline, null);

  const yandexOnly = filterAndSortInternships(
    items,
    { ...baseFilters, search: 'Яндекс' },
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );
  assert.equal(yandexOnly.length, 1);
  assert.equal(yandexOnly[0].company, 'Яндекс');

  const metrics = computeDashboardMetrics(items, REF_DATE);
  assert.equal(metrics.total, items.length);
  assert.ok(metrics.urgentCount >= 4);
  assert.ok(metrics.nearestDeadline !== null);
});

test('filterAndSortInternships sorts by workFormat, city, and direction and filters Backend+ML & Junior', () => {
  const items = buildSeedInternships(REF_DATE);
  const baseFilters = {
    search: '',
    company: 'all',
    market: 'all' as const,
    direction: 'all' as const,
    city: 'all',
    workFormat: 'all' as const,
    grade: 'all' as const,
    backendMlOnly: false,
    quickFilter: 'all' as const,
    hideExpired: false,
  };

  const byFormat = filterAndSortInternships(
    items,
    baseFilters,
    { field: 'workFormat', order: 'asc' },
    REF_DATE
  );
  const formatRank = { 'Удалённо': 0, 'Гибрид': 1, 'Офис': 2, 'Не указано': 3 };
  for (let i = 1; i < byFormat.length; i++) {
    assert.ok(
      formatRank[byFormat[i - 1].workFormat] <= formatRank[byFormat[i].workFormat],
      'workFormat should sort Удалённо -> Гибрид -> Офис'
    );
  }

  const byCity = filterAndSortInternships(
    items,
    baseFilters,
    { field: 'city', order: 'asc' },
    REF_DATE
  );
  for (let i = 1; i < byCity.length; i++) {
    assert.ok(
      byCity[i - 1].city.localeCompare(byCity[i].city, 'ru') <= 0,
      'city should sort alphabetically in Russian'
    );
  }

  const byDirection = filterAndSortInternships(
    items,
    baseFilters,
    { field: 'direction', order: 'asc' },
    REF_DATE
  );
  for (let i = 1; i < byDirection.length; i++) {
    assert.ok(
      byDirection[i - 1].direction.localeCompare(byDirection[i].direction, 'ru') <= 0,
      'direction should sort alphabetically in Russian'
    );
  }

  const backendMl = filterAndSortInternships(
    items,
    { ...baseFilters, backendMlOnly: true },
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );
  assert.ok(backendMl.length > 0);
  assert.ok(backendMl.every((i) => i.direction === 'Backend' || i.direction === 'ML / Data'));

  const juniorsOnly = filterAndSortInternships(
    items,
    { ...baseFilters, grade: 'junior' },
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );
  assert.ok(juniorsOnly.length >= 2);
  assert.ok(juniorsOnly.every((i) => i.grade === 'junior' || i.grade === 'intern_junior'));
});

test('detectGrade distinguishes Intern, Junior, and Intern/Junior titles', () => {
  assert.equal(detectGrade('Стажёр Backend-разработчик (Go)'), 'intern');
  assert.equal(detectGrade('Junior Python Backend Developer'), 'junior');
  assert.equal(detectGrade('Стажёр / Junior ML Engineer'), 'intern_junior');
});

test('CSV and ICS exports contain valid Russian headers and calendar events', () => {
  const items = buildSeedInternships(REF_DATE).slice(0, 3);
  const csv = generateCsvContent(items);
  assert.ok(csv.startsWith('\uFEFFКомпания;Название стажировки'));
  assert.match(csv, /Яндекс/);

  const ics = generateIcsContent(items);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /TRIGGER:-P2D/);
  assert.match(ics, /END:VCALENDAR/);
});

test('company and direction helpers normalize RF brand names', () => {
  assert.equal(normalizeCompanyName('АО Тинькофф Банк'), 'Т-Банк');
  assert.equal(normalizeCompanyName('ООО ВК Технологии'), 'VK');
  assert.equal(classifyDirection('Стажёр QA-инженер автотесты'), 'QA');
  assert.equal(classifyDirection('Intern SRE Kubernetes'), 'DevOps / Sec');
});

test('parseHtmlInternshipPage detects known RF company from pasted announcement text', () => {
  const html =
    '<html><body><p>Стажировка в Циан: Стажёр Data Analyst (SQL / Python). Москва, удалённо, оплата от 75 000 ₽. Приём заявок до 27 ноября 2026.</p></body></html>';
  const parsed = parseHtmlInternshipPage(html, 'https://career.ru/internship', REF_DATE);
  assert.equal(parsed.company, 'Циан');
  assert.equal(parsed.deadline, '2026-11-27');
  assert.equal(parsed.direction, 'Аналитика');
  assert.equal(parsed.workFormat, 'Удалённо');
  assert.equal(parsed.salaryFrom, 75000);
});

test('isEntryLevelTitle and international ATS normalizers handle Greenhouse, Ashby, Lever, and Arbeitnow jobs', () => {
  assert.equal(isEntryLevelTitle('Software Engineering Intern - Summer 2026'), true);
  assert.equal(isEntryLevelTitle('Machine Learning Engineer, New Grad'), true);
  assert.equal(isEntryLevelTitle('Werkstudent Backend Developer (Python)'), true);
  assert.equal(isEntryLevelTitle('Staff Distributed Systems Engineer'), false);
  assert.equal(isEntryLevelTitle('Senior ML Engineer'), false);

  const gh = normalizeGreenhouseJob(
    {
      id: 4242,
      title: 'Software Engineering Intern (Backend)',
      location: { name: 'Dublin, Ireland' },
      departments: [{ name: 'Core Infrastructure' }],
      first_published: '2026-11-10T09:00:00Z',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/4242',
    },
    'Stripe',
    'stripe',
    REF_DATE
  );
  assert.equal(gh.market, 'global');
  assert.equal(gh.company, 'Stripe');
  assert.equal(gh.direction, 'Backend');
  assert.equal(gh.grade, 'intern');
  assert.equal(gh.sourceType, 'greenhouse');

  const evergreen = normalizeGreenhouseJob(
    {
      id: 9999,
      title: 'Data Science Intern (2027 Start)',
      location: { name: 'Mountain View, CA' },
      first_published: '2023-08-17T09:00:00Z',
    },
    'Databricks',
    'databricks',
    REF_DATE
  );
  assert.equal(evergreen.deadline, null);

  const ashby = normalizeAshbyJob(
    {
      id: 'abc-123',
      title: 'Research Engineer, New Grad (LLM Post-Training)',
      department: 'Research',
      location: 'San Francisco, CA',
      isRemote: false,
      publishedAt: '2026-11-12T12:00:00Z',
      jobUrl: 'https://jobs.ashbyhq.com/openai/abc-123',
    },
    'OpenAI',
    'openai',
    REF_DATE
  );
  assert.equal(ashby.market, 'global');
  assert.equal(ashby.direction, 'ML / Data');
  assert.equal(ashby.grade, 'junior');
  assert.equal(ashby.sourceType, 'ashby');

  const lever = normalizeLeverJob(
    {
      id: 'lev-9',
      text: 'Software Engineer, New Grad - Backend',
      createdAt: Date.parse('2026-11-14T00:00:00Z'),
      workplaceType: 'onsite',
      categories: { location: 'London, UK', team: 'Foundry' },
      hostedUrl: 'https://jobs.lever.co/palantir/lev-9',
    },
    'Palantir',
    'palantir',
    REF_DATE
  );
  assert.equal(lever.market, 'global');
  assert.equal(lever.direction, 'Backend');
  assert.equal(lever.workFormat, 'Офис');
  assert.equal(lever.sourceType, 'lever');

  const eu = normalizeArbeitnowJob(
    {
      slug: 'berlin-junior-ml',
      company_name: 'DeepL',
      title: 'Working Student Machine Learning (Python / PyTorch)',
      remote: true,
      location: 'Berlin, Germany',
      tags: ['Python', 'Machine Learning'],
      created_at: Math.floor(Date.parse('2026-11-15T00:00:00Z') / 1000),
      url: 'https://www.arbeitnow.com/view/berlin-junior-ml',
    },
    REF_DATE
  );
  assert.equal(eu.market, 'global');
  assert.equal(eu.direction, 'ML / Data');
  assert.equal(eu.workFormat, 'Удалённо');
  assert.equal(eu.sourceType, 'arbeitnow');

  const allSeeds = buildSeedInternships(REF_DATE);
  const baseFilters = {
    search: '',
    company: 'all',
    market: 'global' as const,
    direction: 'all' as const,
    city: 'all',
    workFormat: 'all' as const,
    grade: 'all' as const,
    backendMlOnly: false,
    quickFilter: 'all' as const,
    hideExpired: false,
  };
  const globalOnly = filterAndSortInternships(
    allSeeds,
    baseFilters,
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );
  assert.ok(globalOnly.length >= 4);
  assert.ok(globalOnly.every((i) => i.market === 'global'));

  const ruOnly = filterAndSortInternships(
    allSeeds,
    { ...baseFilters, market: 'ru' },
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );
  assert.ok(ruOnly.length >= 10);
  assert.ok(ruOnly.every((i) => (i.market || 'ru') === 'ru'));
});

test('isExpiredBeyondThreshold and hideExpired filter only hide deadlines expired > 7 days ago', () => {
  // REF_DATE is 2026-11-19
  assert.equal(isExpiredBeyondThreshold('2026-11-11', REF_DATE), true); // 8 days ago
  assert.equal(isExpiredBeyondThreshold('2026-11-01', REF_DATE), true); // 18 days ago
  assert.equal(isExpiredBeyondThreshold('2026-11-12', REF_DATE), false); // exactly 7 days ago
  assert.equal(isExpiredBeyondThreshold('2026-11-17', REF_DATE), false); // 2 days ago
  assert.equal(isExpiredBeyondThreshold('2026-11-19', REF_DATE), false); // today
  assert.equal(isExpiredBeyondThreshold('2026-11-25', REF_DATE), false); // future
  assert.equal(isExpiredBeyondThreshold(null, REF_DATE), false); // rolling

  const seeds = buildSeedInternships(REF_DATE);
  const oldExpired = {
    ...seeds[0],
    id: 'expired-10d',
    externalId: 'expired-10d',
    company: 'Старая Волна',
    deadline: '2026-11-09', // 10 days ago
  };
  const recentExpired = {
    ...seeds[0],
    id: 'expired-3d',
    externalId: 'expired-3d',
    company: 'Недавний Дедлайн',
    deadline: '2026-11-16', // 3 days ago
  };

  const baseFilters = {
    search: '',
    company: 'all',
    market: 'all' as const,
    direction: 'all' as const,
    city: 'all',
    workFormat: 'all' as const,
    grade: 'all' as const,
    backendMlOnly: false,
    quickFilter: 'all' as const,
    hideExpired: true,
  };

  const filtered = filterAndSortInternships(
    [oldExpired, recentExpired, seeds[0]],
    baseFilters,
    { field: 'deadline', order: 'asc' },
    REF_DATE
  );

  assert.equal(filtered.some((i) => i.id === 'expired-10d'), false);
  assert.equal(filtered.some((i) => i.id === 'expired-3d'), true);
  assert.equal(filtered.some((i) => i.id === seeds[0].id), true);
});

test('loadUserPreferences and saveUserPreferences persist hideExpired, excludedCompanies, pinNewFirst, recentNewIds, and theme safely', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.deepEqual(loadUserPreferences(mockStorage), {
    hideExpired: false,
    excludedCompanies: [],
    pinNewFirst: true,
    recentNewIds: [],
    theme: 'auto',
  });

  saveUserPreferences(
    {
      hideExpired: true,
      excludedCompanies: ['Palantir', 'МТС', 'palantir'],
      pinNewFirst: false,
      recentNewIds: ['new-1', 'new-2', 'new-1'],
      theme: 'dark',
    },
    mockStorage
  );
  assert.deepEqual(loadUserPreferences(mockStorage), {
    hideExpired: true,
    excludedCompanies: ['Palantir', 'МТС'],
    pinNewFirst: false,
    recentNewIds: ['new-1', 'new-2'],
    theme: 'dark',
  });

  // Backwards compatibility with legacy JSON containing only hideExpired
  store.set(PREFERENCES_STORAGE_KEY, JSON.stringify({ hideExpired: true }));
  assert.deepEqual(loadUserPreferences(mockStorage), {
    hideExpired: true,
    excludedCompanies: [],
    pinNewFirst: true,
    recentNewIds: [],
    theme: 'auto',
  });

  // Invalid theme values fall back to 'auto'
  store.set(PREFERENCES_STORAGE_KEY, JSON.stringify({ hideExpired: false, theme: 'sepia' }));
  assert.equal(loadUserPreferences(mockStorage).theme, 'auto');

  saveUserPreferences(
    { hideExpired: false, excludedCompanies: [], pinNewFirst: true, recentNewIds: [], theme: 'light' },
    mockStorage
  );
  assert.deepEqual(loadUserPreferences(mockStorage), {
    hideExpired: false,
    excludedCompanies: [],
    pinNewFirst: true,
    recentNewIds: [],
    theme: 'light',
  });

  // Corrupt JSON falls back safely
  store.set(PREFERENCES_STORAGE_KEY, '{bad-json');
  assert.deepEqual(loadUserPreferences(mockStorage), {
    hideExpired: false,
    excludedCompanies: [],
    pinNewFirst: true,
    recentNewIds: [],
    theme: 'auto',
  });
});

test('newly added vacancies are pinned to top when pinNewFirst is enabled and sortable by addedAt', () => {
  const existing = buildSeedInternships(REF_DATE).slice(0, 3).map((item) => ({
    ...item,
    addedAt: '2026-11-18T10:00:00.000Z',
  }));
  const incomingNewFarDeadline: Internship = {
    ...existing[0],
    id: 'live-new-1',
    externalId: 'habr-new-1',
    company: 'НоваяКомпания',
    title: 'Стажёр Go Backend',
    deadline: '2027-06-01', // Much later than existing urgent deadlines
    addedAt: '2026-11-22T09:00:00.000Z',
  };
  const incomingUpdatedExisting: Internship = {
    ...existing[0],
    salaryText: '120 000 ₽',
    addedAt: '2026-11-22T09:00:00.000Z',
  };

  const { merged, addedCount, updatedCount, addedIds } = deduplicateInternships(
    existing,
    [incomingUpdatedExisting, incomingNewFarDeadline],
    '2026-11-22T09:00:00.000Z'
  );
  assert.equal(addedCount, 1);
  assert.equal(updatedCount, 1);
  assert.deepEqual(addedIds, ['live-new-1']);

  // Existing item must preserve its original addedAt timestamp
  const preservedExisting = merged.find((i) => i.id === existing[0].id)!;
  assert.equal(preservedExisting.addedAt, '2026-11-18T10:00:00.000Z');

  const newIds = new Set(addedIds);
  const baseFilters = {
    search: '',
    company: 'all',
    market: 'all' as const,
    direction: 'all' as const,
    city: 'all',
    workFormat: 'all' as const,
    grade: 'all' as const,
    backendMlOnly: false,
    quickFilter: 'all' as const,
    hideExpired: false,
    pinNewFirst: true,
  };

  // With pinNewFirst=true, newly added item appears at index 0 even when sorting by deadline asc
  const pinnedResult = filterAndSortInternships(
    merged,
    baseFilters,
    { field: 'deadline', order: 'asc' },
    REF_DATE,
    newIds
  );
  assert.equal(pinnedResult[0].id, 'live-new-1');

  // With pinNewFirst=false, far-future deadline moves to the bottom under deadline asc
  const unpinnedResult = filterAndSortInternships(
    merged,
    { ...baseFilters, pinNewFirst: false },
    { field: 'deadline', order: 'asc' },
    REF_DATE,
    newIds
  );
  assert.equal(unpinnedResult[unpinnedResult.length - 1].id, 'live-new-1');

  // Sorting explicitly by addedAt desc puts the newly added item first even without pinning
  const byAddedAtDesc = filterAndSortInternships(
    merged,
    { ...baseFilters, pinNewFirst: false },
    { field: 'addedAt', order: 'desc' },
    REF_DATE
  );
  assert.equal(byAddedAtDesc[0].id, 'live-new-1');

  // quickFilter='new' returns only newly added vacancies
  const onlyNew = filterAndSortInternships(
    merged,
    { ...baseFilters, quickFilter: 'new' },
    { field: 'deadline', order: 'asc' },
    REF_DATE,
    newIds
  );
  assert.deepEqual(onlyNew.map((i) => i.id), ['live-new-1']);
});

test('company exclusion helpers match variants safely and mutate exclusion lists without duplicates', () => {
  assert.equal(isCompanyExcluded('Palantir', ['palantir']), true);
  assert.equal(isCompanyExcluded('Palantir Technologies', ['Palantir']), true);
  assert.equal(isCompanyExcluded('Ozon Tech', ['Ozon']), true);
  assert.equal(isCompanyExcluded('ООО «МТС Диджитал»', ['МТС']), true);
  assert.equal(isCompanyExcluded('Яндекс.Технологии', ['Яндекс']), true);
  assert.equal(isCompanyExcluded('Avk Solutions', ['VK']), false);
  assert.equal(isCompanyExcluded('Stripe', ['Palantir', 'МТС']), false);

  const added = addExcludedCompanies([], 'Palantir, МТС; palantir\nHireway');
  assert.deepEqual(added, ['Palantir', 'МТС', 'Hireway']);

  const toggledOff = toggleExcludedCompany(added, 'мтс');
  assert.deepEqual(toggledOff, ['Palantir', 'Hireway']);

  const toggledOn = toggleExcludedCompany(toggledOff, 'Zoox');
  assert.deepEqual(toggledOn, ['Palantir', 'Hireway', 'Zoox']);

  const removed = removeExcludedCompany(toggledOn, 'HIREWAY');
  assert.deepEqual(removed, ['Palantir', 'Zoox']);
});

test('filterOutLegacySeeds removes hardcoded seed-* records while keeping live and manual records', () => {
  const sample = buildSeedInternships(REF_DATE);
  const mixed: Internship[] = [
    { ...sample[0], id: 'seed-yandex-backend' },
    { ...sample[1], id: 'seed-global-palantir-newgrad' },
    { ...sample[2], id: 'habr-1000170506', applicationStatus: 'interview', notes: 'Live item' },
    { ...sample[3], id: 'manual-123456', notes: 'Added manually' },
  ];

  const cleaned = filterOutLegacySeeds(mixed);
  assert.equal(cleaned.length, 2);
  assert.deepEqual(
    cleaned.map((i) => i.id),
    ['habr-1000170506', 'manual-123456']
  );
  assert.equal(cleaned[0].notes, 'Live item');
});

test('parseHnHiringHtml extracts entry-level HN Hiring jobs, skips job seekers, and rejects unsafe URLs', () => {
  const sampleHtml = `
    <ul>
      <li class="job">
        <div class="container">
          <div class="user green">
            <a href="https://news.ycombinator.com/user?id=mikegene">mikegene</a>
            <span class="gray right type-info">2026-11-13</span>
          </div>
          <div class="body">
            Genentech | 2027 Interns | PD Data Sciences &amp; Analytics | ONSITE (South San Francisco, CA USA)
            <p>Hiring graduate students for summer 2027 AI and machine learning internships. Apply by November 28, 2026.</p>
            <p><a href="javascript:alert(1)">bad</a> <a href="https://go.gene.com/PDD-SSF-DigitalAI-Intern">Apply</a></p>
          </div>
        </div>
      </li>
      <li class="job odd">
        <div class="container">
          <div class="user green">
            <a href="https://news.ycombinator.com/user?id=seeker1">seeker1</a>
            <span class="gray right type-info">2026-11-13</span>
          </div>
          <div class="body">
            Location: Bangalore, India
            <p>Remote: Yes</p>
            <p>Willing to relocate: Yes. Looking for Junior Python role.</p>
          </div>
        </div>
      </li>
      <li class="job">
        <div class="container">
          <div class="user green">
            <a href="https://news.ycombinator.com/user?id=staffco">staffco</a>
            <span class="gray right type-info">2026-11-12</span>
          </div>
          <div class="body">
            BigCorp | Principal Staff Architect | REMOTE | $250k-$300k
            <p>We need 12+ years of distributed systems leadership.</p>
            <p><a href="https://bigcorp.example/jobs/principal">Apply</a></p>
          </div>
        </div>
      </li>
      <li class="job odd">
        <div class="container">
          <div class="user green">
            <a href="https://news.ycombinator.com/user?id=unitedrisk">unitedrisk</a>
            <span class="gray right type-info">2026-11-10</span>
          </div>
          <div class="body">
            United Risk | Early-Career AI Engineers | New York, NY | HYBRID | $120k-$150k
            <p>Hiring early-career AI &amp; backend engineers (Python, PyTorch).</p>
            <p><a href="https://jobs.lever.co/auw/9234d6e2-f306-48d9-9cd6-9192d34d889c">Apply</a></p>
          </div>
        </div>
      </li>
    </ul>
  `;

  const items = parseHnHiringHtml(sampleHtml, 'python', REF_DATE);
  assert.equal(items.length, 2);

  const genentech = items[0];
  assert.equal(genentech.company, 'Genentech');
  assert.equal(genentech.title, '2027 Interns');
  assert.equal(genentech.sourceType, 'hnhiring');
  assert.equal(genentech.sourceName, 'HN Hiring');
  assert.equal(genentech.sourceUrl, 'https://go.gene.com/PDD-SSF-DigitalAI-Intern');
  assert.equal(genentech.deadline, '2026-11-28');
  assert.equal(genentech.deadlineIsExact, true);
  assert.equal(genentech.workFormat, 'Офис');
  assert.equal(genentech.direction, 'ML / Data');

  const unitedRisk = items[1];
  assert.equal(unitedRisk.company, 'United Risk');
  assert.equal(unitedRisk.title, 'Early-Career AI Engineers');
  assert.equal(unitedRisk.workFormat, 'Гибрид');
  assert.equal(unitedRisk.salaryFrom, 120000);
  assert.equal(unitedRisk.salaryTo, 150000);
  assert.equal(
    unitedRisk.sourceUrl,
    'https://jobs.lever.co/auw/9234d6e2-f306-48d9-9cd6-9192d34d889c'
  );
});

test('parseAmodoCareersHtml extracts non-senior Amodo Design roles with direct links and GBP salary', () => {
  const sampleHtml = `
    <section class="career-opning-section">
      <h2>Current openings</h2>
      <div class="row">
        <div class="col-lg-3">
          <div class="job-box">
            <h4>Compute Infrastructure Lead</h4>
            <p class="category-text">[£40,000-£55,000] <span>pro-rata</span></p>
            <a href="/career/compute-infrastructure-lead/" class="btn_">More info</a>
          </div>
        </div>
      </div>
      <h2>Next hiring round</h2>
      <div class="row">
        <div class="col-lg-3">
          <div class="job-box">
            <h4>Graduate Software Engineer</h4>
            <p class="category-text">[£40,000-£55,000] <span>pro-rata</span></p>
            <a href="/career/graduate-software-engineer/" class="btn_">More info</a>
          </div>
        </div>
        <div class="col-lg-3">
          <div class="job-box">
            <h4>AI Verification – General Application</h4>
            <a href="/career/ai-verification-general-application/" class="btn_">More info</a>
          </div>
        </div>
        <div class="col-lg-3">
          <div class="job-box">
            <h4>Senior Software Engineer</h4>
            <p class="category-text">[£55,000-£85,000] <span>pro-rata</span></p>
            <a href="/career/senior-software-engineer/" class="btn_">More info</a>
          </div>
        </div>
      </div>
    </section>
  `;

  const items = parseAmodoCareersHtml(sampleHtml, REF_DATE);
  assert.equal(items.length, 3);
  assert.equal(items.some((i) => /Senior/i.test(i.title)), false);

  const gradSwe = items.find((i) => i.externalId === 'amodo-graduate-software-engineer')!;
  assert.ok(gradSwe);
  assert.equal(gradSwe.company, 'Amodo Design');
  assert.equal(gradSwe.direction, 'Backend');
  assert.equal(gradSwe.grade, 'junior');
  assert.equal(gradSwe.market, 'global');
  assert.equal(gradSwe.city, 'Sheffield / London');
  assert.equal(gradSwe.salaryFrom, 40000);
  assert.equal(gradSwe.salaryTo, 55000);
  assert.equal(gradSwe.salaryText, '£40 000 – £55 000');
  assert.equal(gradSwe.sourceUrl, 'https://amododesign.com/career/graduate-software-engineer/');
  assert.equal(gradSwe.sourceType, 'amodo');

  const aiVerif = items.find((i) => i.externalId === 'amodo-ai-verification-general-application')!;
  assert.ok(aiVerif);
  assert.equal(aiVerif.direction, 'ML / Data');
  assert.equal(aiVerif.grade, 'intern_junior');
  assert.equal(aiVerif.salaryText, 'По итогам (UK)');
});

test('normalizeAmazonJob and normalizeNetflixJob extract direct links, locations, and grades', () => {
  const amz = normalizeAmazonJob(
    {
      id_icims: '10418355',
      title: '2027 Software Dev Engineer Intern',
      normalized_location: 'Dublin, IRL',
      job_path: '/en/jobs/10418355/2027-software-dev-engineer-intern',
      posted_date: 'November 18, 2026',
      job_category: 'Software Development',
    },
    REF_DATE
  );
  assert.equal(amz.company, 'Amazon / AWS');
  assert.equal(amz.city, 'Dublin');
  assert.equal(amz.direction, 'Backend');
  assert.equal(amz.grade, 'intern');
  assert.equal(amz.publishedAt, '2026-11-18');
  assert.equal(amz.sourceUrl, 'https://www.amazon.jobs/en/jobs/10418355/2027-software-dev-engineer-intern');
  assert.equal(amz.sourceType, 'amazon');

  const nf = normalizeNetflixJob(
    {
      id: 790318904468,
      name: 'Software Engineer Intern - Summer 2027',
      location: 'Los Gatos, California, United States',
      department: 'Engineering',
      canonicalPositionUrl: 'https://explore.jobs.netflix.net/careers/job/790318904468',
      t_create: Math.floor(Date.parse('2026-11-15T00:00:00Z') / 1000),
    },
    REF_DATE
  );
  assert.equal(nf.company, 'Netflix');
  assert.equal(nf.city, 'Los Gatos');
  assert.equal(nf.direction, 'Backend');
  assert.equal(nf.grade, 'intern');
  assert.equal(nf.sourceUrl, 'https://explore.jobs.netflix.net/careers/job/790318904468');
  assert.equal(nf.sourceType, 'netflix');
});



