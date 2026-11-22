import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ApplicationStatus,
  Internship,
  SortConfig,
  SortField,
} from '../types/internship.ts';
import {
  APPLICATION_STATUS_LABELS,
  GRADE_LABELS,
  MARKET_LABELS,
} from '../types/internship.ts';
import { getDeadlineMeta } from '../utils/deadline.ts';
import { formatDirectLinkLabel } from '../utils/urlFormat.ts';

interface InternshipTableProps {
  items: Internship[];
  totalCount: number;
  newItemIds?: ReadonlySet<string>;
  isLoading: boolean;
  sort: SortConfig;
  onToggleSort: (field: SortField) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onToggleStar: (id: string) => void;
  onOpenDetail: (item: Internship) => void;
  onDelete: (id: string) => void;
  onExcludeCompany: (companyName: string) => void;
  onResetFilters: () => void;
  onRunParse: () => void;
  onOpenAddModal: () => void;
}

const STATUS_SELECT_TONE: Record<ApplicationStatus, string> = {
  not_applied: 'text-neutral-700 border-neutral-200 bg-white',
  planned: 'text-blue-800 border-blue-200 bg-blue-50/60',
  applied: 'text-indigo-800 border-indigo-200 bg-indigo-50/60',
  test_task: 'text-amber-800 border-amber-300 bg-amber-50/70',
  interview: 'text-emerald-800 border-emerald-300 bg-emerald-50/70',
  offer: 'text-emerald-900 border-emerald-400 bg-emerald-100/70 font-medium',
  rejected: 'text-neutral-500 border-neutral-200 bg-neutral-100',
};

const ALL_STATUSES: ApplicationStatus[] = [
  'not_applied',
  'planned',
  'applied',
  'test_task',
  'interview',
  'offer',
  'rejected',
];

function SortIcon({ field, sort }: { field: SortField; sort: SortConfig }) {
  if (sort.field !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />;
  }
  return sort.order === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
  );
}

