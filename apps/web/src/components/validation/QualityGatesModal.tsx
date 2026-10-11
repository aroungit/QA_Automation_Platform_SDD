import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitCommit,
  Loader2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { PromotionResult, QualityGateEvaluation } from '@qaa/shared';
import { api } from '../../services/api';

export interface QualityGatesModalProps {
  specId: string;
  isOpen: boolean;
  onClose: () => void;
  onPromoted?: (result: PromotionResult) => void;
}

export const QualityGatesModal: React.FC<QualityGatesModalProps> = ({
  specId,
  isOpen,
  onClose,
  onPromoted,
}) => {
  const [evaluation, setEvaluation] = useState<QualityGateEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [commitMessage, setCommitMessage] = useState(
    `feat(${specId}): promote validated Playwright automation test suite (§3.7)`,
  );
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !specId) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setPromotionResult(null);

    api
      .getQualityGate(specId)
      .then((data) => {
        if (mounted) setEvaluation(data);
      })
      .catch((err) => {
        if (mounted) setError(String(err.message || err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, specId]);

  // Keyboard accessibility & scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allPassed = evaluation?.passed ?? false;

  const handlePromote = async () => {
    setPromoting(true);
    setError(null);
    try {
      const result = await api.promoteSpec(specId, {
        commitMessage: commitMessage.trim(),
        autoCommit: true,
      });
      setPromotionResult(result);
      onPromoted?.(result);
    } catch (err: unknown) {
      setError(String((err as Error).message || err));
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Release Quality Gates &amp; Repository Promotion (§8, §3.7)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Specification: {specId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Evaluating 8 Quality Gates against specification artifacts...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Quality Gate Evaluation Failed:</span>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : promotionResult ? (
            /* Success State */
            <div className="py-6 text-center space-y-4 animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Promotion Completed Successfully!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Validated Playwright scripts, Page Objects, fixtures, and execution reports for{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">{specId}</strong> have
                  been promoted to the automation repository.
                </p>
              </div>

              {promotionResult.promotedFiles && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-mono text-left max-w-lg mx-auto space-y-1">
                  <span className="font-sans font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Promoted Artifacts ({promotionResult.promotedFiles.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    {promotionResult.promotedFiles.map((f, i) => (
                      <div key={i} className="truncate">
                        &bull; {f.targetPath}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to="/repository"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <span>View in Repository</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Gates Evaluation List */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Quality Gates Checklist (§8)
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    allPassed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {allPassed ? 'ALL GATES PASSED' : 'GATE CHECK FAILED'}
                </span>
              </div>

              {/* 8 Gates */}
              <div className="space-y-2">
                {evaluation?.gates.map((g) => (
                  <div
                    key={g.gate}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
                      g.passed
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
                        : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {g.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {g.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{g.gate}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {g.description}
                      </p>
                      {g.details && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium pt-0.5">
                          {g.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Commit Message & Promotion Trigger */}
              {allPassed && (
                <div className="pt-2 space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="commit-message"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      <GitCommit className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Git Commit Message (§3.7):</span>
                    </label>
                    <input
                      id="commit-message"
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePromote}
                      disabled={promoting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                    >
                      {promoting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Promoting Artifacts...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Promote to Repository (§3.7)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
