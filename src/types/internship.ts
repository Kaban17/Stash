export type Direction =
  | 'Backend'
  | 'Frontend'
  | 'ML / Data'
  | 'Mobile'
  | 'Аналитика'
  | 'QA'
  | 'DevOps / Sec'
  | 'Продукт / Дизайн'
  | 'Другое';

export type WorkFormat = 'Офис' | 'Гибрид' | 'Удалённо' | 'Не указано';

export type GradeLevel = 'intern' | 'junior' | 'intern_junior';

export type ApplicationStatus =
  | 'not_applied'
  | 'planned'
  | 'applied'
  | 'test_task'
  | 'interview'
  | 'offer'
  | 'rejected';

export type MarketRegion = 'ru' | 'global';

export type SourceType =
  | 'hh_api'
  | 'habr_career'
  | 'company_portal'
  | 'greenhouse'
  | 'ashby'
  | 'lever'
  | 'arbeitnow'
  | 'custom_url'
  | 'manual';

export interface Internship {
  id: string;
  externalId: string;
  company: string;
  title: string;
  direction: Direction;
  grade?: GradeLevel;
  market?: MarketRegion;
  city: string;
  workFormat: WorkFormat;
  salaryText: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  deadline: string | null; // ISO YYYY-MM-DD or null for rolling admission
  deadlineIsExact: boolean;
  publishedAt: string | null; // ISO YYYY-MM-DD
  sourceUrl: string;
  sourceName: string;
  sourceType: SourceType;
  requirements: string;
  applicationStatus: ApplicationStatus;
  notes: string;
  isStarred: boolean;
  parsedAt: string; // ISO timestamp
  addedAt?: string; // ISO timestamp when first added to the user's tracker
}

export interface SourcePreset {
  id: string;
  name: string;
  type:
    | 'hh_employers'
    | 'hh_search'
    | 'habr_career'
    | 'habr_junior'
    | 'company_portals'
    | 'greenhouse_global'
    | 'ashby_global'
    | 'lever_global'
    | 'arbeitnow_eu';
  description: string;
  targetUrl: string;
  enabled: boolean;
  companiesCount: number;
}

export interface SourceRunResult {
  sourceId: string;
  sourceName: string;
  status: 'ok' | 'partial' | 'error';
  fetchedCount: number;
  durationMs: number;
  message: string;
}

export interface ParseResponse {
  items: Internship[];
  sources: SourceRunResult[];
  totalFetched: number;
  parsedAt: string;
}

export interface FilterState {
  search: string;
  company: string;
  city: string;
  market: MarketRegion | 'all';
  direction: Direction | 'all';
  workFormat: WorkFormat | 'all';
  grade: GradeLevel | 'all';
  backendMlOnly: boolean;
  quickFilter: 'all' | 'new' | 'urgent' | 'to_apply' | 'in_progress' | 'starred';
  hideExpired: boolean;
  pinNewFirst?: boolean;
}

export type SortField =
  | 'deadline'
  | 'addedAt'
  | 'company'
  | 'direction'
  | 'city'
  | 'workFormat'
  | 'salary'
  | 'status'
  | 'publishedAt';

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export type CompanySector =
  | 'Бигтех и экосистемы'
  | 'Финтех и банки'
  | 'E-commerce и логистика'
  | 'Телеком и облака'
  | 'AI, CV и NLP'
  | 'ИБ и системное ПО'
  | 'B2B, SaaS и тревел'
  | 'Промтех и Enterprise'
  | 'Global AI и Frontier Labs'
  | 'Global BigTech и Cloud'
  | 'Global FinTech и Quant'
  | 'DevTools, Infra и EU Product';

export interface RfCompanyEntry {
  id: string;
  name: string;
  market?: MarketRegion;
  country?: string;
  sector: CompanySector;
  tracks: Array<'Backend' | 'ML / Data'>;
  grades: Array<'Стажёр' | 'Junior'>;
  stack: string;
  cities: string;
  workFormat: string;
  programName: string;
  careerUrl: string;
  hhEmployerId?: string;
  internSalary?: string;
  atsProvider?: 'greenhouse' | 'ashby' | 'lever';
  atsSlug?: string;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  not_applied: 'Не подано',
  planned: 'В планах',
  applied: 'Откликнулся',
  test_task: 'Тестовое',
  interview: 'Собеседование',
  offer: 'Оффер',
  rejected: 'Отказ',
};

export const GRADE_LABELS: Record<GradeLevel, string> = {
  intern: 'Стажёр',
  junior: 'Junior',
  intern_junior: 'Стажёр / Junior',
};

export const MARKET_LABELS: Record<MarketRegion, string> = {
  ru: 'РФ',
  global: 'Зарубеж',
};

export const DIRECTION_OPTIONS: Direction[] = [
  'Backend',
  'ML / Data',
  'Frontend',
  'Mobile',
  'Аналитика',
  'QA',
  'DevOps / Sec',
  'Продукт / Дизайн',
  'Другое',
];

export const WORK_FORMAT_OPTIONS: WorkFormat[] = [
  'Удалённо',
  'Гибрид',
  'Офис',
  'Не указано',
];
