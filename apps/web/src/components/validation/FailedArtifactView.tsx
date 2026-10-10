import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Copy,
  FileCode,
  FileJson,
  Folder,
  FolderArchive,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ValidationReport } from '@qaa/shared';
import { api } from '../../services/api';

export interface FailedArtifactViewProps {
  specId: string;
  report: ValidationReport | null;
  onHealRequested?: (targetFile?: string) => void;
  onWorkspaceCleaned?: () => void;
}

export const FailedArtifactView: React.FC<FailedArtifactViewProps> = ({
  specId,
  report,
  onHealRequested,
  onWorkspaceCleaned,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [workspaceDir, setWorkspaceDir] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadWorkspaceFiles = async () => {
    setLoading(true);
    try {
      const res = await api.listWorkspaceFiles();
      setFiles(res.files);
      setWorkspaceDir(res.workspaceDir);
      if (res.files.length > 0 && !selectedFile) {
        // Prefer selecting a test file or first file
        const testFile = res.files.find((f) => f.includes('tests/')) || res.files[0];
        setSelectedFile(testFile ?? null);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceFiles();
  }, [specId]);

  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      return;
    }

    let mounted = true;
    setLoadingContent(true);
    api
      .getWorkspaceFile(selectedFile)
      .then((res) => {
        if (mounted) setFileContent(res.content);
      })
      .catch(() => {
        if (mounted) setFileContent('// Failed to read workspace file');
      })
      .finally(() => {
        if (mounted) setLoadingContent(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedFile]);

  const handleCopy = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClean = async () => {
    if (!window.confirm('Are you sure you want to clean the temporary workspace?')) return;
    setCleaning(true);
    try {
      await api.cleanWorkspace();
      setSelectedFile(null);
      setFileContent(null);
      await loadWorkspaceFiles();
      onWorkspaceCleaned?.();
    } catch (err) {
      alert(`Failed to clean workspace: ${String(err)}`);
    } finally {
      setCleaning(false);
    }
  };

  const getFileCategory = (filePath: string) => {
    if (filePath.includes('/tests/')) return 'tests';
    if (filePath.includes('/pages/')) return 'pages';
    if (filePath.includes('/fixtures/')) return 'fixtures';
    if (filePath.includes('/utils/')) return 'utils';
    if (filePath.endsWith('.config.ts') || filePath.endsWith('tsconfig.json')) return 'configs';
    if (filePath.includes('test-results/')) return 'reports';
    return 'other';
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || getFileCategory(f) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const failedTests = report?.dynamicValidation.tests.filter((t) => t.status === 'failed') ?? [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn space-y-0">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Temporary Workspace &amp; Failed Artifact Inspector (§3.7)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            SDD rule: Unapproved or failed scripts remain in{' '}
            <code className="bg-slate-200/60 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">
              .workspace
            </code>{' '}
            until validated and promoted.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadWorkspaceFiles}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh workspace files"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleClean}
            disabled={cleaning || files.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Wipe .workspace directory"
          >
            {cleaning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Clean Workspace</span>
          </button>
        </div>
      </div>

      {/* Failure Alert Banner (if there are failed tests) */}
      {failedTests.length > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Failed Automation Artifacts Detected ({failedTests.length})
            </span>
            {onHealRequested && (
              <button
                type="button"
                onClick={() => onHealRequested(selectedFile || undefined)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Heal Failing Scripts</span>
              </button>
            )}
          </div>
          <div className="space-y-1">
            {failedTests.map((ft) => (
              <div key={ft.testCaseId} className="font-mono text-[11px] flex items-start gap-2">
                <span className="font-bold text-rose-900 dark:text-rose-300">[{ft.testCaseId}]</span>
                <span className="truncate">{ft.error || 'Test assertion failed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Directory Bar */}
      <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate flex items-center justify-between">
        <span className="truncate">CWD / .workspace: {workspaceDir || '.workspace/'}</span>
        <span className="shrink-0">{files.length} Total Files</span>
      </div>

      {/* Main Workspace Split: File Explorer & Code Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
        {/* Left: Files List (4 columns) */}
        <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-800 p-3 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {['all', 'tests', 'pages', 'fixtures', 'configs'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-full capitalize font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Files List */}
          <div className="space-y-1 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading workspace...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {files.length === 0
                  ? 'Temporary workspace is empty. Run script generation or validation to populate.'
                  : 'No files match the filter.'}
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFile === file;
                const isTest = file.includes('tests/');
                const isPage = file.includes('pages/');
                const isFailed = failedTests.some(
                  (ft) => file.includes(ft.testCaseId) || file.includes(specId),
                );

                return (
                  <button
                    key={file}
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left font-mono text-xs transition-colors flex items-center justify-between gap-2 focus:outline-none ${
                      isSelected
                        ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isTest ? (
                        <FileCode className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      ) : isPage ? (
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <FileJson className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{file}</span>
                    </div>

                    {isFailed && !report?.overallStatus?.includes('PASSED') && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Failure" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Code / Artifact Viewer (8 columns) */}
        <div className="md:col-span-8 flex flex-col bg-slate-950 text-slate-200">
          {/* File Header Bar */}
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono text-indigo-300 truncate">
              <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">{selectedFile || 'No file selected'}</span>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1 transition-colors"
                  title="Copy file content"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Code Body */}
          <div className="flex-1 p-4 overflow-auto max-h-[480px] font-mono text-xs leading-relaxed">
            {loadingContent ? (
              <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reading workspace file...</span>
              </div>
            ) : fileContent !== null ? (
              <pre className="text-slate-300 whitespace-pre font-mono text-[11px] leading-5">
                {fileContent}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-600">
                Select a workspace file on the left to inspect its code.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
