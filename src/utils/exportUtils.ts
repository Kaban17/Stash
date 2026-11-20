import type { Internship } from '../types/internship.ts';
import { APPLICATION_STATUS_LABELS } from '../types/internship.ts';
import { formatIsoDateRu } from './deadline.ts';

function escapeCsvCell(value: string): string {
  const str = value ?? '';
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsvContent(items: Internship[]): string {
  const headers = [
    'Компания',
    'Название стажировки',
    'Направление',
    'Дедлайн',
    'Тип срока',
    'Город',
    'Формат',
    'Оплата',
    'Мой статус',
    'Источник',
    'Ссылка',
    'Заметки',
  ];

  const rows = items.map((item) => [
    item.company,
    item.title,
    item.direction,
    formatIsoDateRu(item.deadline),
    item.deadline ? (item.deadlineIsExact ? 'Точный' : 'Расчётный') : 'Открытый набор',
    item.city,
    item.workFormat,
    item.salaryText,
    APPLICATION_STATUS_LABELS[item.applicationStatus],
    item.sourceName,
    item.sourceUrl,
    item.notes,
  ]);

  const csvBody = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(';'))
    .join('\r\n');

  // UTF-8 BOM for clean opening in Russian Excel
  return `\uFEFF${csvBody}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsDateCompact(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

export function generateIcsContent(items: Internship[]): string {
  const withDeadlines = items.filter((item) => Boolean(item.deadline));
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

  const events = withDeadlines.map((item) => {
    const dateCompact = toIcsDateCompact(item.deadline!);
    const summary = `Дедлайн: ${item.company} — ${item.title}`;
    const descParts = [
      `Направление: ${item.direction}`,
      `Формат: ${item.workFormat} (${item.city})`,
      `Оплата: ${item.salaryText}`,
      `Статус: ${APPLICATION_STATUS_LABELS[item.applicationStatus]}`,
      `Ссылка: ${item.sourceUrl}`,
      item.notes ? `Заметки: ${item.notes}` : '',
    ].filter(Boolean);

    return [
      'BEGIN:VEVENT',
      `UID:${item.id}@stazhtrek.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dateCompact}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
      `URL:${item.sourceUrl}`,
      'BEGIN:VALARM',
      'TRIGGER:-P2D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Через 2 дня дедлайн: ${item.company}`)}`,
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StazhTrek//RF Internship Deadlines//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
