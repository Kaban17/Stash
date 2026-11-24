import { Ban, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  GLOBAL_BACKEND_ML_COMPANIES,
  GLOBAL_COMPANY_SECTORS,
} from '../data/globalCompanyDirectory.ts';
import {
  COMPANY_SECTORS,
  RF_BACKEND_ML_COMPANIES,
} from '../data/rfCompanyDirectory.ts';
import type { CompanySector, MarketRegion, RfCompanyEntry } from '../types/internship.ts';
import { isCompanyExcluded } from '../utils/internshipFilters.ts';

interface CompanyDirectoryProps {
  searchingCompanyId: string | null;
  onSearchCompanyVacancies: (entry: RfCompanyEntry) => void;
  excludedCompanies: string[];
  onToggleExcludedCompany: (companyName: string) => void;
}

const ALL_COMPANIES: RfCompanyEntry[] = [
  ...RF_BACKEND_ML_COMPANIES.map((c) => ({ ...c, market: 'ru' as const })),
  ...GLOBAL_BACKEND_ML_COMPANIES,
];

const ATS_LABELS: Record<
  'greenhouse' | 'ashby' | 'lever' | 'amodo' | 'amazon' | 'netflix',
  string
> = {
  greenhouse: 'Greenhouse API',
  ashby: 'Ashby API',
  lever: 'Lever API',
  amodo: 'Amodo Careers',
  amazon: 'Amazon Jobs API',
  netflix: 'Netflix Careers API',
};