export function InternshipTable({
  items,
  totalCount,
  newItemIds,
  isLoading,
  sort,
  onToggleSort,
  onStatusChange,
  onToggleStar,
  onOpenDetail,
  onDelete,
  onExcludeCompany,
  onResetFilters,
  onRunParse,
  onOpenAddModal,
}: InternshipTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50/70 text-xs text-neutral-600">
          Загружаем актуальные стажировки и Junior-вакансии с прямыми ссылками…
        </div>
        <div className="divide-y divide-neutral-200">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center animate-pulse"
            >
              <div className="col-span-5 space-y-2">
                <div className="h-3.5 w-36 bg-neutral-200 rounded" />
                <div className="h-3 w-64 bg-neutral-100 rounded" />
              </div>
              <div className="col-span-2 h-3.5 w-20 bg-neutral-100 rounded" />
              <div className="col-span-2 h-3.5 w-24 bg-neutral-200 rounded" />
              <div className="col-span-3 h-7 w-full bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    const isEmptyCatalog = totalCount === 0;
    return (
      <div className="bg-white border border-neutral-200 rounded-lg px-6 py-14 text-center">
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-neutral-900">
          {isEmptyCatalog
            ? 'В таблице пока нет загруженных вакансий'
            : 'Подходящих вакансий и стажировок не найдено'}
        </p>
        <p className="mt-1.5 text-sm text-neutral-600 max-w-md mx-auto">
          {isEmptyCatalog
            ? 'Запустите живой парсинг, чтобы загрузить актуальные стажировки и Junior-вакансии с прямыми ссылками, или добавьте вакансию вручную.'
            : 'Попробуйте изменить фильтры, запустить свежий парсинг источников или добавить программу вручную.'}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          {isEmptyCatalog ? (
            <button
              type="button"
              onClick={onRunParse}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              Запустить парсинг
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap"
            >
              Сбросить фильтры
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAddModal}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              isEmptyCatalog
                ? 'text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50'
                : 'text-white bg-blue-700 hover:bg-blue-800'
            }`}
          >
            Добавить запись
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      {/* Desktop high-density table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="internships-table">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-medium text-neutral-600">
              <th scope="col" className="py-2.5 pl-2.5 pr-1 w-8">
                <span className="sr-only">Избранное</span>
              </th>
              <th scope="col" className="py-2.5 px-1.5">
                <button
                  type="button"
                  onClick={() => onToggleSort('company')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Компания и программа</span>
                  <SortIcon field="company" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('direction')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Направление</span>
                  <SortIcon field="direction" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('city')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Город</span>
                  <SortIcon field="city" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('workFormat')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Формат</span>
                  <SortIcon field="workFormat" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('deadline')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Дедлайн</span>
                  <SortIcon field="deadline" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('salary')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Оплата</span>
                  <SortIcon field="salary" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                Ссылка
              </th>
              <th scope="col" className="py-2.5 px-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-neutral-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span>Статус</span>
                  <SortIcon field="status" sort={sort} />
                </button>
              </th>
              <th scope="col" className="py-2.5 pl-1 pr-2.5 text-right whitespace-nowrap">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/80 text-sm">
            {items.map((item) => {
              const deadlineMeta = getDeadlineMeta(item.deadline);
              const deadlineColor =
                deadlineMeta.urgency === 'overdue'
                  ? 'text-red-700 font-medium'
                  : deadlineMeta.urgency === 'urgent'
                    ? 'text-red-700 font-semibold'
                    : deadlineMeta.urgency === 'soon'
                      ? 'text-amber-700 font-medium'
                      : 'text-neutral-600';
              const gradeLabel = GRADE_LABELS[item.grade || 'intern'];
              const marketLabel = MARKET_LABELS[item.market || 'ru'];
              const isNew = Boolean(newItemIds?.has(item.id));

              return (
                <tr
                  key={item.id}
                  data-testid="internship-row"
                  data-new={isNew ? 'true' : undefined}
                  className={`transition-colors group ${
                    isNew
                      ? 'bg-blue-50/35 hover:bg-blue-50/60'
                      : 'hover:bg-neutral-50/90'
                  }`}
                >
                  <td
                    className={`py-2.5 pl-2.5 pr-1 align-middle ${
                      isNew ? 'border-l-2 border-l-blue-600' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleStar(item.id)}
                      aria-label={
                        item.isStarred
                          ? `Убрать ${item.company} из избранного`
                          : `Добавить ${item.company} в избранное`
                      }
                      aria-pressed={item.isStarred}
                      className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-neutral-200/60 focus-visible:outline-2 focus-visible:outline-blue-700"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          item.isStarred
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-neutral-300 group-hover:text-neutral-400'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </td>

                  <td className="py-2.5 px-1.5 align-middle max-w-[160px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(item)}
                        className="text-left font-semibold text-neutral-900 hover:text-blue-700 transition-colors shrink-0 max-w-[96px] truncate focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        {item.company}
                      </button>
                      {isNew ? (
                        <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1 text-[10px] font-medium leading-4 text-blue-700 shrink-0">
                          Новая
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500 min-w-0 truncate">
                          {marketLabel} · {gradeLabel}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(item)}
                      className="mt-0.5 block w-full text-left text-xs text-neutral-700 hover:text-neutral-950 truncate focus-visible:outline-2 focus-visible:outline-blue-700"
                    >
                      {item.title}
                    </button>
                  </td>

                  <td className="py-2.5 px-1.5 align-middle text-xs text-neutral-800 whitespace-nowrap">
                    {item.direction}
                  </td>

                  <td className="py-2.5 px-1.5 align-middle text-xs text-neutral-700 max-w-[84px] truncate">
                    {item.city}
                  </td>

                  <td className="py-2.5 px-1.5 align-middle text-xs text-neutral-700 whitespace-nowrap">
                    {item.workFormat}
                  </td>

                  <td className="py-2.5 px-1.5 align-middle whitespace-nowrap">
                    <div className="font-mono text-xs tabular-nums text-neutral-900">
                      {deadlineMeta.formattedDate}
                      {item.deadline && !item.deadlineIsExact && (
                        <span className="text-neutral-400 font-sans ml-1" title="Расчётный срок">
                          (оц.)
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] tabular-nums ${deadlineColor}`}>
                      {deadlineMeta.label}
                    </div>
                  </td>

                  <td className="py-2.5 px-1.5 align-middle text-right font-mono text-[11px] tabular-nums text-neutral-800 whitespace-nowrap">
                    {item.salaryText}
                  </td>

                  <td className="py-2.5 px-1.5 align-middle max-w-[132px]">
                    <div className="flex items-center gap-1 min-w-0">
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.sourceUrl}
                        aria-label={`Открыть вакансию ${item.company}: ${item.sourceUrl}`}
                        className="inline-flex items-center gap-1 min-w-0 font-mono text-[11px] text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        <span className="truncate">
                          {formatDirectLinkLabel(item.sourceUrl, 19)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.id, item.sourceUrl)}
                        aria-label={
                          copiedId === item.id
                            ? `Ссылка скопирована: ${item.company}`
                            : `Скопировать ссылку на вакансию ${item.company}`
                        }
                        title={copiedId === item.id ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3 w-3 text-emerald-700" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>

                  <td className="py-2.5 px-1.5 align-middle whitespace-nowrap">
                    <select
                      aria-label={`Статус отклика: ${item.company} — ${item.title}`}
                      value={item.applicationStatus}
                      onChange={(e) =>
                        onStatusChange(item.id, e.target.value as ApplicationStatus)
                      }
                      className={`h-8 w-[96px] rounded-md border px-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${STATUS_SELECT_TONE[item.applicationStatus]}`}
                    >
                      {ALL_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {APPLICATION_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2.5 pl-1 pr-2.5 align-middle text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(item)}
                        aria-label={`Заметки и детали: ${item.company}`}
                        title="Заметки и детали"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcludeCompany(item.company)}
                        aria-label={`Не парсить компанию ${item.company}`}
                        title={`Не парсить «${item.company}» и убрать её вакансии`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Удалить стажировку ${item.company}`}
                        title="Удалить только эту запись"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked list */}
      <div className="md:hidden divide-y divide-neutral-200">
        {items.map((item) => {
          const deadlineMeta = getDeadlineMeta(item.deadline);
          const deadlineColor =
            deadlineMeta.urgency === 'overdue' || deadlineMeta.urgency === 'urgent'
              ? 'text-red-700 font-semibold'
              : deadlineMeta.urgency === 'soon'
                ? 'text-amber-700 font-medium'
                : 'text-neutral-600';

          const gradeLabel = GRADE_LABELS[item.grade || 'intern'];
          const marketLabel = MARKET_LABELS[item.market || 'ru'];
          const isNew = Boolean(newItemIds?.has(item.id));

          return (
            <div
              key={item.id}
              className={`p-4 space-y-2.5 ${
                isNew ? 'bg-blue-50/35 border-l-2 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDetail(item)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-neutral-900">{item.company}</span>
                    {isNew && (
                      <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1 text-[10px] font-medium leading-4 text-blue-700">
                        Новая
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-700 mt-0.5 leading-snug">{item.title}</div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onExcludeCompany(item.company)}
                    aria-label={`Не парсить компанию ${item.company}`}
                    title={`Не парсить «${item.company}»`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStar(item.id)}
                    aria-label={`Избранное ${item.company}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        item.isStarred ? 'fill-amber-500 text-amber-500' : 'text-neutral-300'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="text-xs text-neutral-500">
                {marketLabel} · {gradeLabel} · {item.direction} · {item.city} · {item.workFormat} ·{' '}
                <span className="font-mono tabular-nums text-neutral-800">{item.salaryText}</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.sourceUrl}
                  className="inline-flex items-center gap-1.5 min-w-0 font-mono text-xs text-blue-700 hover:text-blue-900 hover:underline"
                >
                  <span className="truncate">{formatDirectLinkLabel(item.sourceUrl, 34)}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(item.id, item.sourceUrl)}
                  aria-label={
                    copiedId === item.id
                      ? `Ссылка скопирована: ${item.company}`
                      : `Скопировать ссылку на вакансию ${item.company}`
                  }
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {copiedId === item.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-xs">
                  <span className="font-mono tabular-nums text-neutral-900 mr-2">
                    {deadlineMeta.formattedDate}
                  </span>
                  <span className={deadlineColor}>{deadlineMeta.label}</span>
                </div>
                <select
                  aria-label={`Статус отклика: ${item.company}`}
                  value={item.applicationStatus}
                  onChange={(e) =>
                    onStatusChange(item.id, e.target.value as ApplicationStatus)
                  }
                  className={`h-9 rounded-md border px-2 text-xs ${STATUS_SELECT_TONE[item.applicationStatus]}`}
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {APPLICATION_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
