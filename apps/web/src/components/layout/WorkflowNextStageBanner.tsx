import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight, HelpCircle, Sparkles } from 'lucide-react';

export interface WorkflowNextStageBannerProps {
  currentStage: number; // 1: Intake, 2: Specs, 3: Approval, 4: Validation, 5: Repository
  currentStageName: string;
  nextStageName: string;
  nextStagePath: string;
  isReadyForNext: boolean;
  specId?: string;
  readyMessage?: string;
  pendingMessage?: string;
  actionButtonText?: string;
  guidanceTips?: string[];
}

export const WorkflowNextStageBanner: React.FC<WorkflowNextStageBannerProps> = ({
  currentStage,
  currentStageName,
  nextStageName,
  nextStagePath,
  isReadyForNext,
  specId,
  readyMessage,
  pendingMessage,
  actionButtonText,
  guidanceTips = [],
}) => {
  const nextStageNum = Math.min(5, currentStage + 1);

  if (!isReadyForNext) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] flex items-center justify-center font-bold">
              {currentStage}
            </span>
            <span>Current Workflow Stage: {currentStageName}</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
            In Progress
          </span>
        </div>

        <p className="text-slate-500 dark:text-slate-400">
          {pendingMessage ||
            `Complete the actions in this stage to advance to Stage ${nextStageNum}: ${nextStageName}.`}
        </p>

        {guidanceTips.length > 0 && (
          <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Tips:</span>
            {guidanceTips.map((tip, idx) => (
              <span
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300"
              >
                {tip}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-indigo-950/40 rounded-xl border border-emerald-300/80 dark:border-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Stage {currentStage} Completed
          </span>
          {specId && (
            <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {specId}
            </span>
          )}
        </div>

        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {readyMessage || `Ready to proceed to Stage ${nextStageNum}: ${nextStageName}`}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          The required artifacts for {currentStageName} are verified. Continue the Spec-Driven
          pipeline forward.
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2 pt-1 sm:pt-0">
        <Link
          to={nextStagePath}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{actionButtonText || `Proceed to ${nextStageName}`}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
