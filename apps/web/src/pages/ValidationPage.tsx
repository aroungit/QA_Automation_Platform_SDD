import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FolderArchive,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type {
  DynamicExecutionMode,
  HealRequest,
  SpecArtifactsPayload,
  SpecSummaryItem,
  ValidationReport,
} from '@qaa/shared';
import { FailedArtifactView } from '../components/validation/FailedArtifactView';
import { PipelineStepper } from '../components/validation/PipelineStepper';
import { QualityGatesModal } from '../components/validation/QualityGatesModal';
import { ValidationFailureSummary } from '../components/validation/ValidationFailureSummary';
import { ValidationReportView } from '../components/validation/ValidationReportView';
import { ValidationRunControls } from '../components/validation/ValidationRunControls';
import { WorkflowNextStageBanner } from '../components/layout/WorkflowNextStageBanner';
import { useLLM } from '../providers/LLMContext';
import { api } from '../services/api';

export const ValidationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const specIdFromUrl = searchParams.get('specId');

  const { selectedProvider, selectedModel } = useLLM();

  // Specs & selection
  const [specs, setSpecs] = useState<SpecSummaryItem[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>(specIdFromUrl || '');
  const [specPayload, setSpecPayload] = useState<SpecArtifactsPayload | null>(null);

  // Workspace scripts state
  const [hasScripts, setHasScripts] = useState(false);
  const [scriptCount, setScriptCount] = useState(0);

  // Validation report state
  const [activeReport, setActiveReport] = useState<ValidationReport | null>(null);
  const [pastReports, setPastReports] = useState<ValidationReport[]>([]);

  // Pipeline execution & view state
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runningStage, setRunningStage] = useState<number>(1);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);
  const [isCleaningWorkspace, setIsCleaningWorkspace] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'report' | 'workspace'>('report');
  const [qualityGateModalOpen, setQualityGateModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Initial Load: list specifications
  useEffect(() => {
    let mounted = true;
    api
      .listSpecs()
      .then((list) => {
        if (!mounted) return;
        setSpecs(list);
        if (!selectedSpecId && list.length > 0) {
          // Default to first approved spec or first spec
          const approved = list.find((s) => s.status === 'Approved');
          const target = approved?.specId ?? list[0]?.specId ?? '';
          if (target) {
            setSelectedSpecId(target);
            setSearchParams({ specId: target }, { replace: true });
          }
        }
      })
      .catch((err) => {
        if (mounted)
          setErrorMessage(`Failed to load specifications: ${String(err.message || err)}`);
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Synchronize selectedSpecId with URL param
  useEffect(() => {
    if (specIdFromUrl && specIdFromUrl !== selectedSpecId) {
      setSelectedSpecId(specIdFromUrl);
    }
  }, [specIdFromUrl]);

  // 3. Load Spec Data, Workspace Scripts & Reports when spec changes
  const loadSpecDetails = async (specId: string) => {
    if (!specId) return;
    setRefreshing(true);
    setErrorMessage(null);

    try {
      // Fetch spec details, workspace files, and reports in parallel
      const [specData, wsRes, reportsData] = await Promise.all([
        api.getSpec(specId).catch(() => null),
        api.listWorkspaceFiles().catch(() => ({ files: [], workspaceDir: '' })),
        api.listReports(specId).catch(() => [] as ValidationReport[]),
      ]);

      setSpecPayload(specData);

      // Check if scripts exist for this spec or in workspace
      const specScripts = wsRes.files.filter(
        (f) =>
          f.endsWith('.spec.ts') &&
          (f.includes(`/${specId}/`) || f.includes(specId) || f.includes('/tests/')),
      );
      setHasScripts(specScripts.length > 0 || wsRes.files.some((f) => f.includes('tests/')));
      setScriptCount(wsRes.files.length);

      // Reports
      setPastReports(reportsData);
      if (reportsData.length > 0) {
        setActiveReport(reportsData[0] ?? null);
      } else {
        setActiveReport(null);
      }
    } catch (err) {
      setErrorMessage(String((err as Error).message || err));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedSpecId) {
      loadSpecDetails(selectedSpecId);
    }
  }, [selectedSpecId]);

  const handleSelectSpec = (specId: string) => {
    setSelectedSpecId(specId);
    setSearchParams({ specId });
  };

  // 4. Generate Scripts (§3.5)
  const handleGenerateScripts = async () => {
    if (!selectedSpecId) return;
    setIsGeneratingScripts(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.generateScripts(
        selectedSpecId,
        {
          cleanWorkspace: false,
        },
        {
          provider: selectedProvider,
          model: selectedModel,
        },
      );

      setSuccessMessage(
        `Generated ${res.generatedFiles.length} Playwright files for ${res.approvedTestCases.length} approved test cases in .workspace (§3.5).`,
      );
      await loadSpecDetails(selectedSpecId);
    } catch (err) {
      setErrorMessage(String((err as Error).message || err));
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  // 5. Run Full Validation Pipeline (§3.6)
  const handleRunValidation = async (config: {
    mode: DynamicExecutionMode;
    autoHeal: boolean;
    maxHealAttempts: number;
  }) => {
    if (!selectedSpecId) return;
    setIsRunning(true);
    setRunningStage(1);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Staged animation stepper interval
    const stageTimer = setInterval(() => {
      setRunningStage((prev) => (prev < 4 ? prev + 1 : prev));
    }, 800);

    try {
      const report = await api.validateSpec(
        selectedSpecId,
        {
          executionMode: config.mode,
          autoHeal: config.autoHeal,
          maxHealAttempts: config.maxHealAttempts,
        },
        {
          provider: selectedProvider,
          model: selectedModel,
        },
      );

      clearInterval(stageTimer);
      setRunningStage(5);
      setActiveReport(report);
      setPastReports((prev) => [report, ...prev.filter((r) => r.reportId !== report.reportId)]);

      if (report.overallStatus === 'PASSED') {
        setSuccessMessage(
          `Validation PASSED! All static checks, ${report.dynamicValidation.passedCount} tests, and 100% conformance verified.`,
        );
      } else if (report.overallStatus === 'HEALED_PASSED') {
        setSuccessMessage(
          `Validation HEALED & PASSED! Self-healing repaired issues across ${report.healingSummary?.totalAttempts} attempts.`,
        );
      } else {
        setErrorMessage(
          `Validation FAILED with ${report.dynamicValidation.failedCount} failing test(s). Check the Failure Artifacts or trigger auto-healing.`,
        );
      }

      await loadSpecDetails(selectedSpecId);
    } catch (err) {
      clearInterval(stageTimer);
      setErrorMessage(String((err as Error).message || err));
    } finally {
      setIsRunning(false);
    }
  };

  // 6. Manual Healer Trigger (§3.6)
  const handleManualHeal = async (targetFile?: string) => {
    if (!selectedSpecId) return;
    setIsRunning(true);
    setRunningStage(4);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const healReq: HealRequest = {
        maxAttempts: 3,
        targetFiles: targetFile ? [targetFile] : undefined,
      };

      const res = await api.healSpec(selectedSpecId, healReq, {
        provider: selectedProvider,
        model: selectedModel,
      });

      if (res.healed && res.latestReport) {
        setActiveReport(res.latestReport);
        setSuccessMessage(
          `Self-healing succeeded after ${res.totalAttempts} attempts! Tests now passing.`,
        );
      } else {
        setErrorMessage(
          `Self-healing completed ${res.totalAttempts} attempts, but failures remain unresolved. Inspect code diffs.`,
        );
      }

      await loadSpecDetails(selectedSpecId);
    } catch (err) {
      setErrorMessage(String((err as Error).message || err));
    } finally {
      setIsRunning(false);
    }
  };

  // 7. Clean Workspace
  const handleCleanWorkspace = async () => {
    setIsCleaningWorkspace(true);
    try {
      await api.cleanWorkspace();
      setHasScripts(false);
      setScriptCount(0);
      setSuccessMessage('Temporary workspace (.workspace) cleaned successfully.');
      await loadSpecDetails(selectedSpecId);
    } catch (err) {
      setErrorMessage(`Failed to clean workspace: ${String((err as Error).message || err)}`);
    } finally {
      setIsCleaningWorkspace(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            Automated Validation, Runs &amp; Reports (§3.6, §3.7)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated verification pipeline: Static code analysis, Playwright execution against
            target environments, 100% specification conformance, and autonomous self-healing.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectedSpecId && loadSpecDetails(selectedSpecId)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh validation data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/approval"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Approval Gate</span>
          </Link>

          <Link
            to="/repository"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Repository &amp; Gates</span>
          </Link>
        </div>
      </div>

      {/* Specification Selector Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label
            htmlFor="spec-select"
            className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap"
          >
            Select Specification:
          </label>
          <select
            id="spec-select"
            value={selectedSpecId}
            onChange={(e) => handleSelectSpec(e.target.value)}
            disabled={loadingInitial}
            className="w-full sm:w-80 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {specs.map((s) => (
              <option key={s.specId} value={s.specId}>
                {s.specId} — {s.title || 'Untitled'} ({s.status})
              </option>
            ))}
          </select>
        </div>

        {/* Selected spec quick meta */}
        {specPayload && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[11px] ${
                specPayload.approvalRecord?.status === 'Approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}
            >
              {specPayload.approvalRecord?.status ?? 'Draft'}
            </span>

            <span className="font-mono text-slate-500 dark:text-slate-400">
              {specPayload.testCasesJson?.length ?? 0} Test Cases
            </span>
            <span>•</span>
            <span className="text-slate-500 dark:text-slate-400">
              Target: <strong>{specPayload.userStoryJson?.targetApp ?? 'OrangeHRM'}</strong>
            </span>
            <span>•</span>
            <span className="text-slate-500 dark:text-slate-400 uppercase font-mono text-[11px]">
              {specPayload.userStoryJson?.platform ?? 'web'}
            </span>
          </div>
        )}
      </div>

      {/* Workflow Next Stage Guidance Banner */}
      <WorkflowNextStageBanner
        currentStage={4}
        currentStageName="Automated Validation & Auto-Healing"
        nextStageName="Release Quality Gates & Promotion"
        nextStagePath={`/repository?specId=${selectedSpecId}`}
        isReadyForNext={Boolean(activeReport?.eligibleForPromotion)}
        specId={selectedSpecId}
        readyMessage="Validation passed with 100% specification conformance! Ready to evaluate the 8 Quality Gates & promote."
        pendingMessage={
          !specPayload?.approvalRecord || specPayload.approvalRecord.status !== 'Approved'
            ? 'Specification must be Approved at Stage 3 before automation scripts can be generated & executed.'
            : !hasScripts
              ? 'Click "Generate Scripts (§3.5)" below to create Page Objects and Playwright tests for approved test cases.'
              : !activeReport
                ? 'Click "Run Validation Pipeline (§3.6)" to execute static analysis, dynamic tests, and conformance checks.'
                : activeReport.overallStatus === 'FAILED'
                  ? 'Tests failed. Trigger "Self-Heal Failures (§3.6)" to autonomously fix selector or compilation issues.'
                  : 'Execute the validation pipeline to evaluate test run results.'
        }
        actionButtonText="Proceed to Quality Gates & Repository (§3.7, §8)"
        guidanceTips={[
          'Run in Simulated mode for fast local validation or Real for live browser execution',
          'Autonomous self-healing runs automatically up to 3 times on failures',
          'Once passed, proceed to evaluate the 8 release quality gates',
        ]}
      />

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Pipeline Stepper Component */}
      <PipelineStepper
        report={activeReport}
        isRunning={isRunning}
        activeStage={runningStage}
        onSelectStageTab={() => setActiveViewTab('report')}
      />

      {/* Validation Run Controls Component */}
      <ValidationRunControls
        spec={specPayload}
        hasScripts={hasScripts}
        scriptCount={scriptCount}
        isRunning={isRunning}
        isGeneratingScripts={isGeneratingScripts}
        isCleaningWorkspace={isCleaningWorkspace}
        onRunValidation={handleRunValidation}
        onGenerateScripts={handleGenerateScripts}
        onCleanWorkspace={handleCleanWorkspace}
        onOpenWorkspaceViewer={() => setActiveViewTab('workspace')}
      />

      {/* View Switcher: Report View vs Workspace/Failed Artifacts */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 w-full">
          <button
            type="button"
            onClick={() => setActiveViewTab('report')}
            className={`py-2 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeViewTab === 'report'
                ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Validation Report &amp; Test Results</span>
            {activeReport && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeReport.overallStatus === 'PASSED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : activeReport.overallStatus === 'HEALED_PASSED'
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {activeReport.overallStatus}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('workspace')}
            className={`py-2 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeViewTab === 'workspace'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Temporary Workspace &amp; Failed Artifacts ({scriptCount})</span>
            {activeReport && activeReport.dynamicValidation.failedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>
      </div>

      {/* Validation & Healing Failure Summary if any failure exists */}
      <ValidationFailureSummary
        report={activeReport}
        onTriggerManualHeal={handleManualHeal}
        onNavigateToTab={() => setActiveViewTab('report')}
      />

      {/* Main View Area */}
      {activeViewTab === 'report' ? (
        activeReport ? (
          <ValidationReportView
            report={activeReport}
            pastReports={pastReports}
            onSelectPastReport={(rId) => {
              const found = pastReports.find((r) => r.reportId === rId);
              if (found) setActiveReport(found);
            }}
            onOpenQualityGateModal={() => setQualityGateModalOpen(true)}
            onTriggerManualHeal={handleManualHeal}
          />
        ) : (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Play className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Validation Runs Found for {selectedSpecId}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Execute the automated validation pipeline to run static TypeScript checks, dynamic
              Playwright execution, and verify 100% specification conformance.
            </p>
          </div>
        )
      ) : (
        <FailedArtifactView
          specId={selectedSpecId}
          report={activeReport}
          onHealRequested={handleManualHeal}
          onWorkspaceCleaned={() => {
            setHasScripts(false);
            setScriptCount(0);
          }}
        />
      )}

      {/* Quality Gates & Promotion Modal (§8, §3.7) */}
      <QualityGatesModal
        specId={selectedSpecId}
        isOpen={qualityGateModalOpen}
        onClose={() => setQualityGateModalOpen(false)}
        onPromoted={() => {
          loadSpecDetails(selectedSpecId);
        }}
      />
    </div>
  );
};
