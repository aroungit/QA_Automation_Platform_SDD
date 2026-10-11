import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { DynamicExecutionMode, SpecArtifactsPayload } from '@qaa/shared';
import { useLLM } from '../../providers/LLMContext';

export interface ValidationRunControlsProps {
  spec: SpecArtifactsPayload | null;
  hasScripts: boolean;
  scriptCount: number;
  isRunning: boolean;
  isGeneratingScripts: boolean;
  isCleaningWorkspace: boolean;
  onRunValidation: (config: {
    mode: DynamicExecutionMode;
    autoHeal: boolean;
    maxHealAttempts: number;
  }) => Promise<void>;
  onGenerateScripts: () => Promise<void>;
  onCleanWorkspace: () => Promise<void>;
  onOpenWorkspaceViewer: () => void;
}

export const ValidationRunControls: React.FC<ValidationRunControlsProps> = ({
  spec,
  hasScripts,
  scriptCount,
  isRunning,
  isGeneratingScripts,
  isCleaningWorkspace,
  onRunValidation,
  onGenerateScripts,
  onCleanWorkspace,
  onOpenWorkspaceViewer,
}) => {
  const { selectedProvider, providers, selectedModel } = useLLM();
  const currentProvider = providers.find((p) => p.name === selectedProvider);

  const [mode, setMode] = useState<DynamicExecutionMode>('simulated');
  const [autoHeal, setAutoHeal] = useState(true);
  const [maxHealAttempts, setMaxHealAttempts] = useState(3);
  const [showConfig, setShowConfig] = useState(false);

  const isApproved = spec?.approvalRecord?.status === 'Approved';
  const approvedCount = spec?.approvalRecord?.approvedTestCases?.length ?? 0;

  const handleStart = () => {
    onRunValidation({
      mode,
      autoHeal,
      maxHealAttempts,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Validation Pipeline Controls (§3.6)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Static lint/compilation, dynamic execution against target environment, and bounded
            auto-healing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              showConfig
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
            title="Configure Execution Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Options</span>
          </button>

          <button
            type="button"
            onClick={onOpenWorkspaceViewer}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-1.5 transition-colors"
            title="Inspect Temporary Workspace Files (.workspace)"
          >
            <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Workspace Files ({scriptCount})</span>
          </button>

          <button
            type="button"
            onClick={onCleanWorkspace}
            disabled={isCleaningWorkspace || isRunning}
            className="p-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-300 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
            title="Clean temporary workspace (.workspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Warning if spec is not Approved */}
      {!isApproved && spec && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <span className="font-semibold">Approval Required Before Validation (§3.4, §3.6)</span>
            <p className="text-amber-700 dark:text-amber-300">
              Specification <strong>{spec.specId}</strong> is currently in status{' '}
              <span className="font-semibold uppercase">
                {spec.approvalRecord?.status ?? 'Draft'}
              </span>
              . Only test cases with status <strong>Approved</strong> can be validated.
            </p>
            <Link
              to={`/approval?specId=${spec.specId}`}
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline mt-1"
            >
              Go to Approval Gate &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Script Generation Notice */}
      {isApproved && !hasScripts && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-800 dark:text-blue-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-semibold">No Generated Scripts Found in Workspace (§3.5)</span>
              <p className="text-blue-700 dark:text-blue-300">
                {approvedCount} test cases are approved. Generate TypeScript Page Objects and
                Playwright scripts to begin automated validation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerateScripts}
            disabled={isGeneratingScripts || isRunning}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isGeneratingScripts ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5" />
                <span>Generate Scripts (§3.5)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Optional Configuration Drawer / Collapse */}
      {showConfig && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-fadeIn">
          {/* Execution Mode */}
          <div className="space-y-1.5">
            <label
              htmlFor="validation-mode"
              className="font-semibold text-slate-700 dark:text-slate-300 block"
            >
              Execution Mode
            </label>
            <select
              id="validation-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as DynamicExecutionMode)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="simulated">Simulated (Fast local in-memory simulation)</option>
              <option value="real">Real (Live headless Playwright browser)</option>
              <option value="dry-run">Dry-run (Syntax &amp; imports runnability check)</option>
            </select>
            <p className="text-[10px] text-slate-500">
              {mode === 'simulated'
                ? 'Simulates test execution against generated fixtures & selectors.'
                : mode === 'real'
                  ? 'Launches Playwright against OrangeHRM demo instance.'
                  : 'Checks structure without browser invocation.'}
            </p>
          </div>

          {/* Auto-Heal Toggle */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Auto-Healing Agent (§3.6)
            </span>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoHeal}
                onChange={(e) => setAutoHeal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                Enable self-healing on failure
              </span>
            </label>
            <p className="text-[10px] text-slate-500">
              Bounded retries will attempt to repair broken selectors and compilation issues.
            </p>
          </div>

          {/* Max Heal Attempts */}
          <div className="space-y-1.5">
            <label
              htmlFor="max-heal-attempts"
              className="font-semibold text-slate-700 dark:text-slate-300 block"
            >
              Max Heal Attempts (1–5)
            </label>
            <input
              id="max-heal-attempts"
              type="number"
              min={1}
              max={5}
              value={maxHealAttempts}
              disabled={!autoHeal}
              onChange={(e) => setMaxHealAttempts(Math.max(1, Math.min(5, Number(e.target.value))))}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-500">
              Provider: <span className="font-semibold">{currentProvider?.displayName}</span> (
              {selectedModel})
            </p>
          </div>
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-mono">
            {hasScripts ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Scripts Ready ({scriptCount} files)
              </span>
            ) : (
              <span className="text-slate-400">Scripts Pending</span>
            )}
          </span>
          <span>•</span>
          <span>
            Mode: <strong className="uppercase">{mode}</strong>
          </span>
          <span>•</span>
          <span>
            Auto-Heal: <strong>{autoHeal ? `ON (${maxHealAttempts}x)` : 'OFF'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasScripts && (
            <button
              type="button"
              onClick={onGenerateScripts}
              disabled={isGeneratingScripts || isRunning}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isGeneratingScripts ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Regenerate Scripts</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!isApproved || isRunning || !hasScripts}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Validation Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Validation Pipeline (§3.6)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
