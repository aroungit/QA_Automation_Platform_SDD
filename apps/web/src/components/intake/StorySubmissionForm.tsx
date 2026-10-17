import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Monitor,
  Plus,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  LLMProviderName,
  Platform,
  Priority,
  SpecArtifactsPayload,
  UserStoryIntakeRequest,
} from '@qaa/shared';
import { WorkflowNextStageBanner } from '../layout/WorkflowNextStageBanner';
import { useLLM } from '../../providers/LLMContext';
import { api } from '../../services/api';

export interface SampleStoryTemplate {
  name: string;
  title: string;
  story: string;
  acceptanceCriteria: string[];
  priority: Priority;
  platform: Platform;
  targetApp: string;
  slug?: string;
}

export const SAMPLE_TEMPLATES: SampleStoryTemplate[] = [
  {
    name: 'OrangeHRM Admin Login',
    title: 'Admin User Authentication & Role-Based Access',
    story:
      'As a Human Resources Administrator, I want to securely log in to the OrangeHRM portal using my administrator credentials so that I can manage personnel records, configure system settings, and approve requests.',
    acceptanceCriteria: [
      'Valid username and password should authenticate successfully and redirect to the Dashboard page.',
      'Invalid username or password should display an error alert "Invalid credentials" without revealing which field was incorrect.',
      'Submitting empty username or password fields should display inline validation messages "Required".',
      'Clicking "Forgot your password?" should navigate to the password reset request screen.',
    ],
    priority: 'high',
    platform: 'web',
    targetApp: 'OrangeHRM',
    slug: 'LOGIN',
  },
  {
    name: 'Employee Search & Directory',
    title: 'PIM Employee Search by Name and Employment Status',
    story:
      'As an HR Manager, I want to search and filter employees in the PIM module by their full name, employee ID, and employment status so that I can quickly access individual profiles and verify contract types.',
    acceptanceCriteria: [
      'Entering a partial or full name in the "Employee Name" autocomplete field suggests matching active records.',
      'Selecting "Full-Time Contract" filter displays only employees currently engaged under full-time contracts.',
      'Clicking "Search" populates the results data table with employee ID, first name, last name, and job title.',
      'Clicking "Reset" clears all search parameters and reloads the default paginated employee list.',
      'Searching for a non-existent identifier displays a "No Records Found" empty state indicator.',
    ],
    priority: 'medium',
    platform: 'web',
    targetApp: 'OrangeHRM',
    slug: 'EMP-SEARCH',
  },
  {
    name: 'Mobile Leave Request',
    title: 'Employee Leave Request Submission on Mobile',
    story:
      'As a mobile workforce employee, I want to apply for annual leave from my mobile browser or app so that I can schedule time off without having to access a desktop workstation.',
    acceptanceCriteria: [
      'Selecting a leave type (e.g. US - Vacation) displays the current available leave balance in days.',
      'Specifying a valid start date and end date calculates the requested duration automatically.',
      'Submitting a date range that exceeds the current leave balance shows an insufficient balance warning.',
      'Successfully submitting an eligible request creates a pending leave record and shows confirmation toast.',
    ],
    priority: 'high',
    platform: 'both',
    targetApp: 'OrangeHRM',
    slug: 'LEAVE',
  },
];

