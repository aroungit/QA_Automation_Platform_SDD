import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, ChevronDown, Download, Info, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import type { LLMProviderName } from '@qaa/shared';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLLM } from '../../providers/LLMContext';
import { useTheme } from '../../theme/ThemeContext';

interface HeaderProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ mobileMenuOpen, onToggleMobileMenu }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { providers, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } =
    useLLM();
  const { isInstallable, isStandalone, isIOS, promptInstall } = usePWAInstall();
  const [showIosTip, setShowIosTip] = useState(false);

  const activeProviderInfo = providers.find((p) => p.name === selectedProvider);

  const handleInstallClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else if (isIOS && !isStandalone) {
      setShowIosTip(true);
      setTimeout(() => setShowIosTip(false), 6000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1 min-w-0"
            aria-label="QA Automation Platform Agent Home"
          >
            <img
              src="/logo.svg"
              alt="QAA Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain transition-transform group-hover:scale-105 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <span className="hidden sm:inline">QA_Automation_Platform_Agent</span>
                <span className="sm:hidden">QAA Platform</span>
              </span>
              <span className="hidden sm:inline text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                Spec-Driven QA Automation
              </span>
            </div>
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* PWA Install Button (Chromium prompt or iOS helper) */}
          {(isInstallable || (isIOS && !isStandalone)) && (
            <div className="relative">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                title="Install QA Automation Platform as Progressive Web App"
                aria-label="Install App"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">Install App</span>
              </button>

              {/* iOS Safari instructions tooltip */}
              {showIosTip && (
                <div
                  role="tooltip"
                  className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700 z-50 animate-fadeIn"
                >
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-200">Install on iOS Safari:</p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Tap the <strong>Share</strong> icon in Safari, then select{' '}
                        <strong>Add to Home Screen</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LLM Provider Selector (Dropdown) */}
          <div className="relative flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 border border-slate-200 dark:border-slate-700/60 text-xs sm:text-sm">
            <Bot
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-1.5 text-indigo-500 dark:text-indigo-400 shrink-0"
              aria-hidden="true"
            />

            {/* Provider Select */}
            <label htmlFor="llm-provider-select" className="sr-only">
              Select LLM Provider
            </label>
            <select
              id="llm-provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as LLMProviderName)}
              className="bg-transparent font-medium text-slate-800 dark:text-slate-100 px-1.5 sm:px-2 py-1 pr-5 sm:pr-6 rounded focus:outline-none cursor-pointer appearance-none text-xs sm:text-sm max-w-[110px] sm:max-w-none truncate"
              title="Active LLM Provider"
            >
              {providers.map((p) => (
                <option
                  key={p.name}
                  value={p.name}
                  className="dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {p.displayName} {!p.configured ? '(demo)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 -ml-4 sm:-ml-5 pointer-events-none text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />

            {/* Model Sub-Select */}
            {activeProviderInfo && activeProviderInfo.models.length > 0 && (
              <div className="hidden lg:flex items-center border-l border-slate-200 dark:border-slate-700 ml-1 pl-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" aria-hidden="true" />
                <label htmlFor="llm-model-select" className="sr-only">
                  Select Model
                </label>
                <select
                  id="llm-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-transparent text-xs text-slate-600 dark:text-slate-300 px-2 py-1 pr-5 rounded focus:outline-none cursor-pointer appearance-none truncate max-w-[170px]"
                  title="Active LLM Model"
                >
                  {activeProviderInfo.models.map((m) => (
                    <option
                      key={m}
                      value={m}
                      className="dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="w-3 h-3 -ml-4 pointer-events-none text-slate-400"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
            )}
          </button>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
