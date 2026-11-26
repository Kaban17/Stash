import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../utils/preferences.ts';

interface ThemeSwitcherProps {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  ariaLabel: string;
  title: string;
  icon: typeof Sun;
}> = [
  {
    mode: 'light',
    label: 'Светлая',
    ariaLabel: 'Светлая тема',
    title: 'Светлая тема',
    icon: Sun,
  },
  {
    mode: 'dark',
    label: 'Тёмная',
    ariaLabel: 'Тёмная тема',
    title: 'Тёмная тема',
    icon: Moon,
  },
  {
    mode: 'auto',
    label: 'Авто',
    ariaLabel: 'Автоматическая тема (как в системе)',
    title: 'Автоматически (как в системе)',
    icon: Monitor,
  },
];

export function ThemeSwitcher({ value, onChange }: ThemeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Тема оформления"
      className="inline-flex items-center gap-0.5 p-0.5 segment-track rounded-md shrink-0"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            aria-pressed={active}
            aria-label={option.ariaLabel}
            title={option.title}
            className={`inline-flex items-center justify-center gap-1.5 h-7 px-2 md:px-2.5 text-xs font-medium rounded transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              active
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
