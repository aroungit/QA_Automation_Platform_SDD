import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  FileCheck2,
  FileCode,
  Image,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { ValidationReport } from '@qaa/shared';

export interface ValidationReportViewProps {
  report: ValidationReport;
  pastReports?: ValidationReport[];
  onSelectPastReport?: (reportId: string) => void;
  onOpenQualityGateModal?: () => void;
  onTriggerManualHeal?: () => void;
  initialTab?: number;
}

export const ValidationReportView: React.FC<ValidationReportViewProps> = ({
  report,
  pastReports = [],
  onSelectPastReport,
  onOpenQualityGateModal,
  onTriggerManualHeal,
  initialTab = 0,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleTestExpanded = (id: string) => {
    setExpandedTestIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: ValidationReport['overallStatus']) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASSED
          </span>
        );
      case 'HEALED_PASSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
            <Sparkles className="w-3.5 h-3.5" />
            HEALED &amp; PASSED
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
    }
  };

  const tabs = [
    {
      id: 0,
      label: 'Dynamic Tests',
      icon: Cpu,
      badge: `${report.dynamicValidation.passedCount}/${report.dynamicValidation.totalTests}`,
      badgeColor: report.dynamicValidation.passed
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    },
    {
      id: 1,
      label: 'Static Analysis',
      icon: Code2,
      badge: report.staticValidation.passed ? 'Clean' : 'Issues',
      badgeColor: report.staticValidation.passed
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    },
    {
      id: 2,
      label: 'Spec Conformance',
      icon: FileCheck2,
      badge: `${report.conformanceCheck.covered.length}/${report.conformanceCheck.approvedTestCaseIds.length}`,
      badgeColor: report.conformanceCheck.passed
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    },
    {
      id: 3,
      label: 'Auto-Healing',
      icon: Sparkles,
      badge: report.healingSummary?.attempted
        ? `${report.healingSummary.totalAttempts} attempts`
        : 'Not Needed',
      badgeColor: report.healingSummary?.attempted
        ? report.healingSummary.successful
          ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn space-y-0">
      {/* Report Header Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
              {report.reportId}
            </span>
            <span>•</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {report.specId}
            </span>
            <span>•</span>
            <span className="text-xs font-mono text-slate-400">
              {new Date(report.timestamp).toLocaleString()}
            </span>
            <span>•</span>
            <span className="text-xs font-mono uppercase bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
              {report.platform}
            </span>
            <span className="text-xs font-mono uppercase bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
              {report.metadata.executionMode ?? 'real'} mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(report.overallStatus)}

            {report.eligibleForPromotion ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Eligible for Promotion (§3.7, §8)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-4 h-4" />
                Promotion Blocked (Quality Gate Not Satisfied)
              </span>
            )}
          </div>
        </div>

        {/* Action button & past reports dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {pastReports.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 hidden sm:inline">Report:</span>
              <select
                value={report.reportId}
                onChange={(e) => onSelectPastReport?.(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {pastReports.map((r) => (
                  <option key={r.reportId} value={r.reportId}>
                    {r.reportId === report.reportId ? `★ ` : ''}
                    {r.overallStatus} — {new Date(r.timestamp).toLocaleTimeString()} (
                    {r.metadata.executionMode ?? 'real'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {report.overallStatus === 'FAILED' && onTriggerManualHeal && (
            <button
              type="button"
              onClick={onTriggerManualHeal}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Self-Heal Failures (§3.6)</span>
            </button>
          )}

          {report.eligibleForPromotion && onOpenQualityGateModal && (
            <button
              type="button"
              onClick={onOpenQualityGateModal}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evaluate Quality Gates &amp; Promote (§8)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 bg-white dark:bg-slate-900 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap focus:outline-none ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${tab.badgeColor}`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* ==================================================== */}
        {/* TAB 0: Dynamic Test Execution                        */}
        {/* ==================================================== */}
        {activeTab === 0 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-400 font-medium block">Total Tests</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {report.dynamicValidation.totalTests}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium block">
                  Passed
                </span>
                <span className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                  {report.dynamicValidation.passedCount}
                </span>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800/50">
                <span className="text-rose-700 dark:text-rose-300 font-medium block">
                  Failed
                </span>
                <span className="text-base font-bold text-rose-800 dark:text-rose-200">
                  {report.dynamicValidation.failedCount}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-400 font-medium block">Total Duration</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {report.dynamicValidation.durationMs}ms
                </span>
              </div>
            </div>

            {/* Error Message if suite failed */}
            {report.dynamicValidation.error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <span className="font-semibold">Test Runner Execution Error:</span>
                  <p className="font-mono mt-1 text-[11px] whitespace-pre-wrap">
                    {report.dynamicValidation.error}
                  </p>
                </div>
              </div>
            )}

            {/* Test Cases List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Executed Test Cases ({report.dynamicValidation.tests.length})
              </h3>

              {report.dynamicValidation.tests.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  No individual test case results captured.
                </div>
              ) : (
                report.dynamicValidation.tests.map((test, idx) => {
                  const isExpanded = !!expandedTestIds[`test-${idx}-${test.testCaseId}`];
                  const testKey = `test-${idx}-${test.testCaseId}`;
                  const isPassed = test.status === 'passed';

                  return (
                    <div
                      key={testKey}
                      className={`border rounded-xl transition-all ${
                        isPassed
                          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80'
                          : 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTestExpanded(testKey)}
                        className="w-full p-3.5 flex items-start justify-between gap-3 text-left focus:outline-none"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {isPassed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                {test.testCaseId}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                  isPassed
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                }`}
                              >
                                {test.status}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {test.durationMs}ms
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                              {test.title}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {test.screenshotUrl && (
                            <span
                              className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                              title="Screenshot captured"
                            >
                              <Image className="w-3 h-3" />
                              <span className="hidden sm:inline">Screenshot</span>
                            </span>
                          )}
                          {test.traceUrl && (
                            <span
                              className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1"
                              title="Playwright trace captured"
                            >
                              <Layers className="w-3 h-3" />
                              <span className="hidden sm:inline">Trace</span>
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs space-y-3">
                          {/* Error / Stack Trace */}
                          {test.error && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 font-semibold">
                                <span className="flex items-center gap-1">
                                  <Bug className="w-3.5 h-3.5" />
                                  Assertion / Runtime Error:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(test.stack || test.error || '', `err-${testKey}`)
                                  }
                                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{copiedKey === `err-${testKey}` ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="p-3 bg-slate-900 text-rose-300 rounded-lg text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                                {test.stack || test.error}
                              </pre>
                            </div>
                          )}

                          {/* Artifacts Links */}
                          {(test.screenshotUrl || test.traceUrl) && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex flex-wrap items-center gap-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Artifacts:
                              </span>
                              {test.screenshotUrl && (
                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                  <Image className="w-3 h-3" />
                                  {test.screenshotUrl}
                                </span>
                              )}
                              {test.traceUrl && (
                                <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                  <Layers className="w-3 h-3" />
                                  {test.traceUrl}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Console Logs */}
                          {test.consoleLogs && test.consoleLogs.length > 0 && (
                            <div className="space-y-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <Terminal className="w-3.5 h-3.5" />
                                Console Output &amp; Step Logs:
                              </span>
                              <div className="bg-slate-950 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] space-y-0.5 max-h-40 overflow-y-auto">
                                {test.consoleLogs.map((log, lIdx) => (
                                  <div
                                    key={lIdx}
                                    className={
                                      log.includes('[error]')
                                        ? 'text-rose-400'
                                        : log.includes('[warn]')
                                          ? 'text-amber-400'
                                          : 'text-slate-300'
                                    }
                                  >
                                    {log}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: Static Code Quality & Analysis                */}
        {/* ==================================================== */}
        {activeTab === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TypeScript Compilation */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-500" />
                    TypeScript Compilation (tsc --noEmit)
                  </h4>
                  {report.staticValidation.typeScriptCheck.passed ? (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full">
                      Passed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-full">
                      Errors Found
                    </span>
                  )}
                </div>
                {report.staticValidation.typeScriptCheck.errors.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    TypeScript compilation succeeded with zero type errors. All Page Objects and
                    test files are strongly typed.
                  </p>
                ) : (
                  <div className="p-2.5 bg-slate-900 text-rose-300 rounded-lg text-[11px] font-mono space-y-1 max-h-48 overflow-y-auto">
                    {report.staticValidation.typeScriptCheck.errors.map((e, idx) => (
                      <div key={idx}>{e}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* ESLint Check */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ESLint Static Rule Check
                  </h4>
                  {report.staticValidation.lintCheck.passed ? (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full">
                      Passed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-full">
                      Errors Found
                    </span>
                  )}
                </div>
                {report.staticValidation.lintCheck.errors.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No ESLint errors or lint violations detected.
                  </p>
                ) : (
                  <div className="p-2.5 bg-slate-900 text-rose-300 rounded-lg text-[11px] font-mono space-y-1 max-h-48 overflow-y-auto">
                    {report.staticValidation.lintCheck.errors.map((e, idx) => (
                      <div key={idx}>{e}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Playwright Selector Validation */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-500" />
                    Selector Stability &amp; Locator Analysis (§3.5, §3.6)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ensures resilient user-facing locators (e.g. getByRole, getByPlaceholder)
                    instead of brittle absolute XPaths or deep CSS chains.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 rounded-full">
                  {report.staticValidation.selectorValidation.validCount} Locators
                </span>
              </div>

              {/* Warnings */}
              {report.staticValidation.selectorValidation.warnings.length > 0 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Brittle Locator Warnings:
                  </span>
                  <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5">
                    {report.staticValidation.selectorValidation.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Locators Found */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Verified Stable Locators Discovered:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px] max-h-48 overflow-y-auto">
                  {report.staticValidation.selectorValidation.locatorsFound.map((loc, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 truncate"
                    >
                      {loc}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Import Validation */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-indigo-500" />
                  Module Import Verification (§3.6)
                </h4>
                {report.staticValidation.importValidation.passed ? (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full">
                    All Imports Valid
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-full">
                    Invalid Imports
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified that only safe local modules and allowed framework packages (@playwright/test)
                are imported.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px] max-h-40 overflow-y-auto">
                {report.staticValidation.importValidation.imports.map((imp, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 truncate"
                  >
                    {imp}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: Specification Conformance Check               */}
        {/* ==================================================== */}
        {activeTab === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Status overview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-500" />
                    100% Traceability &amp; Coverage Assurance (§3.6.3)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Validates that every approved test case was automated and executed, and checks
                    that no unapproved tests exist.
                  </p>
                </div>
                {report.conformanceCheck.passed ? (
                  <span className="px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full">
                    100% Conforming
                  </span>
                ) : (
                  <span className="px-3 py-1 text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-full">
                    Non-Conforming
                  </span>
                )}
              </div>

              {/* Coverage Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Approved Test Cases Coverage</span>
                  <span className="font-mono font-bold">
                    {report.conformanceCheck.covered.length} /{' '}
                    {report.conformanceCheck.approvedTestCaseIds.length} (
                    {report.conformanceCheck.approvedTestCaseIds.length > 0
                      ? Math.round(
                          (report.conformanceCheck.covered.length /
                            report.conformanceCheck.approvedTestCaseIds.length) *
                            100,
                        )
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      report.conformanceCheck.passed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${
                        report.conformanceCheck.approvedTestCaseIds.length > 0
                          ? Math.round(
                              (report.conformanceCheck.covered.length /
                                report.conformanceCheck.approvedTestCaseIds.length) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Chips breakdown: Covered / Missing / Unmapped */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Covered &amp; Verified ({report.conformanceCheck.covered.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {report.conformanceCheck.covered.map((id) => (
                    <span
                      key={id}
                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  Missing Coverage ({report.conformanceCheck.missing.length})
                </span>
                {report.conformanceCheck.missing.length === 0 ? (
                  <p className="text-[11px] text-slate-400">All approved test cases covered.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.conformanceCheck.missing.map((id) => (
                      <span
                        key={id}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unmapped Tests ({report.conformanceCheck.unmapped.length})
                </span>
                {report.conformanceCheck.unmapped.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No rogue or unapproved tests.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.conformanceCheck.unmapped.map((id) => (
                      <span
                        key={id}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Conformance Check Details */}
            {report.conformanceCheck.details.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Conformance Verification Log:
                </h4>
                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {report.conformanceCheck.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: Auto-Healing Attempts (§3.6)                  */}
        {/* ==================================================== */}
        {activeTab === 3 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Auto-Healing Overview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-500" />
                    Playwright Healer Agent (§3.6)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Autonomous self-healing loop: parses test failure stack traces, diagnoses
                    broken selectors or compile errors, generates diffs, and re-validates with
                    bounded retries.
                  </p>
                </div>

                {report.healingSummary?.attempted ? (
                  report.healingSummary.successful ? (
                    <span className="px-3 py-1 text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 rounded-full flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Healed Successfully
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded-full">
                      Retries Exhausted
                    </span>
                  )
                ) : (
                  <span className="px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-full">
                    No Healing Needed
                  </span>
                )}
              </div>

              {report.healingSummary?.attempted && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Total Attempts</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {report.healingSummary.totalAttempts} / {report.healingSummary.maxAttempts}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Final Status</span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {report.healingSummary.successful ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Target Spec</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {report.specId}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">Bounded Retries</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      Max {report.healingSummary.maxAttempts}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Attempts Timeline */}
            {report.healingSummary?.attempts && report.healingSummary.attempts.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Self-Healing Attempts Timeline ({report.healingSummary.attempts.length})
                </h4>

                {report.healingSummary.attempts.map((attempt) => (
                  <div
                    key={attempt.attemptNumber}
                    className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Attempt #{attempt.attemptNumber}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {new Date(attempt.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                          Stage: {attempt.stage}
                        </span>
                      </div>

                      {attempt.success ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Success
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          Unresolved
                        </span>
                      )}
                    </div>

                    {/* Diagnosis */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        AI Diagnosis:
                      </span>
                      <p className="text-slate-600 dark:text-slate-400">{attempt.diagnosis}</p>
                    </div>

                    {/* Target Files */}
                    {attempt.targetFiles.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Target Files:</span>
                        <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                          {attempt.targetFiles.map((tf, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300"
                            >
                              {tf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Changes Applied */}
                    {attempt.changesApplied.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Applied Code Repairs ({attempt.changesApplied.length}):
                        </span>
                        {attempt.changesApplied.map((ch, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              <span>{ch.file}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                              {ch.description}
                            </p>
                            {ch.diff && (
                              <pre className="p-2 bg-slate-900 text-slate-200 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
                                {ch.diff}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No auto-healing attempts were required for this run. All static rules, tests, and
                conformance checks passed on initial execution.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
