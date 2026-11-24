import type { DashboardMetrics } from '../utils/internshipFilters.ts';

interface SummaryStripProps {
  metrics: DashboardMetrics;
  onFilterUrgent: () => void;
  onFilterInProgress: () => void;
  onResetFilters: () => void;
}

export function SummaryStrip({
  metrics,
  onFilterUrgent,
  onFilterInProgress,
  onResetFilters,
}: SummaryStripProps) {
  return (
    <section
      aria-label="Сводка по стажировкам и дедлайнам"
      className="bg-white border border-neutral-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 overflow-hidden"
    >
      <button
        type="button"
        onClick={onResetFilters}
        className="flex flex-col justify-start text-left px-5 py-4 hover:bg-neutral-50 transition-colors border-b border-r lg:border-b-0 border-neutral-200 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700"
      >
        <div className="text-xs text-neutral-500">Всего в таблице</div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-neutral-900">
          {metrics.total}
        </div>
      </button>

      <button
        type="button"
        onClick={onFilterUrgent}
        className="flex flex-col justify-start text-left px-5 py-4 hover:bg-neutral-50 transition-colors border-b lg:border-b-0 lg:border-r border-neutral-200 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700"
      >
        <div className="text-xs text-neutral-500">Горят (до 7 дней)</div>
        <div
          className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
            metrics.urgentCount > 0 ? 'text-red-700' : 'text-neutral-900'
          }`}
        >
          {metrics.urgentCount}
        </div>
      </button>

      <button
        type="button"
        onClick={onFilterInProgress}
        className="flex flex-col justify-start text-left px-5 py-4 hover:bg-neutral-50 transition-colors border-r border-neutral-200 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700"
      >
        <div className="text-xs text-neutral-500">Отклики в работе</div>
        <div
          className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-700"
          data-testid="metric-in-progress"
        >
          {metrics.inProgressCount}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">отклик, тестовое, интервью</div>
      </button>

      <div className="px-5 py-4">
        <div className="text-xs text-neutral-500">Ближайший дедлайн</div>
        {metrics.nearestDeadline ? (
          <>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-neutral-900">
              {metrics.nearestDeadline.dateFormatted}
            </div>
            <div className="mt-0.5 text-xs text-neutral-600 truncate">
              {metrics.nearestDeadline.company} ·{' '}
              {metrics.nearestDeadline.daysLeft === 0
                ? 'сегодня'
                : metrics.nearestDeadline.daysLeft === 1
                  ? 'завтра'
                  : `через ${metrics.nearestDeadline.daysLeft} дн.`}
            </div>
          </>
        ) : (
          <>
            <div className="mt-1 font-mono text-xl font-semibold text-neutral-400">—</div>
            <div className="mt-0.5 text-xs text-neutral-500">нет активных сроков</div>
          </>
        )}
      </div>
    </section>
  );
}
