import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type {
  ApprovalDecisionRequest,
  ApprovalHistoryEntry,
  ApprovalLoopbackRequest,
  ApprovalRecord,
  ApprovalStatus,
  CanProceedResponse,
  LoopbackStage,
  SpecArtifactsPayload,
  SpecSummaryItem,
  TestCase,
} from '@qaa/shared';
import { WorkflowNextStageBanner } from '../layout/WorkflowNextStageBanner';
import { useLLM } from '../../providers/LLMContext';
import { api } from '../../services/api';

const REVIEWER_STORAGE_KEY = 'qaa-reviewer-name';

export const ApprovalGateView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSpecIdParam = searchParams.get('specId') || '';
  const { selectedProvider } = useLLM();

  // Specs list
  const [specsList, setSpecsList] = useState<SpecSummaryItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active Spec state
  const [selectedSpecId, setSelectedSpecId] = useState<string>(currentSpecIdParam);
  const [specPayload, setSpecPayload] = useState<SpecArtifactsPayload | null>(null);
  const [approvalRecord, setApprovalRecord] = useState<ApprovalRecord | null>(null);
  const [canProceedInfo, setCanProceedInfo] = useState<CanProceedResponse | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);

  // Reviewer form state
  const [reviewerName, setReviewerName] = useState<string>(() => {
    return (
      (typeof window !== 'undefined' && localStorage.getItem(REVIEWER_STORAGE_KEY)) ||
      'Lead QA Engineer'
    );
  });
  const [reviewerComments, setReviewerComments] = useState('');
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Loopback state
  const [showLoopbackPanel, setShowLoopbackPanel] = useState(false);
  const [loopbackStage, setLoopbackStage] = useState<LoopbackStage>('all');
  const [loopbackFeedback, setLoopbackFeedback] = useState('');
  const [submittingLoopback, setSubmittingLoopback] = useState(false);

  // Expanded test case row steps
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load available specs on mount
  useEffect(() => {
    let mounted = true;
    api
      .listSpecs()
      .then((data) => {
        if (mounted) {
          setSpecsList(data);
          // If no spec selected yet, pick the first one or the param
          if (!selectedSpecId && data.length > 0) {
            const initialId = currentSpecIdParam || data[0]!.specId;
            setSelectedSpecId(initialId);
            setSearchParams({ specId: initialId });
          }
        }
      })
      .catch((err) => console.warn('Could not load specs for approval:', err))
      .finally(() => {
        if (mounted) setLoadingList(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // When specId changes, load spec artifacts, approval record, and can-proceed status
  const loadActiveSpecData = async (specId: string) => {
    if (!specId) return;
    setLoadingSpec(true);
    setNotification(null);

    try {
      const [payload, approval, proceed] = await Promise.all([
        api.getSpec(specId),
        api.getApproval(specId),
        api.canProceedToScriptGeneration(specId).catch(() => null),
      ]);

      setSpecPayload(payload);
      setApprovalRecord(approval);
      setCanProceedInfo(proceed);

      // Pre-select approved test cases if any, else pre-select all candidate test cases
      const allCases = payload.testCasesJson || [];
      const approvedIds = approval.approvedTestCases || [];
      if (approvedIds.length > 0) {
        setSelectedTestCases(approvedIds);
      } else {
        setSelectedTestCases(allCases.map((tc) => tc.id));
      }

      // Prefill loopback feedback with latest reviewer comments
      if (approval.comments) {
        setLoopbackFeedback(approval.comments);
      }
    } catch (err) {
      console.error('Error loading spec approval details:', err);
      setNotification({
        type: 'error',
        message: (err as Error).message || 'Failed to load specification details.',
      });
    } finally {
      setLoadingSpec(false);
    }
  };

  useEffect(() => {
    if (selectedSpecId) {
      loadActiveSpecData(selectedSpecId);
    }
  }, [selectedSpecId]);

  const handleSelectSpec = (specId: string) => {
    setSelectedSpecId(specId);
    setSearchParams({ specId });
  };

  const handleToggleTestCase = (id: string) => {
    setSelectedTestCases((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllTestCases = () => {
    const all = specPayload?.testCasesJson?.map((tc) => tc.id) || [];
    setSelectedTestCases(all);
  };

  const handleDeselectAllTestCases = () => {
    setSelectedTestCases([]);
  };

  // Decision submission handler
  const handleDecision = async (targetStatus: ApprovalStatus) => {
    if (!selectedSpecId) return;
    setNotification(null);

    const reviewer = reviewerName.trim();
    if (!reviewer) {
      setNotification({ type: 'error', message: 'Reviewer name is required.' });
      return;
    }

    // Comments required for Rejected and Needs Clarification
    if (
      (targetStatus === 'Rejected' || targetStatus === 'Needs Clarification') &&
      !reviewerComments.trim()
    ) {
      setNotification({
        type: 'error',
        message: `Reviewer comments are mandatory when marking "${targetStatus}" (§3.4).`,
      });
      return;
    }

    // Must have at least 1 test case selected for Approval
    if (targetStatus === 'Approved' && selectedTestCases.length === 0) {
      setNotification({
        type: 'error',
        message: 'You must select at least one test case to approve (§3.4).',
      });
      return;
    }

    // Save reviewer name in local storage
    localStorage.setItem(REVIEWER_STORAGE_KEY, reviewer);

    const decisionPayload: ApprovalDecisionRequest = {
      status: targetStatus,
      reviewer,
      comments: reviewerComments.trim() || '',
      approvedTestCases: targetStatus === 'Approved' ? selectedTestCases : undefined,
    };

    setSubmittingDecision(true);

    try {
      const updated = await api.submitApprovalDecision(selectedSpecId, decisionPayload);
      setApprovalRecord(updated);

      // Refresh proceed status
      const proceed = await api.canProceedToScriptGeneration(selectedSpecId).catch(() => null);
      setCanProceedInfo(proceed);

      setNotification({
        type: 'success',
        message: `Decision successfully recorded: Specification is now marked as "${targetStatus}" (§3.4).`,
      });
      setReviewerComments('');

      // If rejected or clarified, open loopback panel
      if (targetStatus === 'Rejected' || targetStatus === 'Needs Clarification') {
        setShowLoopbackPanel(true);
        if (decisionPayload.comments) {
          setLoopbackFeedback(decisionPayload.comments);
        }
      } else {
        setShowLoopbackPanel(false);
      }
    } catch (err) {
      console.error('Approval decision failed:', err);
      setNotification({
        type: 'error',
        message: (err as Error).message || 'Failed to submit approval decision.',
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Loopback execution handler
  const handleExecuteLoopback = async () => {
    if (!selectedSpecId) return;
    setNotification(null);
    setSubmittingLoopback(true);

    const loopbackPayload: ApprovalLoopbackRequest = {
      stage: loopbackStage,
      feedback: loopbackFeedback.trim() || undefined,
      targetStatus: 'Draft',
    };

    try {
      await api.submitLoopback(selectedSpecId, loopbackPayload);
      setNotification({
        type: 'success',
        message: `Loopback regeneration completed (§3.4): Specification returned to "Draft" and artifacts regenerated with ${selectedProvider}.`,
      });
      setShowLoopbackPanel(false);
      await loadActiveSpecData(selectedSpecId);
    } catch (err) {
      console.error('Loopback execution error:', err);
      setNotification({
        type: 'error',
        message: (err as Error).message || 'Failed to execute regeneration loopback.',
      });
    } finally {
      setSubmittingLoopback(false);
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'Needs Clarification':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
            <HelpCircle className="w-3.5 h-3.5" /> Needs Clarification
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Draft
          </span>
        );
    }
  };

  const candidateCases: TestCase[] = specPayload?.testCasesJson || [];
  const currentStatus: ApprovalStatus = approvalRecord?.status || 'Draft';
  const historyEntries: ApprovalHistoryEntry[] = approvalRecord?.history || [];

  return (
    <div className="space-y-6">
      {/* Spec Selector Dropdown */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <label
            htmlFor="approval-spec-select"
            className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap"
          >
            Specification to Review:
          </label>
        </div>

        <div className="flex-1 max-w-md">
          {loadingList ? (
            <div className="text-xs text-slate-400">Loading specifications...</div>
          ) : specsList.length === 0 ? (
            <div className="text-xs text-slate-500">
              No specifications found.{' '}
              <Link to="/intake" className="text-indigo-600 underline font-medium">
                Create one via Intake
              </Link>
            </div>
          ) : (
            <select
              id="approval-spec-select"
              value={selectedSpecId}
              onChange={(e) => handleSelectSpec(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {specsList.map((s) => (
                <option key={s.specId} value={s.specId}>
                  {s.specId} — {s.title || 'Untitled'} ({s.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadingSpec ? (
        <div className="p-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Loading approval record and candidate test cases for {selectedSpecId}...
          </p>
        </div>
      ) : !specPayload ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <FileText className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No Specification Selected
          </h3>
          <p className="text-xs text-slate-400">
            Choose an existing specification from the selector above or create a new user story.
          </p>
          <Link
            to="/intake"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
          >
            Start Intake
          </Link>
        </div>
      ) : (
        <>
          {/* Workflow Next Stage Guidance Banner */}
          <WorkflowNextStageBanner
            currentStage={3}
            currentStageName="Human Approval Gate"
            nextStageName="Validation & Auto-Healing"
            nextStagePath={`/validation?specId=${specPayload.specId}`}
            isReadyForNext={Boolean(canProceedInfo?.canProceed)}
            specId={specPayload.specId}
            readyMessage={`Test cases approved (${canProceedInfo?.approvedTestCases.length || 0} of ${canProceedInfo?.totalTestCases || 0}). Ready for Playwright script generation & automated validation.`}
            pendingMessage={
              currentStatus === 'Rejected' || currentStatus === 'Needs Clarification'
                ? `Specification is in "${currentStatus}". Provide feedback in the correction loopback panel below to regenerate candidate test cases.`
                : 'Select the candidate test cases you wish to approve, enter your reviewer name, and click "Approve Selected Test Cases" to unlock the Validation Pipeline.'
            }
            actionButtonText="Proceed to Validation Pipeline (§3.5, §3.6)"
            guidanceTips={[
              'Select test cases to automate',
              'Enter reviewer name and comments if rejecting',
              'Approval is a strict prerequisite before scripts can be generated',
            ]}
          />

          {/* Spec Summary & Status Header */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {specPayload.specId}
                  </span>
                  {getStatusBadge(currentStatus)}
                  <span className="text-xs text-slate-500 capitalize">
                    {specPayload.userStoryJson?.platform || 'web'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {specPayload.userStoryJson?.targetApp || 'OrangeHRM'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {specPayload.specificationJson?.title || specPayload.userStoryJson?.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => loadActiveSpecData(selectedSpecId)}
                  className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl"
                  title="Refresh record"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <Link
                  to={`/specs/${specPayload.specId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Inspect Spec
                </Link>
              </div>
            </div>

            {/* Playwright Script Generation Eligibility Banner (§3.4, §3.5) */}
            {canProceedInfo?.canProceed ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Approved &amp; Ready for Playwright Script Generation (§3.5)
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 text-xs">
                      {canProceedInfo.approvedTestCases.length} of {canProceedInfo.totalTestCases}{' '}
                      test cases approved. Quality Gate rule satisfied.
                    </span>
                  </div>
                </div>
                <Link
                  to="/validation"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 shadow-sm transition-colors whitespace-nowrap"
                >
                  Validation Pipeline <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  <strong>Gate Prerequisite:</strong> Only test cases with status{' '}
                  <code className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Approved
                  </code>{' '}
                  can proceed to autonomous Playwright script generation (§3.4, §3.5).
                </span>
              </div>
            )}
          </div>

          {/* Test Case Selection Matrix */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-500" />
                  Candidate Test Cases for Review ({candidateCases.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the test cases you wish to authorize for automation script generation.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllTestCases}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAllTestCases}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {candidateCases.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <p>No test cases generated yet for this specification.</p>
                <Link
                  to={`/specs/${specPayload.specId}`}
                  className="text-indigo-600 dark:text-indigo-400 font-medium underline inline-block"
                >
                  Go to Specification Viewer to Generate Test Cases (§3.3)
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {candidateCases.map((tc) => {
                  const isChecked = selectedTestCases.includes(tc.id);
                  const isExpanded = expandedCaseId === tc.id;

                  return (
                    <div
                      key={tc.id}
                      className={`rounded-xl border transition-colors ${
                        isChecked
                          ? 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                      }`}
                    >
                      <div className="p-3.5 flex items-start gap-3">
                        <label className="flex items-center mt-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTestCase(tc.id)}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 rounded"
                          />
                        </label>

                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {tc.id}
                            </span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {tc.priority}
                            </span>
                            <span className="text-[11px] text-slate-500 capitalize font-medium">
                              {tc.testType}
                            </span>
                            <span className="text-[11px] text-slate-500 capitalize">
                              {tc.targetPlatform}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                                tc.automationSuitability === 'automatable'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                              }`}
                            >
                              {tc.automationSuitability}
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                            {tc.title}
                          </h4>

                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                            <span>{tc.testSteps?.length || 0} Test Steps</span>
                            <button
                              type="button"
                              onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                              className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 hover:underline"
                            >
                              {isExpanded ? (
                                <>
                                  Hide steps <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  View steps <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Test Steps */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2 animate-fadeIn">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                            Steps to Execute:
                          </span>
                          <ol className="space-y-1 list-decimal list-inside text-slate-600 dark:text-slate-400">
                            {tc.testSteps?.map((st) => (
                              <li key={st.stepNumber}>
                                <strong className="text-slate-700 dark:text-slate-200">
                                  {st.action}:
                                </strong>{' '}
                                <span>{st.expectedResult}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reviewer Decision Form Panel */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                Submit Approval Decision (§3.4)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provide reviewer attribution and notes to record official approval or trigger
                corrective loops.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="reviewer-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Reviewer Identity <span className="text-red-500">*</span>
                </label>
                <input
                  id="reviewer-name"
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Lead QA Engineer"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="reviewer-comments"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Reviewer Comments &amp; Notes{' '}
                    <span className="text-slate-400 font-normal">
                      (Mandatory for Reject &amp; Needs Clarification)
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Recorded in approval-record.json
                  </span>
                </div>
                <textarea
                  id="reviewer-comments"
                  rows={3}
                  value={reviewerComments}
                  onChange={(e) => setReviewerComments(e.target.value)}
                  placeholder="Enter evaluation notes, clarification inquiries, or reason for approval / rejection..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Decision Actions Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <span>
                  Selected for approval:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {selectedTestCases.length}
                  </strong>{' '}
                  of {candidateCases.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mark Under Review button */}
                <button
                  type="button"
                  disabled={submittingDecision}
                  onClick={() => handleDecision('Under Review')}
                  className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Mark Under Review
                </button>

                {/* Needs Clarification button */}
                <button
                  type="button"
                  disabled={submittingDecision}
                  onClick={() => handleDecision('Needs Clarification')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Needs Clarification
                </button>

                {/* Reject button */}
                <button
                  type="button"
                  disabled={submittingDecision}
                  onClick={() => handleDecision('Rejected')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 dark:bg-red-950/70 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Test Cases
                </button>

                {/* Approve button */}
                <button
                  type="button"
                  disabled={submittingDecision || candidateCases.length === 0}
                  onClick={() => handleDecision('Approved')}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingDecision ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Approve Selected Test Cases
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Autonomous Loopback Panel (§3.4) */}
          {(showLoopbackPanel ||
            currentStatus === 'Rejected' ||
            currentStatus === 'Needs Clarification') && (
            <div className="p-6 bg-gradient-to-r from-red-50/50 via-amber-50/30 to-slate-50 dark:from-slate-900 dark:via-red-950/20 dark:to-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-950 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Autonomous Correction Loopback (§3.4)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Because this specification is in{' '}
                    <strong className="text-red-600 dark:text-red-400">{currentStatus}</strong>{' '}
                    state, it must loop back to the generation stage with reviewer guidance before
                    it can be re-evaluated.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                <div className="space-y-1 sm:col-span-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Regeneration Target
                  </label>
                  <select
                    value={loopbackStage}
                    onChange={(e) => setLoopbackStage(e.target.value as LoopbackStage)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="all">All (Specification &amp; Test Cases)</option>
                    <option value="spec">Specification Only</option>
                    <option value="test-cases">Test Cases Only</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Corrective Feedback for LLM
                  </label>
                  <input
                    type="text"
                    value={loopbackFeedback}
                    onChange={(e) => setLoopbackFeedback(e.target.value)}
                    placeholder="e.g. Ensure all alternate flows verify session timeout..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  disabled={submittingLoopback}
                  onClick={handleExecuteLoopback}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {submittingLoopback ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Regenerating with {selectedProvider}...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Trigger Autonomous Regeneration Loopback
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Review Audit History Timeline */}
          {historyEntries.length > 0 && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
                Approval Audit Trail ({historyEntries.length} events)
              </h3>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {historyEntries.map((h, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 text-xs">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 z-10 text-[10px] font-bold">
                      {idx + 1}
                    </div>

                    <div className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {h.reviewer}
                          </span>
                          <span className="text-slate-400">transitioned</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">
                            {h.fromStatus}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                            {h.toStatus}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {h.comments && (
                        <p className="text-slate-600 dark:text-slate-300 italic pt-1">
                          &ldquo;{h.comments}&rdquo;
                        </p>
                      )}

                      {h.approvedTestCases && h.approvedTestCases.length > 0 && (
                        <div className="pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ {h.approvedTestCases.length} test cases approved: [
                          {h.approvedTestCases.join(', ')}]
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
