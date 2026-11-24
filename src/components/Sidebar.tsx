import { Building2, CalendarClock, Globe, Table2, X } from 'lucide-react';
import { GLOBAL_BACKEND_ML_COMPANIES } from '../data/globalCompanyDirectory.ts';
import { RF_BACKEND_ML_COMPANIES } from '../data/rfCompanyDirectory.ts';
import type { Internship } from '../types/internship.ts';

export type ActiveView = 'table' | 'calendar' | 'companies' | 'sources';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  internships: Internship[];
  selectedCompany: string;
  onSelectCompany: (company: string) => void;
  urgentCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeView,
  onSelectView,
  internships,
  selectedCompany,
  onSelectCompany,
  urgentCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const companyCounts = new Map<string, number>();
  for (const item of internships) {
    companyCounts.set(item.company, (companyCounts.get(item.company) || 0) + 1);
  }
  const sortedCompanies = Array.from(companyCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')
  );

  const navItems: Array<{ id: ActiveView; label: string; icon: typeof Table2; meta?: string }> = [
    {
      id: 'table',
      label: 'Таблица дедлайнов',
      icon: Table2,
      meta: String(internships.length),
    },
    {
      id: 'calendar',
      label: 'Календарь сроков',
      icon: CalendarClock,
      meta: urgentCount > 0 ? String(urgentCount) : undefined,
    },
    {
      id: 'companies',
      label: 'База компаний',
      icon: Building2,
      meta: String(RF_BACKEND_ML_COMPANIES.length + GLOBAL_BACKEND_ML_COMPANIES.length),
    },
    {
      id: 'sources',
      label: 'Источники парсинга',
      icon: Globe,
    },
  ];

  const handleNavClick = (view: ActiveView) => {
    onSelectView(view);
    onCloseMobile();
  };

  const handleCompanyClick = (company: string) => {
    onSelectCompany(company);
    if (activeView === 'sources' || activeView === 'companies') {
      onSelectView('table');
    }
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-neutral-200">
      <div className="flex h-14 items-center justify-between px-5 border-b border-neutral-200 shrink-0">
        <span className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight text-neutral-900 whitespace-nowrap">
          СтажТрек
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Закрыть меню навигации"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Разделы приложения" className="px-3 py-4 border-b border-neutral-200">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={
                    item.id === 'calendar' && urgentCount > 0
                      ? `Календарь сроков (${urgentCount} горящих)`
                      : item.label
                  }
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                    isActive
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-blue-700' : 'text-neutral-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.meta && (
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 ${
                        item.id === 'calendar' && urgentCount > 0
                          ? 'text-red-700 font-semibold'
                          : 'text-neutral-500'
                      }`}
                    >
                      {item.meta}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-3 mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium text-neutral-500">Компании в таблице</h2>
          {selectedCompany !== 'all' && (
            <button
              type="button"
              onClick={() => handleCompanyClick('all')}
              className="text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Сбросить
            </button>
          )}
        </div>
        <ul className="space-y-0.5" aria-label="Фильтр по компаниям">
          <li>
            <button
              type="button"
              onClick={() => handleCompanyClick('all')}
              className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${
                selectedCompany === 'all'
                  ? 'bg-neutral-100 font-medium text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <span className="truncate">Все компании</span>
              <span className="font-mono text-xs tabular-nums text-neutral-500">
                {internships.length}
              </span>
            </button>
          </li>
          {sortedCompanies.map(([company, count]) => {
            const active = selectedCompany === company;
            return (
              <li key={company}>
                <button
                  type="button"
                  onClick={() => handleCompanyClick(company)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    active
                      ? 'bg-neutral-100 font-medium text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <span className="truncate pr-2">{company}</span>
                  <span className="font-mono text-xs tabular-nums text-neutral-500 shrink-0">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-5 py-3.5 border-t border-neutral-200 text-xs text-neutral-500">
        Данные хранятся локально в браузере и обновляются через серверный парсер.
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/45"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
