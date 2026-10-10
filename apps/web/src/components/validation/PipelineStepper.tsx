import React from 'react';
import {
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCheck,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ValidationReport } from '@qaa/shared';

export interface PipelineStepperProps {
  report: ValidationReport | null;
  isRunning: boolean;
  activeStage?: number; // 1-5 when running
  onSelectStageTab?: (stageIndex: number) => void;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  report,
  isRunning,
  activeStage,
  onSelectStageTab,
}) => {
  // Determine status of each stage
  const getStageStatus = (stageIdx: number) => {
    if (isRunning) {
      if (activeStage === stageIdx) return 'running';
      if (activeStage && activeStage > stageIdx) return 'passed';
      return 'pending';
    }

    if (!report) return 'pending';

    switch (stageIdx) {
      case 1: // Static
        return report.staticValidation.passed ? 'passed' : 'failed';
      case 2: // Dynamic
        return report.dynamicValidation.passed ? 'passed' : 'failed';
      case 3: // Conformance
        return report.conformanceCheck.passed ? 'passed' : 'failed';
      case 4: // Auto-Heal
        if (!report.healingSummary?.attempted) {
          return report.overallStatus === 'PASSED' ? 'skipped' : 'failed';
        }
        return report.healingSummary.successful ? 'healed' : 'failed';
      case 5: // Quality Gate
        return report.eligibleForPromotion ? 'passed' : 'failed';
      default:
        return 'pending';
    }
  };

  const stages = [
    {
      id: 1,
      title: 'Static Analysis',
      subtitle: 'tsc, lint, selectors, imports',
      icon: Code2,
      metrics: report
        ? `${report.staticValidation.selectorValidation.validCount} selectors verified • ${report.staticValidation.typeScriptCheck.errors.length} errors`
        : 'TypeScript compilation & Page Object verification',
    },
    {
      id: 2,
      title: 'Dynamic Execution',
      subtitle: 'Playwright test runner',
      icon: Cpu,
      metrics: report
        ? `${report.dynamicValidation.passedCount}/${report.dynamicValidation.totalTests} passed (${report.dynamicValidation.durationMs}ms)`
        : 'Execution in target environment with traces & logs',
    },
    {
      id: 3,
      title: 'Spec Conformance',
      subtitle: '100% Approved coverage',
      icon: FileCheck,
      metrics: report
        ? `${report.conformanceCheck.covered.length}/${report.conformanceCheck.approvedTestCaseIds.length} approved TCs covered`
        : 'Verify 0 unapproved functionality automated',
    },
    {
      id: 4,
      title: 'Auto-Healing Gate',
      subtitle: 'Playwright healer agent',
      icon: Sparkles,
      metrics: report?.healingSummary?.attempted
        ? `${report.healingSummary.totalAttempts}/${report.healingSummary.maxAttempts} attempts • ${report.healingSummary.successful ? 'Healed' : 'Exhausted'}`
        : 'Bounded LLM-driven self-healing on failure',
    },
    {
      id: 5,
      title: 'Release Quality Gate',
      subtitle: '8 release criteria (§8)',
      icon: ShieldCheck,
      metrics: report
        ? report.eligibleForPromotion
          ? 'Eligible for promotion to /automation'
          : 'Gating promotion until checks pass'
        : 'Gates storage of unverified automation scripts',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Horizontal on Desktop, Card stack on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {stages.map((stage) => {
          const status = getStageStatus(stage.id);
          const Icon = stage.icon;

          let badgeColor =
            'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
          let statusText = 'Pending';
          let StatusIcon = Clock;

          if (status === 'running') {
            badgeColor =
              'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
            statusText = 'Running...';
            StatusIcon = Loader2;
          } else if (status === 'passed') {
            badgeColor =
              'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
            statusText = 'Passed';
            StatusIcon = CheckCircle2;
          } else if (status === 'healed') {
            badgeColor =
              'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800';
            statusText = 'Healed';
            StatusIcon = Sparkles;
          } else if (status === 'failed') {
            badgeColor =
              'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
            statusText = 'Failed';
            StatusIcon = XCircle;
          } else if (status === 'skipped') {
            badgeColor =
              'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800';
            statusText = 'Not Needed';
            StatusIcon = CheckCircle2;
          }

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStageTab?.(stage.id - 1)}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:shadow-sm ${
                status === 'running'
                  ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-50/20 dark:bg-blue-950/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Stage {stage.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                  >
                    <StatusIcon
                      className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`}
                    />
                    {statusText}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {stage.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  {stage.subtitle}
                </p>
              </div>

              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 line-clamp-2">
                {stage.metrics}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
