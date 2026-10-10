import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import type { HealthResponse } from '@qaa/shared';
import { api } from '../../services/api';

export const Footer: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        if (mounted) {
          setHealth(data);
          setBackendOnline(true);
        }
      } catch {
        if (mounted) {
          setBackendOnline(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          {/* Mandatory Copyright */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              © 2026 Aroun AI labs
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">QA_Automation_Platform_Agent</span>
          </div>

          {/* Pillars / Architecture */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
              Spec-Driven (SDD)
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
              Playwright POM
            </span>
          </div>

          {/* Backend Health Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                backendOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
              }`}
              title={
                backendOnline
                  ? `Backend active (v${health?.version || '0.1.0'})`
                  : 'Backend unreachable'
              }
            >
              {backendOnline ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                  API Online
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                  API Disconnected
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
