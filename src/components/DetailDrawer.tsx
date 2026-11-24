import { Ban, Calendar, Check, Copy, ExternalLink, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ApplicationStatus, Internship } from '../types/internship.ts';
import { APPLICATION_STATUS_LABELS } from '../types/internship.ts';
import { formatIsoDateRu, getDeadlineMeta } from '../utils/deadline.ts';

interface DetailDrawerProps {
  item: Internship | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Internship>) => void;
  onDelete: (id: string) => void;
  onExcludeCompany: (companyName: string) => void;
  onExportSingleIcs: (item: Internship) => void;
}

export function DetailDrawer({
  item,
  onClose,
  onUpdate,
  onDelete,
  onExcludeCompany,
  onExportSingleIcs,
}: DetailDrawerProps) {
  const [deadline, setDeadline] = useState('');
  const [deadlineIsExact, setDeadlineIsExact] = useState(true);
  const [status, setStatus] = useState<ApplicationStatus>('not_applied');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    setDeadline(item.deadline || '');
    setDeadlineIsExact(item.deadlineIsExact);
    setStatus(item.applicationStatus);
    setNotes(item.notes);
    setCopied(false);
  }, [item]);

  if (!item) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors in restricted frames
    }
  };

  const meta = getDeadlineMeta(deadline || null);

  const handleSave = () => {
    onUpdate(item.id, {
      deadline: deadline.trim() ? deadline.trim() : null,
      deadlineIsExact,
      applicationStatus: status,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Детали стажировки ${item.company}`}>
      <div className="fixed inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-neutral-200 flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-neutral-500">
              {item.company} · {item.direction} · {item.sourceName}
            </div>
            <h2 className="mt-1 text-base font-semibold text-neutral-900 leading-snug">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель деталей"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <dl className="grid grid-cols-2 gap-4 text-xs border-b border-neutral-200 pb-5">
            <div>
              <dt className="text-neutral-500">Локация и формат</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {item.city} · {item.workFormat}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Вознаграждение</dt>
              <dd className="mt-1 font-mono font-medium tabular-nums text-neutral-900">
                {item.salaryText}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Статус дедлайна</dt>
              <dd
                className={`mt-1 font-medium ${
                  meta.urgency === 'urgent' || meta.urgency === 'overdue'
                    ? 'text-red-700'
                    : meta.urgency === 'soon'
                      ? 'text-amber-700'
                      : 'text-neutral-800'
                }`}
              >
                {meta.label}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Дата публикации</dt>
              <dd className="mt-1 font-mono tabular-nums text-neutral-800">
                {formatIsoDateRu(item.publishedAt)}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="text-xs font-medium text-neutral-500 mb-1.5">Требования и описание</h3>
            <p className="text-sm text-neutral-800 leading-relaxed">{item.requirements}</p>
          </div>

          <div className="space-y-4 pt-2 border-t border-neutral-200">
            <div>
              <label
                htmlFor="drawer-status"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Мой этап отбора
              </label>
              <select
                id="drawer-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
              >
                {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {APPLICATION_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label
                  htmlFor="drawer-deadline"
                  className="block text-xs font-medium text-neutral-700 mb-1.5"
                >
                  Дедлайн подачи (оставьте пустым для открытого набора)
                </label>
                <input
                  id="drawer-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <label className="inline-flex items-center gap-2 h-9 text-xs text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deadlineIsExact}
                  onChange={(e) => setDeadlineIsExact(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-blue-700"
                />
                <span>Точная дата подтверждена</span>
              </label>
            </div>

            <div>
              <label
                htmlFor="drawer-notes"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Личные заметки (ссылка на тестовое, контакты HR, темы подготовки)
              </label>
              <textarea
                id="drawer-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Например: решить контест до пятницы, подготовить резюме на русском и английском..."
                className="w-full rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Открыть оригинальную страницу</span>
              </a>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 hover:underline"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
              </button>
              {deadline && (
                <button
                  type="button"
                  onClick={() =>
                    onExportSingleIcs({
                      ...item,
                      deadline,
                      deadlineIsExact,
                      applicationStatus: status,
                      notes,
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 hover:underline"
                >
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Напоминание (.ics)</span>
                </button>
              )}
            </div>
            <div className="font-mono text-[11px] text-neutral-500 break-all">
              {item.sourceUrl}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/70">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onDelete(item.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Удалить</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExcludeCompany(item.company);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Не парсить компанию</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-on-accent bg-accent rounded-md hover:bg-accent-hover transition-colors"
            >
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
