import { Ban, ExternalLink, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  GLOBAL_ASHBY_BOARDS,
  GLOBAL_GREENHOUSE_BOARDS,
  GLOBAL_LEVER_BOARDS,
  RF_HH_EMPLOYERS,
} from '../data/seedInternships.ts';
import type { SourcePreset, SourceRunResult } from '../types/internship.ts';
import { isCompanyExcluded } from '../utils/internshipFilters.ts';

interface SourcesPanelProps {
  presets: SourcePreset[];
  onToggleSource: (sourceId: string) => void;
  customQuery: string;
  onChangeCustomQuery: (value: string) => void;
  excludedCompanies: string[];
  onAddExcludedCompanies: (rawInput: string) => void;
  onRemoveExcludedCompany: (companyName: string) => void;
  onToggleExcludedCompany: (companyName: string) => void;
  onClearExcludedCompanies: () => void;
  isParsing: boolean;
  onRunParse: () => void;
  lastResults: SourceRunResult[];
  lastParsedAt: string | null;
  onOpenUrlModal: () => void;
}

const TRACKED_GLOBAL_COMPANIES: Array<{ company: string; ats: string }> = [
  { company: 'Amazon / AWS', ats: 'Amazon API' },
  { company: 'Netflix', ats: 'Netflix API' },
  ...GLOBAL_GREENHOUSE_BOARDS.map((b) => ({ company: b.company, ats: 'Greenhouse' })),
  ...GLOBAL_ASHBY_BOARDS.map((b) => ({ company: b.company, ats: 'Ashby' })),
  ...GLOBAL_LEVER_BOARDS.map((b) => ({ company: b.company, ats: 'Lever' })),
  { company: 'Amodo Design', ats: 'Careers' },
];

