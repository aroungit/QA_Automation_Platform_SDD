import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Bot, CheckCircle2, Download, Moon, Sparkles, Sun, X } from 'lucide-react';
import type { LLMProviderName } from '@qaa/shared';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLLM } from '../../providers/LLMContext';
import { useTheme } from '../../theme/ThemeContext';
import { NAV_ITEMS } from './Navigation';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { providers, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } =
    useLLM();
  const { isInstallable, isStandalone, promptInstall } = usePWAInstall();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const activeProvider = providers.find((p) => p.name === selectedProvider);

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div
      className="fixed inset-0 z-50 md:hidden flex"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-xs bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between p-5 z-10 overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="QAA Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                QA Automation Agent
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="py-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              Navigation
            </span>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <div>
                    <div>{item.name}</div>
                    {item.description && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                        {item.description}
                      </div>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>

          {/* PWA Install Action if available */}
          {isInstallable && (
            <div className="pt-2 pb-3">
              <button
                type="button"
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Install App (PWA)
              </button>
            </div>
          )}

          {isStandalone && (
            <div className="pt-2 pb-2">
              <div className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Running as Installed PWA
              </div>
            </div>
          )}

          {/* LLM Provider Configuration */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              LLM Provider
            </span>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                <label
                  htmlFor="mobile-llm-provider"
                  className="text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Active Provider:
                </label>
              </div>

              <select
                id="mobile-llm-provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as LLMProviderName)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded-md p-1.5 text-slate-800 dark:text-slate-200"
              >
                {providers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName} {!p.configured ? '(demo)' : ''}
                  </option>
                ))}
              </select>

              {activeProvider && activeProvider.models.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                    <label
                      htmlFor="mobile-llm-model"
                      className="text-[11px] font-medium text-slate-600 dark:text-slate-400"
                    >
                      Model:
                    </label>
                  </div>
                  <select
                    id="mobile-llm-model"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded-md p-1.5 text-slate-800 dark:text-slate-200 truncate"
                  >
                    {activeProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer / Theme Toggle */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2">
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
              )}
              <span>Theme</span>
            </span>
            <span className="capitalize text-slate-400">{resolvedTheme}</span>
          </button>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3">
            © 2026 Aroun AI labs
          </div>
        </div>
      </div>
    </div>
  );
};
