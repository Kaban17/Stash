import { ExternalLink } from 'lucide-react';
import type { ApplicationStatus, Internship } from '../types/internship.ts';
import { APPLICATION_STATUS_LABELS } from '../types/internship.ts';
import { getDeadlineMeta } from '../utils/deadline.ts';

interface DeadlineCalendarProps {
  items: Internship[];
  onOpenDetail: (item: Internship) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onExportIcs: () => void;
}

interface Bucket {
  id: string;
  title: string;
  accentText: string;
  items: Internship[];
}

export function DeadlineCalendar({
  items,
  onOpenDetail,
  onStatusChange,
  onExportIcs,
}: DeadlineCalendarProps) {
  const buckets: Bucket[] = [
    {
      id: 'overdue',
      title: 'Просроченные дедлайны',
      accentText: 'text-red-700',
      items: [],
    },
    {
      id: 'urgent',
      title: 'Ближайшие 7 дней',
      accentText: 'text-red-700',
      items: [],
    },
    {
      id: 'soon',
      title: 'От 8 до 14 дней',
      accentText: 'text-amber-700',
      items: [],
    },
    {
      id: 'later',
      title: 'Позднее 2 недель',
      accentText: 'text-neutral-900',
      items: [],
    },
    {
      id: 'rolling',
      title: 'Открытый набор',
      accentText: 'text-neutral-700',
      items: [],
    },
  ];

  const sorted = [...items].sort((a, b) => {
    if (!a.deadline && !b.deadline) return a.company.localeCompare(b.company, 'ru');
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  for (const item of sorted) {
    const meta = getDeadlineMeta(item.deadline);
    if (meta.urgency === 'overdue') buckets[0].items.push(item);
    else if (meta.urgency === 'urgent') buckets[1].items.push(item);
    else if (meta.urgency === 'soon') buckets[2].items.push(item);
    else if (meta.urgency === 'normal') buckets[3].items.push(item);
    else buckets[4].items.push(item);
  }

  const nonEmptyBuckets = buckets.filter((b) => b.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-neutral-200 rounded-lg px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Хронология дедлайнов</h2>
        <button
          type="button"
          onClick={onExportIcs}
          className="px-4 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap"
        >
          Скачать календарь (.ics)
        </button>
      </div>

      {nonEmptyBuckets.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center text-sm text-neutral-600">
          Нет дедлайнов для отображения.
        </div>
      ) : (
        <div className="space-y-5">
          {nonEmptyBuckets.map((bucket) => (
            <section
              key={bucket.id}
              className="bg-white border border-neutral-200 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3 bg-neutral-50/80 border-b border-neutral-200 flex items-center justify-between gap-4">
                <h3 className={`text-sm font-semibold ${bucket.accentText}`}>{bucket.title}</h3>
                <span className="font-mono text-xs tabular-nums text-neutral-500 shrink-0">
                  {bucket.items.length}
                </span>
              </div>
              <ul className="divide-y divide-neutral-200/80">
                {bucket.items.map((item) => {
                  const meta = getDeadlineMeta(item.deadline);
                  return (
                    <li
                      key={item.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 transition-colors"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-24 shrink-0">
                          <div className="font-mono text-xs font-medium tabular-nums text-neutral-900">
                            {meta.formattedDate}
                          </div>
                          <div
                            className={`text-xs tabular-nums ${
                              meta.urgency === 'urgent' || meta.urgency === 'overdue'
                                ? 'text-red-700 font-medium'
                                : meta.urgency === 'soon'
                                  ? 'text-amber-700'
                                  : 'text-neutral-500'
                            }`}
                          >
                            {meta.label}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(item)}
                            className="text-left text-sm font-semibold text-neutral-900 hover:text-blue-700 transition-colors"
                          >
                            {item.company} · <span className="font-normal">{item.title}</span>
                          </button>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {item.direction} · {item.city} · {item.workFormat} · {item.salaryText}
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-neutral-700 line-clamp-1">
                              Заметка: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label={`Статус для ${item.company}`}
                          value={item.applicationStatus}
                          onChange={(e) =>
                            onStatusChange(item.id, e.target.value as ApplicationStatus)
                          }
                          className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-800"
                        >
                          {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map(
                            (st) => (
                              <option key={st} value={st}>
                                {APPLICATION_STATUS_LABELS[st]}
                              </option>
                            )
                          )}
                        </select>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Перейти на сайт ${item.company}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:text-blue-700 hover:bg-neutral-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
