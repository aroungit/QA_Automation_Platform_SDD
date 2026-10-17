import React, { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ValidationReport } from '@qaa/shared';

export interface ValidationFailureSummaryProps {
  report: ValidationReport | null;
  onTriggerManualHeal?: () => void;
  onNavigateToTab?: (tabIndex: number) => void;
}

export const ValidationFailureSummary: React.FC<ValidationFailureSummaryProps> = ({
  report,
  onTriggerManualHeal,
  onNavigateToTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!report) return null;

  // Check if there are failures in static, dynamic, or conformance
  const staticFailed = !report.staticValidation.passed;
  const dynamicFailed = !report.dynamicValidation.passed || report.dynamicValidation.failedCount > 0;
  const conformanceFailed = !report.conformanceCheck.passed;
  const healingAttempted = !!report.healingSummary?.attempted;
  const healingFailed = healingAttempted && !report.healingSummary?.successful;

  const hasAnyFailure =
    report.overallStatus === 'FAILED' ||
    staticFailed ||
    dynamicFailed ||
    conformanceFailed ||
    healingFailed;

  if (!hasAnyFailure) {
    return null;
  }

  // Count issues
  const tsErrorCount = report.staticValidation.typeScriptCheck.errors.length;
  const lintErrorCount = report.staticValidation.lintCheck.errors.length;
  const selectorWarningCount = report.staticValidation.selectorValidation.warnings.length;
  const failedTests = report.dynamicValidation.tests.filter((t) => t.status === 'failed');
  const missingCoverageCount = report.conformanceCheck.missing.length;
  const unmappedCount = report.conformanceCheck.unmapped.length;

  const totalFailures =
    (staticFailed ? tsErrorCount + lintErrorCount : 0) +
    report.dynamicValidation.failedCount +
    (conformanceFailed ? missingCoverageCount + unmappedCount : 0) +
    (healingFailed ? 1 : 0);

  return (
    <div
      className="border border-rose-300 dark:border-rose-900/80 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl p-4 sm:p-5 shadow-sm space-y-3 animate-fadeIn"
      role="region"
      aria-label="Validation & Healing Failure Summary"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5">
            <XCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-rose-900 dark:text-rose-100">
                Validation &amp; Healing Failure Summary
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200">
                {totalFailures} Issue{totalFailures !== 1 ? 's' : ''} Found
              </span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Automated validation pipeline detected issues. Review the breakdown below to diagnose
              and trigger auto-healing or inspect generated artifacts.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {onTriggerManualHeal && (
            <button
              type="button"
              onClick={onTriggerManualHeal}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry Self-Healing</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse failure summary' : 'Expand failure summary'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Details Body */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-rose-200 dark:border-rose-900/60 text-xs">
          {/* Failure Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Static Failures */}
            <div
              className={`p-3 rounded-lg border ${
                staticFailed
                  ? 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Static Analysis
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    staticFailed
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {staticFailed ? 'FAILED' : 'PASSED'}
                </span>
              </div>
              <ul className="space-y-1 text-[11px]">
                <li>TypeScript: {tsErrorCount} compilation error(s)</li>
                <li>ESLint: {lintErrorCount} rule violation(s)</li>
                {selectorWarningCount > 0 && (
                  <li>Brittle Locators: {selectorWarningCount} warning(s)</li>
                )}
              </ul>
              {staticFailed && onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(1)}
                  className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1"
                >
                  View Static Errors &rarr;
                </button>
              )}
            </div>

            {/* 2. Dynamic Test Failures */}
            <div
              className={`p-3 rounded-lg border ${
                dynamicFailed
                  ? 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Dynamic Playwright
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    dynamicFailed
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {dynamicFailed ? 'FAILED' : 'PASSED'}
                </span>
              </div>
              <ul className="space-y-1 text-[11px]">
                <li>Total Tests: {report.dynamicValidation.totalTests}</li>
                <li>Passed: {report.dynamicValidation.passedCount}</li>
                <li className="font-semibold text-rose-600 dark:text-rose-400">
                  Failed: {report.dynamicValidation.failedCount}
                </li>
              </ul>
              {dynamicFailed && onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(0)}
                  className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1"
                >
                  View Test Failures &rarr;
                </button>
              )}
            </div>

            {/* 3. Auto-Healing & Conformance */}
            <div
              className={`p-3 rounded-lg border ${
                conformanceFailed || healingFailed
                  ? 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Healing &amp; Conformance
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    healingFailed || conformanceFailed
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {healingFailed ? 'EXHAUSTED' : conformanceFailed ? 'UNALIGNED' : 'OK'}
                </span>
              </div>
              <ul className="space-y-1 text-[11px]">
                <li>
                  Auto-Healing:{' '}
                  {healingAttempted
                    ? `${report.healingSummary?.totalAttempts}/${report.healingSummary?.maxAttempts} attempts (${report.healingSummary?.successful ? 'Healed' : 'Failed'})`
                    : 'Not triggered'}
                </li>
                <li>Missing TCs: {missingCoverageCount}</li>
                <li>Unmapped Tests: {unmappedCount}</li>
              </ul>
              {(healingAttempted || conformanceFailed) && onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(healingAttempted ? 3 : 2)}
                  className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1"
                >
                  View Healing Details &rarr;
                </button>
              )}
            </div>
          </div>

          {/* Failed Test List with Specific Errors (if any) */}
          {failedTests.length > 0 && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900 space-y-2">
              <span className="font-bold text-rose-900 dark:text-rose-200 block">
                Failing Test Cases ({failedTests.length}):
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {failedTests.map((t) => (
                  <div
                    key={t.testCaseId}
                    className="p-2 bg-rose-50/50 dark:bg-rose-950/40 rounded border border-rose-100 dark:border-rose-900/40 text-[11px] flex items-start gap-2"
                  >
                    <Bug className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-900 dark:text-rose-100">
                          {t.testCaseId}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                          {t.title}
                        </span>
                      </div>
                      {t.error && (
                        <p className="font-mono text-rose-700 dark:text-rose-300 text-[10px] mt-1 line-clamp-2">
                          {t.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Static Analysis TypeScript errors (if any) */}
          {tsErrorCount > 0 && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900 space-y-2">
              <span className="font-bold text-rose-900 dark:text-rose-200 block">
                TypeScript Compilation Errors ({tsErrorCount}):
              </span>
              <div className="p-2 bg-slate-900 text-rose-300 rounded font-mono text-[11px] max-h-32 overflow-y-auto space-y-1">
                {report.staticValidation.typeScriptCheck.errors.slice(0, 5).map((err, idx) => (
                  <div key={idx} className="truncate">
                    {err}
                  </div>
                ))}
                {tsErrorCount > 5 && (
                  <div className="text-slate-400 italic">
                    + {tsErrorCount - 5} more compilation errors...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
