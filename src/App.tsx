import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Download,
  Globe,
  Menu,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AddOrParseModal } from './components/AddOrParseModal.tsx';
import { CompanyDirectory } from './components/CompanyDirectory.tsx';
import { DeadlineCalendar } from './components/DeadlineCalendar.tsx';
import { DetailDrawer } from './components/DetailDrawer.tsx';
import { InternshipTable } from './components/InternshipTable.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import type { ActiveView } from './components/Sidebar.tsx';
import { SourcesPanel } from './components/SourcesPanel.tsx';
import { SummaryStrip } from './components/SummaryStrip.tsx';
import {
  buildSeedInternships,
  DEFAULT_SOURCE_PRESETS,
} from './data/seedInternships.ts';
import type {
  ApplicationStatus,
  Direction,
  FilterState,
  GradeLevel,
  Internship,
  MarketRegion,
  ParseResponse,
  RfCompanyEntry,
  SortConfig,
  SortField,
  SourcePreset,
  SourceRunResult,
  WorkFormat,
} from './types/internship.ts';
import { DIRECTION_OPTIONS, WORK_FORMAT_OPTIONS } from './types/internship.ts';
import {
  downloadTextFile,
  generateCsvContent,
  generateIcsContent,
} from './utils/exportUtils.ts';
import {
  computeDashboardMetrics,
  deduplicateInternships,
  EXPIRED_HIDE_THRESHOLD_DAYS,
  filterAndSortInternships,
} from './utils/internshipFilters.ts';
import {
  loadUserPreferences,
  saveUserPreferences,
} from './utils/preferences.ts';

const STORAGE_KEY = 'stazhtrek_internships_v6';
const LEGACY_STORAGE_KEYS = [
  'stazhtrek_internships_v5',
  'stazhtrek_internships_v4',
  'stazhtrek_internships_v3',
  'stazhtrek_internships_v2',
  'stazhtrek_internships_v1',
];

const DEFAULT_FILTERS: FilterState = {
  search: '',
  company: 'all',
  market: 'all',
  direction: 'all',
  city: 'all',
  workFormat: 'all',
  grade: 'all',
  backendMlOnly: false,
  quickFilter: 'all',
  hideExpired: false,
};

function loadInitialInternships(): Internship[] {
  const freshSeeds = buildSeedInternships(new Date());
  try {
    const rawV3 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Internship[];
      }
    }
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const rawLegacy = window.localStorage.getItem(legacyKey);
      if (rawLegacy) {
        const parsedLegacy = JSON.parse(rawLegacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const { merged } = deduplicateInternships(parsedLegacy as Internship[], freshSeeds);
          return merged;
        }
      }
    }
  } catch {
    // Fallback to deterministic seed catalog
  }
  return freshSeeds;
}

const VIEW_BREADCRUMBS: Record<ActiveView, string> = {
  table: 'Таблица дедлайнов',
  calendar: 'Календарь сроков',
  companies: 'База компаний (РФ + Мир)',
  sources: 'Источники парсинга',
};

