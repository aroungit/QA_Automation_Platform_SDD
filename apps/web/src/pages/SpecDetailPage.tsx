import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  FileCheck2,
  FileText,
  FolderTree,
  ListChecks,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { SpecArtifactsPayload } from '@qaa/shared';
import { SpecificationViewer } from '../components/spec/SpecificationViewer';
import { TestCaseList } from '../components/spec/TestCaseList';
import { api } from '../services/api';

export const SpecDetailPage: React.FC = () => {
  const { specId } = useParams<{ specId: string }>();

  const [spec, setSpec] = useState<SpecArtifactsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spec' | 'test-cases' | 'user-story' | 'files'>(
    'spec',
  );

  const loadSpec = async () => {
    if (!specId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSpec(specId);
      setSpec(data);
    } catch (err) {
      console.error('Failed to load spec details:', err);
      setError((err as Error).message || `Failed to load specification "${specId}".`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpec();
  }, [specId]);

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4 animate-fadeIn">
        <Loader2 className="w-8 h-8 mx-auto text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Loading specification {specId}...
        </p>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-sm space-y-4 text-center animate-fadeIn">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Specification Error</h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          {error || `Specification "${specId}" could not be found.`}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadSpec}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Retry
          </button>
          <Link
            to="/specs"
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-500 transition-colors"
          >
            Back to Specifications
          </Link>
        </div>
      </div>
    );
  }

  const userStory = spec.userStoryJson;
  const testCases = spec.testCasesJson || [];
  const status = spec.approvalRecord?.status || 'Draft';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link
          to="/specs"
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          Specifications
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
          {spec.specId}
        </span>
      </nav>

      {/* Spec Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80">
                {spec.specId}
              </span>

              {/* Status Badge */}
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : status === 'Under Review'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : status === 'Rejected'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {status}
              </span>

              {/* Platform badge */}
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded capitalize">
                {userStory?.platform || spec.specificationJson?.environment || 'web'}
              </span>

              {/* Target App */}
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {userStory?.targetApp || spec.specificationJson?.targetApp || 'OrangeHRM'}
              </span>

              {spec.promotionRecord && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Promoted
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {spec.specificationJson?.title || userStory?.title || 'Specification Details'}
            </h1>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSpec}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
              title="Refresh specification details"
              aria-label="Refresh specification details"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              to={`/approval?specId=${spec.specId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <FileCheck2 className="w-4 h-4" />
              Approval Gate (§3.4)
            </Link>

            <Link
              to="/intake"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Intake
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 border-t border-slate-100 dark:border-slate-800 pt-3 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('spec')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'spec'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            Specification (§3.2)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test-cases')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'test-cases'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Test Cases (§3.3)
            <span className="px-1.5 py-0.2 bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-[10px] font-bold">
              {testCases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('user-story')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'user-story'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Source User Story (§3.1)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'files'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Artifact Files ({spec.files?.length || 0})
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'spec' && <SpecificationViewer spec={spec} onRefresh={loadSpec} />}

      {activeTab === 'test-cases' && <TestCaseList testCases={testCases} specId={spec.specId} />}

      {activeTab === 'user-story' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Original User Story &amp; Intake Metadata (§3.1)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Created:{' '}
              {userStory?.createdAt ? new Date(userStory.createdAt).toLocaleString() : 'N/A'}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Story Narrative
            </span>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {userStory?.story || 'No narrative provided.'}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Acceptance Criteria
            </span>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              {userStory?.acceptanceCriteria.map((ac, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs shrink-0 mt-0.5">
                    {idx + 1}.
                  </span>
                  <span>{ac}</span>
                </li>
              ))}
            </ul>
          </div>

          {spec.userStory && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-xs font-mono font-semibold text-slate-400">
                user-story.md Source
              </span>
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-xs font-mono whitespace-pre-wrap max-h-96">
                {spec.userStory}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Persisted Files in /specs/{spec.specId} (§3.7)
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {spec.files?.map((file) => (
              <div
                key={file}
                className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>{file}</span>
                </div>
                <span className="text-slate-400 text-[11px]">Artifact File</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
