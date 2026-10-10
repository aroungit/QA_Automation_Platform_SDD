import React from 'react';
import { NavLink } from 'react-router-dom';
import { Archive, CheckCircle2, FileCheck2, FileText, Home, PlusCircle } from 'lucide-react';

export interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: Home,
    description: 'Overview & system status',
  },
  {
    name: 'Specifications',
    path: '/specs',
    icon: FileText,
    description: 'All specs and test cases',
  },
  {
    name: 'New Story Intake',
    path: '/intake',
    icon: PlusCircle,
    description: 'Submit user story for spec generation',
  },
  {
    name: 'Approval Gate',
    path: '/approval',
    icon: FileCheck2,
    description: 'Review and approve candidate test cases',
  },
  {
    name: 'Validation & Healing',
    path: '/validation',
    icon: CheckCircle2,
    description: 'Static, dynamic & auto-healing reports',
  },
  {
    name: 'Repository & Gates',
    path: '/repository',
    icon: Archive,
    description: 'Quality gates & promoted artifacts',
  },
];

export const Navigation: React.FC = () => {
  return (
    <nav className="hidden md:flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto w-full flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