const SORT_FIELD_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'deadline', label: 'Дедлайн' },
  { value: 'workFormat', label: 'Формат работы' },
  { value: 'city', label: 'Город' },
  { value: 'direction', label: 'Направление' },
  { value: 'salary', label: 'Оплата' },
  { value: 'company', label: 'Компания' },
  { value: 'status', label: 'Статус' },
];

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export default function App() {
  const [internships, setInternships] = useState<Internship[]>(loadInitialInternships);
  const [activeView, setActiveView] = useState<ActiveView>('table');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    hideExpired: loadUserPreferences().hideExpired,
  }));
  const [sort, setSort] = useState<SortConfig>({ field: 'deadline', order: 'asc' });

  const [sourcePresets, setSourcePresets] = useState<SourcePreset[]>(DEFAULT_SOURCE_PRESETS);
  const [customQuery, setCustomQuery] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [lastRunResults, setLastRunResults] = useState<SourceRunResult[]>([]);
  const [lastParsedAt, setLastParsedAt] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    tone: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [searchingCompanyId, setSearchingCompanyId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ open: boolean; tab: 'parse' | 'manual' }>({
    open: false,
    tab: 'parse',
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(internships));
    } catch {
      // Ignore storage quota errors
    }
  }, [internships]);

  useEffect(() => {
    saveUserPreferences({ hideExpired: filters.hideExpired });
  }, [filters.hideExpired]);

  const metrics = useMemo(() => computeDashboardMetrics(internships), [internships]);

  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    for (const item of internships) {
      const cleaned = item.city?.trim();
      if (cleaned) {
        citySet.add(cleaned);
      }
    }
    return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [internships]);

  const visibleItems = useMemo(
    () => filterAndSortInternships(internships, filters, sort),
    [internships, filters, sort]
  );

  const handleToggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: field === 'salary' ? 'desc' : 'asc' }
    );
  };

  const handleStatusChange = (id: string, status: ApplicationStatus) => {
    setInternships((prev) =>
      prev.map((item) => (item.id === id ? { ...item, applicationStatus: status } : item))
    );
  };

  const handleToggleStar = (id: string) => {
    setInternships((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isStarred: !item.isStarred } : item))
    );
  };

  const handleUpdateInternship = (id: string, patch: Partial<Internship>) => {
    setInternships((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleDeleteInternship = (id: string) => {
    setInternships((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddInternship = (item: Internship) => {
    setInternships((prev) => {
      const { merged } = deduplicateInternships(prev, [item]);
      return merged;
    });
    setBannerMessage({
      tone: 'success',
      text: `Стажировка «${item.company} — ${item.title}» добавлена в таблицу.`,
    });
  };

  const handleToggleSource = (sourceId: string) => {
    setSourcePresets((prev) =>
      prev.map((src) => (src.id === sourceId ? { ...src, enabled: !src.enabled } : src))
    );
  };

  const handleRunLiveParse = async () => {
    const enabledIds = sourcePresets.filter((s) => s.enabled).map((s) => s.id);
    if (enabledIds.length === 0) {
      setBannerMessage({
        tone: 'error',
        text: 'Выберите хотя бы один источник в разделе «Источники парсинга».',
      });
      return;
    }

    setIsParsing(true);
    setBannerMessage(null);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: enabledIds,
          query: customQuery,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as ParseResponse;
      setLastRunResults(data.sources);
      setLastParsedAt(data.parsedAt);

      if (data.items.length > 0) {
        const { merged, addedCount, updatedCount } = deduplicateInternships(
          internships,
          data.items
        );
        setInternships(merged);
        setBannerMessage({
          tone: 'success',
          text: `Парсинг завершён: добавлено ${addedCount} ${pluralRu(addedCount, 'новая стажировка', 'новые стажировки', 'новых стажировок')}, обновлено ${updatedCount} ${pluralRu(updatedCount, 'запись', 'записи', 'записей')} (источников: ${data.sources.length}).`,
        });
      } else {
        const failedCount = data.sources.filter((s) => s.status === 'error').length;
        setBannerMessage({
          tone: failedCount > 0 ? 'error' : 'info',
          text:
            failedCount > 0
              ? 'Часть внешних сайтов РФ не ответила из текущей сети. Подробности доступны во вкладке «Источники парсинга».'
              : 'Новых стажировок по выбранному запросу не найдено.',
        });
      }
    } catch {
      setBannerMessage({
        tone: 'error',
        text: 'Не удалось связаться с сервером парсинга. Проверьте соединение и повторите попытку.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSearchCompanyVacancies = async (entry: RfCompanyEntry) => {
    setSearchingCompanyId(entry.id);
    setBannerMessage(null);

    try {
      const res = await fetch('/api/parse-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: entry.name,
          market: entry.market || 'ru',
          atsProvider: entry.atsProvider,
          atsSlug: entry.atsSlug,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        companyName: string;
        items: Internship[];
        count: number;
        sourceLabel?: string;
      };

      const sourceName = data.sourceLabel || (entry.market === 'global' ? 'ATS API' : 'Хабр Карьере');

      if (data.items.length > 0) {
        const { merged, addedCount, updatedCount } = deduplicateInternships(
          internships,
          data.items
        );
        setInternships(merged);
        setBannerMessage({
          tone: 'success',
          text: `${entry.name} (${sourceName}): найдено ${data.count} ${pluralRu(data.count, 'вакансия', 'вакансии', 'вакансий')} (добавлено ${addedCount}, обновлено ${updatedCount}). Перейдите в «Таблица дедлайнов», чтобы посмотреть.`,
        });
      } else {
        setBannerMessage({
          tone: 'info',
          text: `В источнике ${sourceName} сейчас нет открытых Intern/New Grad/Junior вакансий «${entry.name}». Проверьте прямой карьерный портал по ссылке в таблице.`,
        });
      }
    } catch {
      setBannerMessage({
        tone: 'error',
        text: `Не удалось проверить вакансии «${entry.name}». Повторите попытку позже.`,
      });
    } finally {
      setSearchingCompanyId(null);
    }
  };

  const handleExportCsv = () => {
    const csv = generateCsvContent(visibleItems);
    downloadTextFile(
      `stazhirovki-rf-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportIcs = (subset: Internship[] = visibleItems) => {
    const ics = generateIcsContent(subset);
    downloadTextFile(
      `deadlines-rf-${new Date().toISOString().slice(0, 10)}.ics`,
      ics,
      'text/calendar;charset=utf-8;'
    );
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-[#111827]">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        internships={internships}
        selectedCompany={filters.company}
        onSelectCompany={(company) => setFilters((prev) => ({ ...prev, company }))}
        urgentCount={metrics.urgentCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb left + 1 Primary CTA right */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Открыть меню разделов"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 shrink-0"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <nav aria-label="Навигационная цепочка" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-neutral-500 whitespace-nowrap hidden sm:inline">СтажТрек</span>
              <span className="text-neutral-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-[family-name:var(--font-display)] font-semibold text-neutral-900 truncate whitespace-nowrap">
                {VIEW_BREADCRUMBS[activeView]}
              </h1>
              {filters.company !== 'all' &&
                activeView !== 'sources' &&
                activeView !== 'companies' && (
                  <>
                    <span className="text-neutral-300" aria-hidden="true">
                      /
                    </span>
                    <span className="text-neutral-700 truncate">{filters.company}</span>
                  </>
                )}
            </nav>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled={isParsing}
              onClick={handleRunLiveParse}
              aria-label="Запустить парсинг"
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isParsing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="sm:hidden">{isParsing ? 'Парсинг...' : 'Парсить'}</span>
              <span className="hidden sm:inline">
                {isParsing ? 'Парсинг...' : 'Запустить парсинг'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 space-y-5">
          {bannerMessage && (
            <div
              role="status"
              className={`flex items-center justify-between gap-4 rounded-md border px-4 py-2.5 text-xs ${
                bannerMessage.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : bannerMessage.tone === 'error'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span>{bannerMessage.text}</span>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                className="font-medium underline shrink-0"
              >
                Скрыть
              </button>
            </div>
          )}

          {activeView !== 'sources' && activeView !== 'companies' && (
            <SummaryStrip
              metrics={metrics}
              onResetFilters={resetFilters}
              onFilterUrgent={() => {
                setActiveView('table');
                setFilters((prev) => ({
                  ...prev,
                  quickFilter: prev.quickFilter === 'urgent' ? 'all' : 'urgent',
                }));
              }}
              onFilterInProgress={() => {
                setActiveView('table');
                setFilters((prev) => ({
                  ...prev,
                  quickFilter: prev.quickFilter === 'in_progress' ? 'all' : 'in_progress',
                }));
              }}
            />
          )}

          {activeView === 'table' && (
            <>
              {/* Row 1: Search + secondary actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search
                    className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    aria-label="Поиск по стажировкам"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, search: e.target.value }))
                    }
                    placeholder="Поиск: компания, стек, город..."
                    className="w-full h-9 rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalState({ open: true, tab: 'parse' })}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Globe className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    <span>Парсить URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalState({ open: true, tab: 'manual' })}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    <span>Добавить</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
                    title="Выгрузить таблицу в CSV для Excel или Google Таблиц"
                  >
                    <Download className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportIcs(visibleItems)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
                    title="Экспортировать дедлайны в календарь (.ics)"
                  >
                    <Calendar className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    <span>.ics</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Domain filters (Backend+ML, Grade, Direction, City, Format) + Sorting */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={filters.backendMlOnly}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        backendMlOnly: !prev.backendMlOnly,
                        direction: !prev.backendMlOnly ? 'all' : prev.direction,
                      }))
                    }
                    className={`h-8 px-2.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filters.backendMlOnly
                        ? 'border-blue-700 bg-blue-50 text-blue-800'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Бек + ML
                  </button>

                  <select
                    aria-label="Фильтр по рынку"
                    value={filters.market}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        market: e.target.value as MarketRegion | 'all',
                      }))
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Все рынки</option>
                    <option value="ru">РФ</option>
                    <option value="global">Зарубеж</option>
                  </select>

                  <select
                    aria-label="Фильтр по грейду"
                    value={filters.grade}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        grade: e.target.value as GradeLevel | 'all',
                      }))
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Все грейды</option>
                    <option value="intern">Стажёр</option>
                    <option value="junior">Junior</option>
                  </select>

                  <select
                    aria-label="Фильтр по направлению"
                    value={filters.direction}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        direction: e.target.value as Direction | 'all',
                        backendMlOnly: e.target.value === 'all' ? prev.backendMlOnly : false,
                      }))
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Все направления</option>
                    {DIRECTION_OPTIONS.map((dir) => (
                      <option key={dir} value={dir}>
                        {dir}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Фильтр по городу"
                    value={filters.city}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 max-w-[160px] focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Все города</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Фильтр по формату работы"
                    value={filters.workFormat}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        workFormat: e.target.value as WorkFormat | 'all',
                      }))
                    }
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">Любой формат</option>
                    {WORK_FORMAT_OPTIONS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
                  <label htmlFor="table-sort-select" className="text-neutral-500 whitespace-nowrap">
                    Сортировка:
                  </label>
                  <select
                    id="table-sort-select"
                    aria-label="Сортировка таблицы"
                    value={sort.field}
                    onChange={(e) => {
                      const field = e.target.value as SortField;
                      setSort({
                        field,
                        order: field === 'salary' ? 'desc' : 'asc',
                      });
                    }}
                    className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
                  >
                    {SORT_FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSort((prev) => ({
                        ...prev,
                        order: prev.order === 'asc' ? 'desc' : 'asc',
                      }))
                    }
                    aria-label={
                      sort.order === 'asc'
                        ? 'Порядок сортировки: по возрастанию'
                        : 'Порядок сортировки: по убыванию'
                    }
                    title={sort.order === 'asc' ? 'По возрастанию' : 'По убыванию'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  >
                    {sort.order === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Row 3: Segmented quick filters + count + hide expired toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div
                  className="inline-flex items-center gap-0.5 p-0.5 bg-neutral-200/70 rounded-md max-w-full overflow-x-auto"
                  role="group"
                  aria-label="Быстрые фильтры"
                >
                  {(
                    [
                      ['all', 'Все'],
                      ['urgent', 'Горящие'],
                      ['to_apply', 'К подаче'],
                      ['in_progress', 'В процессе'],
                      ['starred', 'Избранные'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, quickFilter: id }))}
                      aria-pressed={filters.quickFilter === id}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        filters.quickFilter === id
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-neutral-500">
                  <span className="whitespace-nowrap">
                    Показано{' '}
                    <strong className="font-mono tabular-nums text-neutral-800">
                      {visibleItems.length}
                    </strong>{' '}
                    из <span className="font-mono tabular-nums">{internships.length}</span>
                  </span>
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer text-neutral-600 whitespace-nowrap"
                    title={`Автоматически скрывать стажировки с истёкшим дедлайном (более ${EXPIRED_HIDE_THRESHOLD_DAYS} дн. назад). Настройка сохраняется в браузере.`}
                  >
                    <input
                      type="checkbox"
                      aria-label="Скрыть просроченные"
                      checked={filters.hideExpired}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, hideExpired: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-700"
                    />
                    <span>
                      Скрыть просроченные{' '}
                      <span className="text-neutral-400">(&gt; {EXPIRED_HIDE_THRESHOLD_DAYS} дн.)</span>
                    </span>
                  </label>
                </div>
              </div>

              <InternshipTable
                items={visibleItems}
                isLoading={isParsing}
                sort={sort}
                onToggleSort={handleToggleSort}
                onStatusChange={handleStatusChange}
                onToggleStar={handleToggleStar}
                onOpenDetail={setSelectedInternship}
                onDelete={handleDeleteInternship}
                onResetFilters={resetFilters}
                onOpenAddModal={() => setModalState({ open: true, tab: 'manual' })}
              />
            </>
          )}

          {activeView === 'calendar' && (
            <DeadlineCalendar
              items={visibleItems}
              onOpenDetail={setSelectedInternship}
              onStatusChange={handleStatusChange}
              onExportIcs={() => handleExportIcs(visibleItems)}
            />
          )}

          {activeView === 'companies' && (
            <CompanyDirectory
              searchingCompanyId={searchingCompanyId}
              onSearchCompanyVacancies={handleSearchCompanyVacancies}
            />
          )}

          {activeView === 'sources' && (
            <SourcesPanel
              presets={sourcePresets}
              onToggleSource={handleToggleSource}
              customQuery={customQuery}
              onChangeCustomQuery={setCustomQuery}
              isParsing={isParsing}
              onRunParse={handleRunLiveParse}
              lastResults={lastRunResults}
              lastParsedAt={lastParsedAt}
              onOpenUrlModal={() => setModalState({ open: true, tab: 'parse' })}
            />
          )}
        </main>
      </div>

      <DetailDrawer
        item={selectedInternship}
        onClose={() => setSelectedInternship(null)}
        onUpdate={handleUpdateInternship}
        onDelete={handleDeleteInternship}
        onExportSingleIcs={(item) => handleExportIcs([item])}
      />

      <AddOrParseModal
        key={modalState.tab + String(modalState.open)}
        open={modalState.open}
        initialTab={modalState.tab}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onAddInternship={handleAddInternship}
      />
    </div>
  );
}