export function CompanyDirectory({
  searchingCompanyId,
  onSearchCompanyVacancies,
  excludedCompanies,
  onToggleExcludedCompany,
}: CompanyDirectoryProps) {
  const [marketFilter, setMarketFilter] = useState<'all' | MarketRegion>('all');
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState<CompanySector | 'all'>('all');
  const [trackFilter, setTrackFilter] = useState<'all' | 'Backend' | 'ML / Data'>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'Стажёр' | 'Junior'>('all');

  const availableSectors = useMemo(() => {
    if (marketFilter === 'ru') return COMPANY_SECTORS;
    if (marketFilter === 'global') return GLOBAL_COMPANY_SECTORS;
    return [...COMPANY_SECTORS, ...GLOBAL_COMPANY_SECTORS];
  }, [marketFilter]);

  const handleSelectMarket = (nextMarket: 'all' | MarketRegion) => {
    setMarketFilter(nextMarket);
    setSector('all');
  };

  const marketScope = useMemo(() => {
    if (marketFilter === 'all') return ALL_COMPANIES;
    return ALL_COMPANIES.filter((c) => (c.market || 'ru') === marketFilter);
  }, [marketFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return marketScope.filter((c) => {
      if (sector !== 'all' && c.sector !== sector) return false;
      if (trackFilter !== 'all' && !c.tracks.includes(trackFilter)) return false;
      if (gradeFilter !== 'all' && !c.grades.includes(gradeFilter)) return false;
      if (q) {
        const hay =
          `${c.name} ${c.sector} ${c.stack} ${c.cities} ${c.country || ''} ${c.programName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [marketScope, search, sector, trackFilter, gradeFilter]);

  const mlCount = marketScope.filter((c) => c.tracks.includes('ML / Data')).length;
  const backendCount = marketScope.filter((c) => c.tracks.includes('Backend')).length;

  return (
    <div className="space-y-5">
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">База IT-компаний</h2>
            <p className="text-xs text-neutral-600 mt-1">
              Backend: <span className="font-mono tabular-nums text-neutral-900">{backendCount}</span>{' '}
              · ML / Data: <span className="font-mono tabular-nums text-neutral-900">{mlCount}</span>
            </p>
          </div>
          <div className="font-mono text-xs tabular-nums text-neutral-500 shrink-0 text-right">
            <div>
              Показано {filtered.length} из {marketScope.length}
            </div>
            {excludedCompanies.length > 0 && (
              <div className="text-amber-700 mt-0.5">
                Исключено: {excludedCompanies.length}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex items-center gap-0.5 p-0.5 segment-track rounded-md shrink-0"
              role="group"
              aria-label="Фильтр по рынку"
            >
              {(
                [
                  ['all', `Все (${ALL_COMPANIES.length})`],
                  ['ru', `РФ (${RF_BACKEND_ML_COMPANIES.length})`],
                  ['global', `Зарубеж (${GLOBAL_BACKEND_ML_COMPANIES.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectMarket(id)}
                  aria-pressed={marketFilter === id}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    marketFilter === id
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-0.5 p-0.5 segment-track rounded-md"
                role="group"
                aria-label="Фильтр по треку"
              >
                {(['all', 'Backend', 'ML / Data'] as const).map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => setTrackFilter(tr)}
                    aria-pressed={trackFilter === tr}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      trackFilter === tr
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {tr === 'all' ? 'Бек + ML' : tr}
                  </button>
                ))}
              </div>

              <div
                className="inline-flex items-center gap-0.5 p-0.5 segment-track rounded-md"
                role="group"
                aria-label="Фильтр по грейду"
              >
                {(['all', 'Стажёр', 'Junior'] as const).map((gr) => (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => setGradeFilter(gr)}
                    aria-pressed={gradeFilter === gr}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      gradeFilter === gr
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {gr === 'all' ? 'Все грейды' : gr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search
                className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Поиск по базе компаний"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Компания, стек (Go, PyTorch, CUDA), город..."
                className="w-full h-9 rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <select
              aria-label="Фильтр по отрасли"
              value={sector}
              onChange={(e) => setSector(e.target.value as CompanySector | 'all')}
              className="h-9 rounded-md border border-neutral-300 bg-white px-2.5 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Все отрасли</option>
              {availableSectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs" data-testid="companies-directory-table">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600 font-medium">
                <th scope="col" className="py-2.5 pl-5 pr-3">
                  Компания и программа
                </th>
                <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                  Треки и грейд
                </th>
                <th scope="col" className="py-2.5 px-3">
                  Типичный стек
                </th>
                <th scope="col" className="py-2.5 px-3">
                  Города и формат
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/80">
              {filtered.map((entry) => {
                const isSearching = searchingCompanyId === entry.id;
                const isGlobal = entry.market === 'global';
                const isExcluded = isCompanyExcluded(entry.name, excludedCompanies);
                const liveSourceNote = entry.atsProvider
                  ? ATS_LABELS[entry.atsProvider]
                  : isGlobal
                    ? 'Портал / Arbeitnow EU'
                    : 'Хабр Карьера';

                return (
                  <tr
                    key={entry.id}
                    data-testid="company-directory-row"
                    className={`transition-colors ${
                      isExcluded ? 'bg-neutral-50/80 text-neutral-400' : 'hover:bg-neutral-50/80'
                    }`}
                  >
                    <td className="py-3 pl-5 pr-3 align-top max-w-[290px]">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isExcluded ? 'line-through text-neutral-400' : 'text-neutral-900'
                          }`}
                        >
                          {entry.name}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {isGlobal ? entry.country || 'Зарубеж' : 'РФ'}
                        </span>
                      </div>
                      <div className="text-neutral-500 mt-0.5">
                        {entry.sector} · {liveSourceNote}
                      </div>
                      <div className={`mt-0.5 ${isExcluded ? 'text-neutral-400' : 'text-neutral-700'}`}>
                        {entry.programName}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className={`font-medium ${isExcluded ? 'text-neutral-400' : 'text-neutral-900'}`}>
                        {entry.tracks.join(' · ')}
                      </div>
                      <div className="text-neutral-500 mt-0.5">{entry.grades.join(' / ')}</div>
                      {entry.internSalary && (
                        <div className="font-mono text-[11px] tabular-nums text-emerald-800 mt-1">
                          Стажёр: {entry.internSalary}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top max-w-[240px] font-mono text-[11px] text-neutral-700 leading-relaxed">
                      {entry.stack}
                    </td>
                    <td className="py-3 px-3 align-top max-w-[210px]">
                      <div className={isExcluded ? 'text-neutral-400' : 'text-neutral-800'}>
                        {entry.cities}
                      </div>
                      <div className="text-neutral-500 mt-0.5">{entry.workFormat}</div>
                    </td>
                    <td className="py-3 pl-3 pr-5 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-pressed={isExcluded}
                          aria-label={
                            isExcluded
                              ? `Вернуть компанию ${entry.name} в парсинг`
                              : `Не парсить компанию ${entry.name}`
                          }
                          title={
                            isExcluded
                              ? `Вернуть «${entry.name}» в парсинг`
                              : `Исключить «${entry.name}» из парсинга`
                          }
                          onClick={() => onToggleExcludedCompany(entry.name)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                            isExcluded
                              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                          }`}
                        >
                          <Ban className="h-3 w-3" aria-hidden="true" />
                          <span>{isExcluded ? 'Исключена' : 'Не парсить'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSearching || isExcluded}
                          title={
                            isExcluded
                              ? 'Снимите исключение, чтобы искать вакансии этой компании'
                              : undefined
                          }
                          onClick={() => onSearchCompanyVacancies(entry)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          <RefreshCw
                            className={`h-3 w-3 text-neutral-500 ${isSearching ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{isSearching ? 'Поиск...' : 'Найти вакансии'}</span>
                        </button>
                        <a
                          href={entry.careerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Карьерный портал ${entry.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:text-blue-700 hover:bg-neutral-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
