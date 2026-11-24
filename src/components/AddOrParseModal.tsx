import { Globe, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { detectGrade } from '../parser/extractors.ts';
import type { Direction, Internship, WorkFormat } from '../types/internship.ts';
import { DIRECTION_OPTIONS, WORK_FORMAT_OPTIONS } from '../types/internship.ts';

interface AddOrParseModalProps {
  open: boolean;
  initialTab: 'parse' | 'manual';
  onClose: () => void;
  onAddInternship: (item: Internship) => void;
}

interface ManualFormErrors {
  company?: string;
  title?: string;
  sourceUrl?: string;
}

export function AddOrParseModal({
  open,
  initialTab,
  onClose,
  onAddInternship,
}: AddOrParseModalProps) {
  const [tab, setTab] = useState<'parse' | 'manual'>(initialTab);

  // URL / HTML parser tab state
  const [parseMode, setParseMode] = useState<'url' | 'html'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Internship | null>(null);

  // Manual form state
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<Direction>('Backend');
  const [city, setCity] = useState('Москва');
  const [workFormat, setWorkFormat] = useState<WorkFormat>('Гибрид');
  const [deadline, setDeadline] = useState('');
  const [salaryText, setSalaryText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ManualFormErrors>({});

  if (!open) return null;

  const resetAndClose = () => {
    setParseError(null);
    setParsedPreview(null);
    setErrors({});
    onClose();
  };

  const handleRunCustomParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setParseError(null);
    setParsedPreview(null);

    if (parseMode === 'url' && !urlInput.trim()) {
      setParseError('Введите ссылку на страницу стажировки (например, с hh.ru или сайта компании).');
      return;
    }
    if (parseMode === 'html' && htmlInput.trim().length < 15) {
      setParseError('Вставьте текст или HTML-фрагмент вакансии (минимум 15 символов).');
      return;
    }

    setParseLoading(true);
    try {
      const endpoint = parseMode === 'url' ? '/api/parse-url' : '/api/parse-html';
      const payload =
        parseMode === 'url'
          ? { url: urlInput.trim() }
          : { html: htmlInput.trim(), url: urlInput.trim() || 'https://career.ru/internship' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { item?: Internship; error?: string };
      if (!res.ok || !data.item) {
        setParseError(data.error || 'Не удалось распознать данные со страницы.');
      } else {
        setParsedPreview(data.item);
      }
    } catch {
      setParseError('Ошибка соединения с сервером парсера.');
    } finally {
      setParseLoading(false);
    }
  };

  const handleConfirmParsed = () => {
    if (!parsedPreview) return;
    onAddInternship(parsedPreview);
    setUrlInput('');
    setHtmlInput('');
    setParsedPreview(null);
    resetAndClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: ManualFormErrors = {};

    if (!company.trim()) {
      nextErrors.company = 'Укажите название компании.';
    }
    if (!title.trim()) {
      nextErrors.title = 'Укажите название программы или роли.';
    }
    if (sourceUrl.trim() && !/^https?:\/\/.+/i.test(sourceUrl.trim())) {
      nextErrors.sourceUrl = 'Ссылка должна начинаться с http:// или https://';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date();
    const cleanSalary = salaryText.trim();
    const salaryNumMatch = cleanSalary.match(/\d[\d\s]*/);
    const salaryFrom = salaryNumMatch
      ? Number(salaryNumMatch[0].replace(/\s+/g, ''))
      : null;

    const created: Internship = {
      id: `manual-${Date.now()}`,
      externalId: `manual-${Date.now()}`,
      company: company.trim(),
      title: title.trim(),
      direction,
      grade: detectGrade(title.trim(), 'intern'),
      city: city.trim() || 'Россия',
      workFormat,
      salaryText: cleanSalary || 'По итогам',
      salaryFrom: Number.isNaN(salaryFrom) ? null : salaryFrom,
      salaryTo: null,
      deadline: deadline.trim() || null,
      deadlineIsExact: Boolean(deadline.trim()),
      publishedAt: now.toISOString().slice(0, 10),
      sourceUrl: sourceUrl.trim() || 'https://hh.ru',
      sourceName: 'Добавлено вручную',
      sourceType: 'manual',
      requirements: 'Добавлено пользователем вручную.',
      applicationStatus: 'planned',
      notes: notes.trim(),
      isStarred: false,
      parsedAt: now.toISOString(),
      addedAt: now.toISOString(),
    };

    onAddInternship(created);
    setCompany('');
    setTitle('');
    setDeadline('');
    setSalaryText('');
    setSourceUrl('');
    setNotes('');
    setErrors({});
    resetAndClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Добавить или распарсить стажировку"
    >
      <div
        className="fixed inset-0 bg-black/45"
        onClick={resetAndClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Добавить стажировку</h2>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Закрыть окно добавления"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 segment-track rounded-md" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'parse'}
              onClick={() => setTab('parse')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === 'parse'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Парсить URL / текст</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'manual'}
              onClick={() => setTab('manual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === 'manual'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Заполнить вручную</span>
            </button>
          </div>
        </div>

        {tab === 'parse' ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-neutral-800">
                <input
                  type="radio"
                  name="parseMode"
                  checked={parseMode === 'url'}
                  onChange={() => setParseMode('url')}
                />
                <span>По ссылке (URL)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-neutral-800">
                <input
                  type="radio"
                  name="parseMode"
                  checked={parseMode === 'html'}
                  onChange={() => setParseMode('html')}
                />
                <span>Из текста или HTML вакансии</span>
              </label>
            </div>

            <form onSubmit={handleRunCustomParse} className="space-y-3">
              {parseMode === 'url' ? (
                <div>
                  <label htmlFor="parse-url-input" className="block text-xs font-medium text-neutral-700 mb-1">
                    Ссылка на стажировку (hh.ru, Хабр Карьера, сайт компании)
                  </label>
                  <input
                    id="parse-url-input"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://hh.ru/vacancy/12345678 или https://yandex.ru/yaintern"
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="parse-html-input" className="block text-xs font-medium text-neutral-700 mb-1">
                    Вставьте текст объявления (например, из Telegram-канала или карьерной страницы)
                  </label>
                  <textarea
                    id="parse-html-input"
                    rows={4}
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    placeholder="Например: Стажировка в Т-Банк по Backend (Go/Python). Удалённо, оплата от 85 000 ₽. Приём заявок до 12 декабря 2026."
                    className="w-full rounded-md border border-neutral-300 p-3 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              {parseError && (
                <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {parseError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={parseLoading}
                  className="px-4 py-2 text-xs font-medium text-on-accent bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {parseLoading ? 'Извлекаем данные...' : 'Распарсить'}
                </button>
              </div>
            </form>

            {parsedPreview && (
              <div className="border border-neutral-200 rounded-md p-4 bg-neutral-50/70 space-y-3">
                <div className="text-xs font-medium text-emerald-700">
                  Данные извлечены — проверьте перед добавлением в таблицу:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="preview-company" className="block text-neutral-500 mb-1">
                      Компания
                    </label>
                    <input
                      id="preview-company"
                      type="text"
                      value={parsedPreview.company}
                      onChange={(e) =>
                        setParsedPreview({ ...parsedPreview, company: e.target.value })
                      }
                      className="w-full h-8 rounded border border-neutral-300 bg-white px-2.5 text-neutral-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="preview-deadline" className="block text-neutral-500 mb-1">
                      Дедлайн
                    </label>
                    <input
                      id="preview-deadline"
                      type="date"
                      value={parsedPreview.deadline || ''}
                      onChange={(e) =>
                        setParsedPreview({
                          ...parsedPreview,
                          deadline: e.target.value || null,
                          deadlineIsExact: Boolean(e.target.value),
                        })
                      }
                      className="w-full h-8 rounded border border-neutral-300 bg-white px-2.5 font-mono text-neutral-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="preview-title" className="block text-neutral-500 mb-1">
                      Название
                    </label>
                    <input
                      id="preview-title"
                      type="text"
                      value={parsedPreview.title}
                      onChange={(e) =>
                        setParsedPreview({ ...parsedPreview, title: e.target.value })
                      }
                      className="w-full h-8 rounded border border-neutral-300 bg-white px-2.5 text-neutral-900"
                    />
                  </div>
                </div>
                <div className="text-xs text-neutral-600">
                  Направление: <strong className="text-neutral-900">{parsedPreview.direction}</strong> ·{' '}
                  Формат: <strong className="text-neutral-900">{parsedPreview.workFormat}</strong> ·{' '}
                  Оплата: <strong className="font-mono text-neutral-900">{parsedPreview.salaryText}</strong>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleConfirmParsed}
                    className="px-4 py-2 text-xs font-medium text-on-accent bg-emerald-solid rounded-md hover:bg-emerald-solid-hover transition-colors"
                  >
                    Добавить в таблицу
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} noValidate className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="manual-company" className="block text-xs font-medium text-neutral-700 mb-1">
                  Компания *
                </label>
                <input
                  id="manual-company"
                  type="text"
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    if (errors.company) setErrors({ ...errors, company: undefined });
                  }}
                  placeholder="Например: Яндекс, Ozon, Циан"
                  className={`w-full h-9 rounded-md border px-3 text-sm text-neutral-900 focus:outline-none ${
                    errors.company ? 'border-red-500' : 'border-neutral-300 focus:border-blue-600'
                  }`}
                />
                {errors.company && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    {errors.company}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="manual-direction" className="block text-xs font-medium text-neutral-700 mb-1">
                  Направление
                </label>
                <select
                  id="manual-direction"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as Direction)}
                  className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                >
                  {DIRECTION_OPTIONS.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="manual-title" className="block text-xs font-medium text-neutral-700 mb-1">
                Название программы / роли *
              </label>
              <input
                id="manual-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                placeholder="Например: Стажёр Backend-разработчик (Go / PostgreSQL)"
                className={`w-full h-9 rounded-md border px-3 text-sm text-neutral-900 focus:outline-none ${
                  errors.title ? 'border-red-500' : 'border-neutral-300 focus:border-blue-600'
                }`}
              />
              {errors.title && (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  {errors.title}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="manual-deadline" className="block text-xs font-medium text-neutral-700 mb-1">
                  Дедлайн
                </label>
                <input
                  id="manual-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-300 px-2.5 font-mono text-sm text-neutral-900"
                />
              </div>

              <div>
                <label htmlFor="manual-format" className="block text-xs font-medium text-neutral-700 mb-1">
                  Формат
                </label>
                <select
                  id="manual-format"
                  value={workFormat}
                  onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}
                  className="w-full h-9 rounded-md border border-neutral-300 bg-white px-2.5 text-sm text-neutral-900"
                >
                  {WORK_FORMAT_OPTIONS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manual-city" className="block text-xs font-medium text-neutral-700 mb-1">
                  Город
                </label>
                <input
                  id="manual-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-300 px-2.5 text-sm text-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="manual-salary" className="block text-xs font-medium text-neutral-700 mb-1">
                  Оплата
                </label>
                <input
                  id="manual-salary"
                  type="text"
                  value={salaryText}
                  onChange={(e) => setSalaryText(e.target.value)}
                  placeholder="Например: 80 000 ₽"
                  className="w-full h-9 rounded-md border border-neutral-300 px-3 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label htmlFor="manual-url" className="block text-xs font-medium text-neutral-700 mb-1">
                  Ссылка на подачу
                </label>
                <input
                  id="manual-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    if (errors.sourceUrl) setErrors({ ...errors, sourceUrl: undefined });
                  }}
                  placeholder="https://..."
                  className={`w-full h-9 rounded-md border px-3 text-sm text-neutral-900 ${
                    errors.sourceUrl ? 'border-red-500' : 'border-neutral-300'
                  }`}
                />
                {errors.sourceUrl && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    {errors.sourceUrl}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="manual-notes" className="block text-xs font-medium text-neutral-700 mb-1">
                Заметки
              </label>
              <input
                id="manual-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Что нужно подготовить к отбору"
                className="w-full h-9 rounded-md border border-neutral-300 px-3 text-sm text-neutral-900"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-on-accent bg-accent rounded-md hover:bg-accent-hover transition-colors"
              >
                Сохранить в таблицу
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
