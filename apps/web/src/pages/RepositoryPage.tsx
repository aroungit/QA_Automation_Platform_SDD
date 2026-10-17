import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  GitCommit,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  PromotionRecord,
  PromotionResult,
  QualityGateEvaluation,
  SpecSummaryItem,
  ValidationReport,
} from '@qaa/shared';
import { api } from '../services/api';
import { useLLM } from '../providers/LLMContext';

export const RepositoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const specIdFromUrl = searchParams.get('specId') || '';

  const { selectedProvider, selectedModel } = useLLM();

  // Specs & selection
  const [specs, setSpecs] = useState<SpecSummaryItem[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>(specIdFromUrl);
  const [evaluation, setEvaluation] = useState<QualityGateEvaluation | null>(null);
  const [latestReport, setLatestReport] = useState<ValidationReport | null>(null);

  // Promotion & repository state
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [automationFiles, setAutomationFiles] = useState<string[]>([]);
  const [activeFileFilter, setActiveFileFilter] = useState<'all' | 'web' | 'mobile'>('all');

  // Loading & action states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Load initial specs, promotions and repository files
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.listSpecs().catch(() => []),
      api.listPromotions().catch(() => []),
      api.listAutomationFiles().catch(() => ({ files: [] })),
    ])
      .then(([specsList, promos, auto]) => {
        if (!mounted) return;
        setSpecs(specsList);
        setPromotions(promos);
        setAutomationFiles(auto.files);

        // Auto-select a spec if not provided
        if (!selectedSpecId && specsList.length > 0) {
          const approved = specsList.find((s) => s.status === 'Approved');
          const target = approved ? approved.specId : specsList[0]!.specId;
          setSelectedSpecId(target);
          setSearchParams({ specId: target }, { replace: true });
        }
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Synchronize selectedSpecId with query param
  useEffect(() => {
    if (specIdFromUrl && specIdFromUrl !== selectedSpecId) {
      setSelectedSpecId(specIdFromUrl);
    }
  }, [specIdFromUrl]);

  // 3. Evaluate Quality Gates whenever selected spec changes
  const evaluateSpec = async (specId: string) => {
    if (!specId) return;
    setEvaluating(true);
    setActionError(null);
    setPromotionResult(null);

    try {
      const [evalData, reportData] = await Promise.all([
        api.getQualityGate(specId),
        api.getLatestValidationReport(specId).catch(() => null),
      ]);

      setEvaluation(evalData);
      setLatestReport(reportData);
      setCommitMessage(
        `feat(${specId}): promote validated Playwright automation test suite (§3.7, §8)`,
      );
    } catch (err) {
      console.error('Failed to evaluate quality gates:', err);
      setActionError(
        (err as Error).message || `Failed to evaluate Quality Gates for spec ${specId}.`,
      );
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    if (selectedSpecId) {
      evaluateSpec(selectedSpecId);
    }
  }, [selectedSpecId]);

  const handleSelectSpec = (specId: string) => {
    setSelectedSpecId(specId);
    setSearchParams({ specId });
  };

  // Promotion Handler
  const handlePromote = async () => {
    if (!selectedSpecId) return;
    setPromoting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.promoteSpec(selectedSpecId, {
        commitMessage: commitMessage.trim(),
        autoCommit: true,
      });

      setPromotionResult(res);
      setActionSuccess(
        `Promotion succeeded! Artifacts for ${selectedSpecId} are now formally committed to the automation repository (§3.7).`,
      );

      // Refresh promotions and repository files list
      const [promos, auto] = await Promise.all([
        api.listPromotions().catch(() => []),
        api.listAutomationFiles().catch(() => ({ files: [] })),
      ]);
      setPromotions(promos);
      setAutomationFiles(auto.files);
      await evaluateSpec(selectedSpecId);
    } catch (err) {
      setActionError((err as Error).message || 'Failed to promote specification artifacts.');
    } finally {
      setPromoting(false);
    }
  };

  // Revalidation Trigger Handler
  const handleRevalidate = async () => {
    if (!selectedSpecId) return;
    setRevalidating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const report = await api.revalidateSpec(
        selectedSpecId,
        {
          executionMode: 'simulated',
          autoHeal: true,
          maxHealAttempts: 3,
        },
        {
          provider: selectedProvider,
          model: selectedModel,
        },
      );

      if (report.overallStatus === 'PASSED' || report.overallStatus === 'HEALED_PASSED') {
        setActionSuccess(
          `Revalidation passed! Gate 8 is now satisfied and artifacts are ready to be promoted.`,
        );
      } else {
        setActionError(
          `Revalidation executed but failures were detected (${report.dynamicValidation.failedCount} failed tests). Inspect validation reports.`,
        );
      }

      await evaluateSpec(selectedSpecId);
    } catch (err) {
      setActionError((err as Error).message || 'Failed to execute revalidation.');
    } finally {
      setRevalidating(false);
    }
  };

  // Filter repository files
  const filteredAutomationFiles = automationFiles.filter((f) => {
    if (activeFileFilter === 'web') return f.includes('web/') || f.includes('web\\');
    if (activeFileFilter === 'mobile') return f.includes('mobile/') || f.includes('mobile\\');
    return true;
  });

  const selectedSpecMeta = specs.find((s) => s.specId === selectedSpecId);
  const allGatesPassed = evaluation?.passed ?? false;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            Stage 5: Release Quality Gates &amp; Repository Promotion (§3.7, §8)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            The final release gatekeeper of Spec-Driven QA. Only test suites that strictly satisfy
            all 8 release quality criteria are promoted to the permanent repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectedSpecId && evaluateSpec(selectedSpecId)}
            disabled={evaluating}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Quality Gates Evaluation"
          >
            <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to={`/validation?specId=${selectedSpecId}`}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-cyan-500" />
            <span>Validation Runs</span>
          </Link>
        </div>
      </div>

      {/* User Action Guide Card - Explains clearly what to do */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              What do you need to action in this final stage?
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Before automation scripts can be deployed into production or shared with the team,
              they must pass <strong>all 8 Quality Gates (§8)</strong> below. Follow this 3-step
              workflow:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>Step A:</span> Select &amp; Review Gates
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pick your target specification. Inspect the 8 checklist items below to see which
              criteria are green and which are pending.
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>Step B:</span> Fix Any Blockers
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              If a gate fails, click the direct action button on that gate (e.g., approve test
              cases, run self-healing, or trigger revalidation).
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>Step C:</span> Promote to Repository
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              When all 8 gates pass, click <strong>&quot;Promote to Main Repository&quot;</strong> to
              cleanly move scripts from temporary workspace to <code>/automation</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Specification Selector Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label
            htmlFor="repo-spec-select"
            className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap"
          >
            Target Specification:
          </label>
          <select
            id="repo-spec-select"
            value={selectedSpecId}
            onChange={(e) => handleSelectSpec(e.target.value)}
            disabled={loadingInitial}
            className="w-full sm:w-96 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {specs.map((s) => (
              <option key={s.specId} value={s.specId}>
                {s.specId} — {s.title || 'Untitled'} ({s.status}) {s.promoted ? '★ PROMOTED' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedSpecMeta && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                selectedSpecMeta.status === 'Approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}
            >
              {selectedSpecMeta.status}
            </span>

            <span className="font-mono text-slate-500">
              {selectedSpecMeta.testCaseCount || 0} Test Cases
            </span>
            <span>•</span>
            <span className="text-slate-600 dark:text-slate-300">
              App: <strong>{selectedSpecMeta.targetApp || 'OrangeHRM'}</strong>
            </span>

            {selectedSpecMeta.promoted ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" /> Promoted
              </span>
            ) : (
              <span className="text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Unpromoted
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div
          role="alert"
          className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between text-xs sm:text-sm text-rose-800 dark:text-rose-200 animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 dark:text-rose-400 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Evaluation & Promotion Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 8 Quality Gates Interactive Evaluation */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                8 Release Quality Gates (§8)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluation status for specification{' '}
                <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                  {selectedSpecId}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  allGatesPassed
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                }`}
              >
                {allGatesPassed ? 'ALL 8 GATES PASSED' : 'ACTION REQUIRED'}
              </span>
            </div>
          </div>

          {evaluating ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500">
                Auditing 8 Quality Gates against latest validation runs...
              </p>
            </div>
          ) : !evaluation ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Select a specification above to evaluate its Quality Gates.
            </div>
          ) : (
            <div className="space-y-3">
              {evaluation.gates.map((g, idx) => {
                let actionLink: { label: string; to: string } | null = null;
                if (!g.passed) {
                  if (g.gate === 'APPROVED_SPECIFICATION' || g.gate === 'APPROVED_TEST_CASES') {
                    actionLink = {
                      label: 'Go to Approval Gate to Approve',
                      to: `/approval?specId=${selectedSpecId}`,
                    };
                  } else if (
                    g.gate === 'SCRIPTS_MAP_TO_APPROVED_TEST_CASES' ||
                    g.gate === 'SCRIPTS_COMPILE_SUCCESSFULLY' ||
                    g.gate === 'SCRIPTS_PASS_AUTOMATED_EXECUTION'
                  ) {
                    actionLink = {
                      label: 'Go to Validation to Generate & Run Tests',
                      to: `/validation?specId=${selectedSpecId}`,
                    };
                  } else if (g.gate === 'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED') {
                    actionLink = {
                      label: 'Trigger Revalidation Now',
                      to: '#revalidate',
                    };
                  }
                }

                return (
                  <div
                    key={g.gate}
                    className={`p-4 rounded-xl border transition-all ${
                      g.passed
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-rose-200 dark:border-rose-900/80 bg-rose-50/40 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {g.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white">
                              Gate {idx + 1}: {g.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              ({g.gate})
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {g.description}
                          </p>

                          {g.details && (
                            <p
                              className={`text-[11px] font-medium pt-0.5 ${
                                g.passed
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {g.details}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action trigger button if gate failed */}
                      {!g.passed && actionLink && (
                        <div className="shrink-0">
                          {actionLink.to === '#revalidate' ? (
                            <button
                              type="button"
                              onClick={handleRevalidate}
                              disabled={revalidating}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50"
                            >
                              <RotateCcw
                                className={`w-3 h-3 ${revalidating ? 'animate-spin' : ''}`}
                              />
                              <span>Revalidate</span>
                            </button>
                          ) : (
                            <Link
                              to={actionLink.to}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg inline-flex items-center gap-1 shadow-sm transition-colors whitespace-nowrap"
                            >
                              <span>Fix</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Promotion Action & Status */}
        <div className="space-y-6">
          {/* Promotion Card */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Promotion Decision
            </h2>

            {allGatesPassed ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ready for Promotion
                  </div>
                  <p>
                    All 8 Quality Gates are satisfied! You can now commit and promote the verified
                    test suite for <strong>{selectedSpecId}</strong> to the permanent automation
                    repository.
                  </p>
                </div>

                {/* Git Commit Message Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="commit-msg-input"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Git Commit Message (§3.7):</span>
                  </label>
                  <input
                    id="commit-msg-input"
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePromote}
                  disabled={promoting}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {promoting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Promoting to Repository...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Promote to Main Repository (§3.7)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" /> Promotion Blocked (§8)
                  </div>
                  <p>
                    Scripts cannot be promoted until all 8 Quality Gates pass. Failing gates remain
                    quarantined in <code>.workspace</code>.
                  </p>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    <strong>Recommended Next Action:</strong>
                  </div>

                  {!evaluation?.gates.find((g) => g.gate === 'APPROVED_SPECIFICATION')?.passed ? (
                    <Link
                      to={`/approval?specId=${selectedSpecId}`}
                      className="w-full py-2 px-3 bg-indigo-600 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <span>1. Approve Specification in Approval Gate</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : !evaluation?.gates.find((g) => g.gate === 'SCRIPTS_PASS_AUTOMATED_EXECUTION')
                      ?.passed ? (
                    <Link
                      to={`/validation?specId=${selectedSpecId}`}
                      className="w-full py-2 px-3 bg-cyan-600 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <span>2. Run Validation &amp; Auto-Healing</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : evaluation?.revalidationRequired ? (
                    <button
                      type="button"
                      onClick={handleRevalidate}
                      disabled={revalidating}
                      className="w-full py-2 px-3 bg-indigo-600 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${revalidating ? 'animate-spin' : ''}`} />
                      <span>3. Trigger Spec Revalidation (§8)</span>
                    </button>
                  ) : (
                    <Link
                      to={`/validation?specId=${selectedSpecId}`}
                      className="w-full py-2 px-3 bg-indigo-600 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <span>Complete Validation Checks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats on Promoted Suites */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Repository Statistics
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] text-slate-400 block uppercase">Promoted Specs</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {promotions.length}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-[10px] text-slate-400 block uppercase">Committed Files</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {automationFiles.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Repository Explorer & Promoted History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Promoted Specifications List */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Promoted Specifications ({promotions.length})
            </h3>
            <span className="text-[11px] text-slate-400">Production Verified</span>
          </div>

          {promotions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p>No specifications have been promoted yet.</p>
              <p className="text-[11px]">
                Pass all 8 Quality Gates and promote a specification above to see it recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {promotions.map((p) => (
                <div
                  key={p.specId}
                  onClick={() => handleSelectSpec(p.specId)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    p.specId === selectedSpecId
                      ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-semibold text-xs">
                    <span className="text-indigo-600 dark:text-indigo-400">{p.specId}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(p.promotedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Report: {p.validationReportId}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {p.promotedFiles?.length || 0} files
                    </span>
                  </div>
                  {p.commit?.message && (
                    <div className="text-[10px] font-mono text-slate-400 truncate mt-1">
                      git: {p.commit.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Automation Directory Files Explorer */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-500" />
              Permanent /automation Files ({filteredAutomationFiles.length})
            </h3>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 text-[11px]">
              {(['all', 'web', 'mobile'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveFileFilter(mode)}
                  className={`px-2 py-0.5 rounded capitalize transition-colors ${
                    activeFileFilter === mode
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {filteredAutomationFiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p>Repository is clean.</p>
              <p className="text-[11px]">
                Promoted Playwright scripts, Page Objects, fixtures, and configs will appear here
                once quality-approved (§3.7).
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 font-mono text-xs">
              {filteredAutomationFiles.map((file) => (
                <div
                  key={file}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-slate-700 dark:text-slate-300 truncate flex items-center justify-between"
                >
                  <span className="truncate">{file}</span>
                  <span className="text-[10px] text-slate-400 font-sans ml-2 shrink-0">
                    {file.endsWith('.spec.ts')
                      ? 'Test'
                      : file.endsWith('Page.ts')
                        ? 'Page'
                        : file.endsWith('.json')
                          ? 'Fixture'
                          : 'Config'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