export function SourcesPanel({
  presets,
  onToggleSource,
  customQuery,
  onChangeCustomQuery,
  excludedCompanies,
  onAddExcludedCompanies,
  onRemoveExcludedCompany,
  onToggleExcludedCompany,
  onClearExcludedCompanies,
  isParsing,
  onRunParse,
  lastResults,
  lastParsedAt,
  onOpenUrlModal,
}: SourcesPanelProps) {
  const [excludeInput, setExcludeInput] = useState('');
  const enabledCount = presets.filter((p) => p.enabled).length;

  const handleSubmitExclude = (e: FormEvent) => {
    e.preventDefault();
    if (!excludeInput.trim()) return;
    onAddExcludedCompanies(excludeInput);
    setExcludeInput('');
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Настройка парсера стажировок (РФ + Зарубеж)
            </h2>
            <p className="text-xs text-neutral-600 mt-1">
              Серверный парсер обращается к API Хабр Карьеры, HeadHunter (РФ), а также к открытым
              международным ATS API (Greenhouse, Ashby, Lever), Arbeitnow EU, HN Hiring и Amodo
              Design, объединяя вакансии без потери ваших статусов и заметок.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenUrlModal}
              className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap"
            >
              Парсить свой URL
            </button>
            <button
              type="button"
              disabled={isParsing || enabledCount === 0}
              onClick={onRunParse}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-on-accent bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isParsing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isParsing ? 'Парсинг идёт...' : 'Запустить сейчас'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="parser-custom-query"
            className="block text-xs font-medium text-neutral-700 mb-1.5"
          >
            Поисковый запрос для парсера (необязательно)
          </label>
          <input
            id="parser-custom-query"
            type="text"
            value={customQuery}
            onChange={(e) => onChangeCustomQuery(e.target.value)}
            placeholder="Например: Python, ML, Backend, Go (по умолчанию все Intern и New Grad позиции)"
            className="w-full max-w-xl h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="mt-5 divide-y divide-neutral-200 border border-neutral-200 rounded-md">
          {presets.map((preset) => (
            <label
              key={preset.id}
              className="flex items-start justify-between gap-4 p-4 hover:bg-neutral-50/70 cursor-pointer"
            >
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={preset.enabled}
                  onChange={() => onToggleSource(preset.id)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-700 focus:ring-blue-600"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-900">{preset.name}</div>
                  <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                    {preset.description}
                  </p>
                  <div className="mt-1 text-xs font-mono text-neutral-400 truncate">
                    {preset.targetUrl}
                  </div>
                </div>
              </div>
              <a
                href={preset.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Открыть источник ${preset.name}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-neutral-400 hover:text-blue-700 hover:bg-neutral-100 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </label>
          ))}
        </div>
      </section>

      <section
        className="bg-white border border-neutral-200 rounded-lg p-5"
        aria-label="Исключённые компании"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Ban className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              <span>Исключённые компании (не парсить)</span>
              {excludedCompanies.length > 0 && (
                <span className="font-mono text-xs tabular-nums text-neutral-500">
                  ({excludedCompanies.length})
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-600 mt-1">
              Указанные компании пропускаются сервером при каждом парсинге (включая Хабр Карьеру,
              HeadHunter, Greenhouse, Ashby, Lever, Arbeitnow EU, HN Hiring и Amodo Design), а их
              существующие вакансии убираются из таблицы. Список сохраняется в браузере.
            </p>
          </div>
          {excludedCompanies.length > 0 && (
            <button
              type="button"
              onClick={onClearExcludedCompanies}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
              <span>Очистить список</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmitExclude} className="mt-4 flex flex-col sm:flex-row gap-2 max-w-xl">
          <input
            id="exclude-company-input"
            type="text"
            aria-label="Название компании для исключения из парсинга"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            placeholder="Например: Palantir, МТС, Hireway (можно несколько через запятую)"
            className="flex-1 h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!excludeInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
            <span>Исключить</span>
          </button>
        </form>

        {excludedCompanies.length > 0 ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            data-testid="excluded-companies-list"
          >
            {excludedCompanies.map((company) => (
              <span
                key={company}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-50 pl-2.5 pr-1.5 py-1 text-xs font-medium text-neutral-800"
              >
                <span>{company}</span>
                <button
                  type="button"
                  onClick={() => onRemoveExcludedCompany(company)}
                  aria-label={`Вернуть компанию ${company} в парсинг`}
                  title={`Вернуть «${company}» в парсинг`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-900"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">
            Список пуст — парсятся все компании из активных источников. Вы можете исключать
            компании здесь, в «Таблице дедлайнов», в «Базе компаний» или сняв галочки ниже.
          </p>
        )}
      </section>

      {lastResults.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-neutral-900">
              Отчёт последнего запуска парсера
            </h3>
            {lastParsedAt && (
              <span className="font-mono text-xs tabular-nums text-neutral-500">
                {new Date(lastParsedAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 bg-white">
                  <th scope="col" className="py-2.5 px-5 font-medium">
                    Источник
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-medium">
                    Результат
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right font-medium">
                    Найдено
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right font-medium">
                    Время
                  </th>
                  <th scope="col" className="py-2.5 px-5 font-medium">
                    Комментарий
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/80">
                {lastResults.map((row) => {
                  const statusLabel =
                    row.status === 'ok'
                      ? 'Успешно'
                      : row.status === 'partial'
                        ? 'Частично'
                        : 'Ошибка';
                  const statusClass =
                    row.status === 'ok'
                      ? 'text-emerald-700 font-medium'
                      : row.status === 'partial'
                        ? 'text-amber-700 font-medium'
                        : 'text-red-700 font-medium';
                  return (
                    <tr key={row.sourceId}>
                      <td className="py-2.5 px-5 font-medium text-neutral-900">
                        {row.sourceName}
                      </td>
                      <td className={`py-2.5 px-3 whitespace-nowrap ${statusClass}`}>
                        {statusLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900">
                        {row.fetchedCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-500">
                        {row.durationMs} мс
                      </td>
                      <td className="py-2.5 px-5 text-neutral-600">{row.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-900">
          Отслеживаемые работодатели РФ в HeadHunter API
        </h3>
        <p className="text-xs text-neutral-600 mt-0.5">
          Снимите галочку, чтобы не парсить конкретную компанию (она автоматически добавится в
          список исключений).
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          {RF_HH_EMPLOYERS.map((emp) => {
            const excluded = isCompanyExcluded(emp.name, excludedCompanies);
            return (
              <label
                key={emp.id}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-neutral-100 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => onToggleExcludedCompany(emp.name)}
                    aria-label={`Парсить компанию ${emp.name}`}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-700 shrink-0"
                  />
                  <span
                    className={`font-medium truncate ${
                      excluded ? 'line-through text-neutral-400' : 'text-neutral-800'
                    }`}
                  >
                    {emp.name}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-neutral-400 shrink-0">#{emp.id}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-900">
          Зарубежные компании в ATS API (Greenhouse, Ashby, Lever)
        </h3>
        <p className="text-xs text-neutral-600 mt-0.5">
          Отключённые доски не запрашиваются сервером вообще — это ускоряет парсинг и убирает
          ненужные зарубежные вакансии.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          {TRACKED_GLOBAL_COMPANIES.map((board) => {
            const excluded = isCompanyExcluded(board.company, excludedCompanies);
            return (
              <label
                key={`${board.ats}-${board.company}`}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-neutral-100 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => onToggleExcludedCompany(board.company)}
                    aria-label={`Парсить компанию ${board.company}`}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-700 shrink-0"
                  />
                  <span
                    className={`font-medium truncate ${
                      excluded ? 'line-through text-neutral-400' : 'text-neutral-800'
                    }`}
                  >
                    {board.company}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-neutral-400 shrink-0">{board.ats}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
