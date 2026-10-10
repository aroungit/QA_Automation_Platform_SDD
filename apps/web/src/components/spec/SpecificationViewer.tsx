import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileCheck2,
  FileCode2,
  FileText,
  Layers,
  ListOrdered,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import type { SpecArtifactsPayload, Specification } from '@qaa/shared';
import { useLLM } from '../../providers/LLMContext';
import { api } from '../../services/api';

interface SpecificationViewerProps {
  spec: SpecArtifactsPayload;
  onRefresh?: () => void;
}

export const SpecificationViewer: React.FC<SpecificationViewerProps> = ({ spec, onRefresh }) => {
  const { selectedProvider } = useLLM();
  const [activeTab, setActiveTab] = useState<'structured' | 'markdown' | 'json'>('structured');
  const [copied, setCopied] = useState<string | null>(null);

  // Regeneration state
  const [showFeedbackModal, setShowFeedbackModal] = useState<null | 'spec' | 'test-cases'>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const specJson: Specification | undefined = spec.specificationJson;
  const rawMarkdown = spec.specification || '';
  const rawJson = specJson ? JSON.stringify(specJson, null, 2) : '';

  const handleCopy = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenerateSpec = async () => {
    setRegenerating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.generateSpec(spec.specId, feedbackText.trim() || undefined);
      setActionSuccess('Specification regenerated successfully (§3.2).');
      setShowFeedbackModal(null);
      setFeedbackText('');
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to regenerate specification.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerateTestCases = async () => {
    setRegenerating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.generateTestCases(spec.specId, feedbackText.trim() || undefined);
      setActionSuccess('Candidate test cases generated successfully (§3.3).');
      setShowFeedbackModal(null);
      setFeedbackText('');
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to generate test cases.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Banners */}
      {actionSuccess && (
        <div
          role="alert"
          className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-xs underline hover:text-emerald-900 dark:hover:text-emerald-100 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between text-xs sm:text-sm text-red-800 dark:text-red-300 animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs underline hover:text-red-900 dark:hover:text-red-100 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* View switcher tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('structured')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'structured'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Structured Spec
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('markdown')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'markdown'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Markdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'json'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" /> JSON
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            disabled={regenerating}
            onClick={() => setShowFeedbackModal('spec')}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate Spec (§3.2)
          </button>

          <button
            type="button"
            disabled={regenerating}
            onClick={() => setShowFeedbackModal('test-cases')}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Test Cases (§3.3)
          </button>

          <Link
            to={`/approval?specId=${spec.specId}`}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Approval Gate (§3.4)
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Feedback & Regeneration Modal */}
      {showFeedbackModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-lg space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              {showFeedbackModal === 'spec'
                ? 'Regenerate Formal Specification (§3.2)'
                : 'Generate / Regenerate Candidate Test Cases (§3.3)'}
            </h3>
            <span className="text-[11px] font-mono text-slate-400 uppercase">
              Using {selectedProvider}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {showFeedbackModal === 'spec'
              ? 'You can provide optional reviewer feedback or corrective instructions for the LLM to refine the formal specification flows, data requirements, or acceptance criteria.'
              : 'You can provide guidance or focus areas (e.g. "Focus on boundary conditions for username length and SQL injection attempts") for the candidate test case generator.'}
          </p>

          <div className="space-y-1">
            <label
              htmlFor="regeneration-feedback"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              Optional Reviewer Feedback / Guidance
            </label>
            <textarea
              id="regeneration-feedback"
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. Ensure all alternate flows verify session timeout and invalid token responses..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={regenerating}
              onClick={() => {
                setShowFeedbackModal(null);
                setFeedbackText('');
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={regenerating}
              onClick={
                showFeedbackModal === 'spec' ? handleRegenerateSpec : handleRegenerateTestCases
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating with {selectedProvider}...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirm &amp; Run Generation
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      {activeTab === 'markdown' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-500">specification.md</span>
            <button
              type="button"
              onClick={() => handleCopy(rawMarkdown, 'markdown')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              {copied === 'markdown' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Markdown
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-[600px]">
            {rawMarkdown || '# No specification markdown content available.'}
          </pre>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-500">
              specification.json
            </span>
            <button
              type="button"
              onClick={() => handleCopy(rawJson, 'json')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              {copied === 'json' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy JSON
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-indigo-300 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-[600px]">
            {rawJson || '{\n  "error": "No JSON specification available"\n}'}
          </pre>
        </div>
      )}

      {activeTab === 'structured' && !specJson && (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <FileText className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Formal Specification Generated Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This specification has not been converted to formal structures yet. Click below to run
            autonomous specification generation (§3.2).
          </p>
          <button
            type="button"
            onClick={() => setShowFeedbackModal('spec')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Specification Now
          </button>
        </div>
      )}

      {activeTab === 'structured' && specJson && (
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Target App
              </span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {specJson.targetApp || 'OrangeHRM'}
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Environment
              </span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block capitalize">
                {specJson.environment || 'default'}
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Actors
              </span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {specJson.actors?.length || 0} Defined
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Main Flow Steps
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                {specJson.mainFlow?.length || 0} Steps
              </span>
            </div>
          </div>

          {/* Business Objective & Actors */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Business Objective
              </h3>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {specJson.businessObjective}
              </p>
            </div>

            {/* Actors */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Actors &amp; Personas
              </span>
              <div className="flex flex-wrap gap-2">
                {specJson.actors?.map((actor, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>

            {/* Preconditions */}
            {specJson.preconditions && specJson.preconditions.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Preconditions
                </span>
                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                  {specJson.preconditions.map((pre, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {pre}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Main Flow (Step Table) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-500" />
                Main Execution Flow
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {specJson.mainFlow?.length || 0} Sequential Steps
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 w-16 font-semibold">Step</th>
                    <th className="py-2.5 px-3 font-semibold">User Action</th>
                    <th className="py-2.5 px-3 font-semibold">System Expected Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {specJson.mainFlow?.map((step) => (
                    <tr key={step.step} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {step.step}
                      </td>
                      <td className="py-3 px-3 font-medium">{step.action}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {step.expected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alternate & Exception Flows Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alternate Flows */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Alternate Flows ({specJson.alternateFlows?.length || 0})
              </h3>
              {(!specJson.alternateFlows || specJson.alternateFlows.length === 0) && (
                <p className="text-xs text-slate-400">No alternate flows defined.</p>
              )}
              <div className="space-y-3">
                {specJson.alternateFlows?.map((flow, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5"
                  >
                    <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 block">
                      {flow.name}
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                      {flow.steps.map((st, sIdx) => (
                        <li key={sIdx}>{st}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Exception Flows */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Exception Flows (
                {specJson.exceptionFlows?.length || 0})
              </h3>
              {(!specJson.exceptionFlows || specJson.exceptionFlows.length === 0) && (
                <p className="text-xs text-slate-400">No exception flows defined.</p>
              )}
              <div className="space-y-3">
                {specJson.exceptionFlows?.map((flow, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1"
                  >
                    <span className="font-semibold text-xs text-amber-600 dark:text-amber-400 block">
                      {flow.name}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300">Condition:</strong>{' '}
                      {flow.condition}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300">Action:</strong>{' '}
                      {flow.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Requirements & Acceptance Criteria Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Requirements Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-500" /> Data Requirements (
                {specJson.dataRequirements?.length || 0})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                      <th className="py-2 px-2 font-semibold">Field</th>
                      <th className="py-2 px-2 font-semibold">Type</th>
                      <th className="py-2 px-2 font-semibold">Validation Rules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-300">
                    {specJson.dataRequirements?.map((dr, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-2 font-mono font-medium text-slate-900 dark:text-slate-200">
                          {dr.field}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {dr.type}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500 dark:text-slate-400">
                          {dr.rules}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acceptance Criteria */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Acceptance Criteria
              </h3>
              <div className="space-y-2">
                {specJson.acceptanceCriteria?.map((ac, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{ac}</span>
                  </div>
                ))}
              </div>

              {/* Non-Functional Requirements */}
              {specJson.nonFunctionalRequirements &&
                specJson.nonFunctionalRequirements.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Non-Functional Requirements
                    </span>
                    <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400 list-disc list-inside">
                      {specJson.nonFunctionalRequirements.map((nfr, idx) => (
                        <li key={idx}>{nfr}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
