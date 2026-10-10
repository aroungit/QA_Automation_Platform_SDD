import React, { useEffect, useState } from 'react';
import { Archive, Shield } from 'lucide-react';
import type { PromotionRecord } from '@qaa/shared';
import { api } from '../services/api';

export const RepositoryPage: React.FC = () => {
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [automationFiles, setAutomationFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.listPromotions().catch(() => []),
      api.listAutomationFiles().catch(() => ({ files: [] })),
    ])
      .then(([promos, auto]) => {
        if (mounted) {
          setPromotions(promos);
          setAutomationFiles(auto.files);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Archive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          Repository Service &amp; Quality Gates (§3.7, §8)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Only verified automation artifacts that pass all 8 release Quality Gates are promoted to
          the main repository.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Promoted Specifications */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Promoted Specifications ({promotions.length})
          </h2>

          {loading ? (
            <div className="text-xs text-slate-400">Loading promoted specifications...</div>
          ) : promotions.length === 0 ? (
            <div className="text-xs text-slate-500">
              No specifications have been promoted yet. Pass quality gates and promote via{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                POST /api/specs/:specId/promote
              </code>
              .
            </div>
          ) : (
            <div className="space-y-2">
              {promotions.map((p) => (
                <div
                  key={p.specId}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>{p.specId}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(p.promotedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Report: {p.validationReportId}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Automation Directory Files */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-indigo-500" />
            Automation Repository Files ({automationFiles.length})
          </h2>

          {loading ? (
            <div className="text-xs text-slate-400">Loading files...</div>
          ) : automationFiles.length === 0 ? (
            <div className="text-xs text-slate-500">
              Repository is clean. Stored Playwright scripts will appear here once promoted (§3.7).
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1 font-mono text-[11px]">
              {automationFiles.map((file) => (
                <div
                  key={file}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded text-slate-700 dark:text-slate-300 truncate"
                >
                  {file}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