export const StorySubmissionForm: React.FC = () => {
  const navigate = useNavigate();
  const { providers, selectedProvider, selectedModel } = useLLM();

  // Form State
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(['']);
  const [priority, setPriority] = useState<Priority>('medium');
  const [platform, setPlatform] = useState<Platform>('web');
  const [targetApp, setTargetApp] = useState('OrangeHRM');
  const [slug, setSlug] = useState('');
  const [generateSpec, setGenerateSpec] = useState(true);
  const [generateTestCases, setGenerateTestCases] = useState(true);

  // Per-intake LLM override
  const [showLlmOverride, setShowLlmOverride] = useState(false);
  const [overrideProvider, setOverrideProvider] = useState<LLMProviderName>(selectedProvider);
  const [overrideModel, setOverrideModel] = useState<string>(selectedModel);

  // Status & Outcomes
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SpecArtifactsPayload | null>(null);

  // Form validation errors
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    story?: string;
    acceptanceCriteria?: string;
  }>({});

  const validate = (): boolean => {
    const errors: { title?: string; story?: string; acceptanceCriteria?: string } = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    }

    if (!story.trim()) {
      errors.story = 'User story description is required';
    }

    const validCriteria = acceptanceCriteria.filter((c) => c.trim().length > 0);
    if (validCriteria.length === 0) {
      errors.acceptanceCriteria = 'At least one acceptance criterion is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCriterion = () => {
    setAcceptanceCriteria((prev) => [...prev, '']);
  };

  const handleRemoveCriterion = (index: number) => {
    if (acceptanceCriteria.length <= 1) {
      setAcceptanceCriteria(['']);
      return;
    }
    setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCriterionChange = (index: number, value: string) => {
    setAcceptanceCriteria((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const applyTemplate = (template: SampleStoryTemplate) => {
    setTitle(template.title);
    setStory(template.story);
    setAcceptanceCriteria([...template.acceptanceCriteria]);
    setPriority(template.priority);
    setPlatform(template.platform);
    setTargetApp(template.targetApp);
    setSlug(template.slug || '');
    setValidationErrors({});
    setError(null);
    setSuccessResult(null);
  };

  const handleReset = () => {
    setTitle('');
    setStory('');
    setAcceptanceCriteria(['']);
    setPriority('medium');
    setPlatform('web');
    setTargetApp('OrangeHRM');
    setSlug('');
    setGenerateSpec(true);
    setGenerateTestCases(true);
    setValidationErrors({});
    setError(null);
    setSuccessResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    const validCriteria = acceptanceCriteria.map((c) => c.trim()).filter((c) => c.length > 0);

    const payload: UserStoryIntakeRequest = {
      title: title.trim(),
      story: story.trim(),
      acceptanceCriteria: validCriteria,
      priority,
      platform,
      targetApp: targetApp.trim() || 'OrangeHRM',
      slug: slug.trim() || undefined,
      generateSpec,
      generateTestCases,
    };

    setSubmitting(true);

    try {
      const llmHeaders = showLlmOverride
        ? { provider: overrideProvider, model: overrideModel }
        : undefined;

      const result = await api.submitIntake(payload, llmHeaders);
      setSuccessResult(result);
    } catch (err) {
      console.error('Intake submission failed:', err);
      setError((err as Error).message || 'Failed to submit user story. Please check connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // Provider info for override selector
  const activeOverrideInfo = providers.find((p) => p.name === overrideProvider);

  if (successResult) {
    const testCasesCount = successResult.testCasesJson?.length || 0;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              User Story Registered &amp; Artifacts Generated!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Your story has been autonomously transformed into formal specification artifacts
              according to Spec-Driven Development principles (§3.1–3.3).
            </p>
          </div>
        </div>

        {/* Spec Overview Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Spec ID:</span>
              <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                {successResult.specId}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
              {successResult.approvalRecord?.status || 'Draft'}
            </span>
          </div>

          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {successResult.userStoryJson?.title || title}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Platform
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                {successResult.userStoryJson?.platform || platform}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Target App
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {successResult.userStoryJson?.targetApp || targetApp}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Specification
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {successResult.specificationJson ? 'Generated (§3.2)' : 'Skipped'}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Test Cases
              </span>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                {testCasesCount} Generated (§3.3)
              </span>
            </div>
          </div>
        </div>

        {/* Workflow Next Stage Guidance Banner */}
        <WorkflowNextStageBanner
          currentStage={1}
          currentStageName="User Story Intake"
          nextStageName="Specifications & Test Cases"
          nextStagePath={`/specs/${successResult.specId}`}
          isReadyForNext={true}
          specId={successResult.specId}
          readyMessage={`Story registered as ${successResult.specId}! Formal specification & candidate test cases have been generated.`}
          actionButtonText="Proceed to Specifications & Test Cases (§3.2, §3.3)"
          guidanceTips={[
            'Inspect the generated specification main & exception flows',
            'Verify candidate test cases coverage before sending to reviewer',
          ]}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Submit Another Story
          </button>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/specs/${successResult.specId}`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
            >
              <FileText className="w-4 h-4" />
              View Specification &amp; Test Cases
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sample Templates Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick-Fill Sample Stories
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Clear Form
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              type="button"
              onClick={() => applyTemplate(tmpl)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:border-indigo-300 dark:hover:border-indigo-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors text-left"
            >
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Body */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300 text-xs sm:text-sm animate-fadeIn"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-semibold block">Intake Submission Error</span>
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs underline font-medium hover:text-red-900 dark:hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Story Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="story-title"
            className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Feature or Story Title <span className="text-red-500">*</span>
          </label>
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (validationErrors.title) {
                setValidationErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            placeholder="e.g. Admin Authentication & Role-Based Dashboard Access"
            className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              validationErrors.title
                ? 'border-red-500 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          />
          {validationErrors.title && (
            <p className="text-xs text-red-500">{validationErrors.title}</p>
          )}
        </div>

        {/* App, Priority, Platform Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Target Application */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="target-app"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Target Application
              </label>
              <button
                type="button"
                onClick={() => setTargetApp('OrangeHRM')}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                title="Reset to default test application"
              >
                Default (OrangeHRM)
              </button>
            </div>
            <input
              id="target-app"
              type="text"
              value={targetApp}
              onChange={(e) => setTargetApp(e.target.value)}
              placeholder="e.g. OrangeHRM, SauceDemo, etc."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400">
              Works across any web or mobile application. OrangeHRM is pre-configured for instant verification.
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label
              htmlFor="priority"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Business Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Target Platform */}
          <div className="space-y-1.5">
            <label
              htmlFor="platform"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Target Platform
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setPlatform('web')}
                className={`flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                  platform === 'web'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Web
              </button>
              <button
                type="button"
                onClick={() => setPlatform('mobile')}
                className={`flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                  platform === 'mobile'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
              <button
                type="button"
                onClick={() => setPlatform('both')}
                className={`flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                  platform === 'both'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Both
              </button>
            </div>
          </div>
        </div>

        {/* User Story Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="story-desc"
              className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              User Story Narrative <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400">
              Format: As a [role], I want [feature], so that [outcome]
            </span>
          </div>
          <textarea
            id="story-desc"
            rows={4}
            value={story}
            onChange={(e) => {
              setStory(e.target.value);
              if (validationErrors.story) {
                setValidationErrors((prev) => ({ ...prev, story: undefined }));
              }
            }}
            placeholder="As a [role], I want [action/capability], so that [business benefit/objective]..."
            className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              validationErrors.story
                ? 'border-red-500 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          />
          {validationErrors.story && (
            <p className="text-xs text-red-500">{validationErrors.story}</p>
          )}
        </div>

        {/* Dynamic Acceptance Criteria */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Acceptance Criteria <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddCriterion}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              <Plus className="w-3.5 h-3.5" /> Add Criterion
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Provide the measurable conditions that test cases will validate (§3.1).
          </p>

          <div className="space-y-2">
            {acceptanceCriteria.map((criterion, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={criterion}
                  onChange={(e) => handleCriterionChange(idx, e.target.value)}
                  placeholder={`Acceptance criterion ${idx + 1}...`}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCriterion(idx)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={`Remove criterion ${idx + 1}`}
                  title="Remove criterion"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {validationErrors.acceptanceCriteria && (
            <p className="text-xs text-red-500">{validationErrors.acceptanceCriteria}</p>
          )}
        </div>

        {/* Optional Slug & Generation Switches */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label
                htmlFor="optional-slug"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Custom Slug (Optional)
              </label>
              <input
                id="optional-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. AUTH or LOGIN (defaults to title prefix)"
                className="w-full sm:w-64 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Autonomous generation flags */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={generateSpec}
                  onChange={(e) => setGenerateSpec(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 w-4 h-4"
                />
                <span>Autonomously generate Specification (§3.2)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={generateTestCases}
                  onChange={(e) => setGenerateTestCases(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 w-4 h-4"
                />
                <span>Autonomously generate Candidate Test Cases (§3.3)</span>
              </label>
            </div>
          </div>
        </div>

        {/* LLM Override Accordion */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowLlmOverride(!showLlmOverride)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-1"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> LLM Generation Settings
              <span className="text-[11px] font-normal text-slate-400">
                (Default: {selectedProvider} / {selectedModel})
              </span>
            </span>
            {showLlmOverride ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showLlmOverride && (
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fadeIn">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Override Provider
                </label>
                <select
                  value={overrideProvider}
                  onChange={(e) => {
                    const p = e.target.value as LLMProviderName;
                    setOverrideProvider(p);
                    const info = providers.find((pr) => pr.name === p);
                    if (info) setOverrideModel(info.defaultModel);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {providers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName} {!p.configured ? '(demo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Override Model
                </label>
                <select
                  value={overrideModel}
                  onChange={(e) => setOverrideModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {activeOverrideInfo?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {submitting ? (
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Autonomous generation in progress...
              </span>
            ) : (
              <span>All generated artifacts are persisted to /specs (§3.7)</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Submit Story &amp; Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
