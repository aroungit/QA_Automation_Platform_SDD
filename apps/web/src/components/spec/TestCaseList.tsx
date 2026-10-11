import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Monitor,
  Search,
  Smartphone,
  X,
} from 'lucide-react';
import type { AutomationSuitability, Priority, TestCase } from '@qaa/shared';

interface TestCaseListProps {
  testCases: TestCase[];
  specId: string;
}

export const TestCaseList: React.FC<TestCaseListProps> = ({ testCases, specId }) => {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [suitabilityFilter, setSuitabilityFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  // Selected test case for detail modal
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Keyboard accessibility & scroll lock for detail modal
  React.useEffect(() => {
    if (!selectedCase) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCase(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedCase]);

  // Filter logic
  const filtered = testCases.filter((tc) => {
    const matchesSearch =
      tc.id.toLowerCase().includes(search.toLowerCase()) ||
      tc.title.toLowerCase().includes(search.toLowerCase()) ||
      tc.testSteps.some((s) => s.action.toLowerCase().includes(search.toLowerCase()));

    const matchesPriority = priorityFilter === 'all' || tc.priority === priorityFilter;
    const matchesType = typeFilter === 'all' || tc.testType === typeFilter;
    const matchesSuitability =
      suitabilityFilter === 'all' || tc.automationSuitability === suitabilityFilter;
    const matchesPlatform = platformFilter === 'all' || tc.targetPlatform === platformFilter;

    return matchesSearch && matchesPriority && matchesType && matchesSuitability && matchesPlatform;
  });

  const getPriorityBadgeClass = (priority: Priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border-red-200 dark:border-red-900';
      case 'high':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 border-orange-200 dark:border-orange-900';
      case 'medium':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 'low':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getSuitabilityBadgeClass = (suitability: AutomationSuitability) => {
    switch (suitability) {
      case 'automatable':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      case 'manual-only':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      case 'needs-clarification':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900';
    }
  };

  const getTraceabilityComment = (tc: TestCase) => {
    return `// Spec ID: ${specId}\n// Test Case ID: ${tc.id}\n// Target Platform: ${tc.targetPlatform}\n// Automation Suitability: ${tc.automationSuitability}\n// Source: Candidate test case — ${tc.title}`;
  };

  const copyTraceabilitySnippet = (tc: TestCase) => {
    navigator.clipboard.writeText(getTraceabilityComment(tc));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="testcase-search" className="sr-only">
              Search candidate test cases
            </label>
            <input
              id="testcase-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Test Case ID, Title, or Action..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap self-end md:self-center">
            Showing{' '}
            <strong className="text-indigo-600 dark:text-indigo-400">{filtered.length}</strong> of{' '}
            {testCases.length} Test Cases
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Priority */}
          <div>
            <label htmlFor="filter-priority" className="sr-only">
              Filter by Priority
            </label>
            <select
              id="filter-priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Test Type */}
          <div>
            <label htmlFor="filter-type" className="sr-only">
              Filter by Test Type
            </label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="functional">Functional</option>
              <option value="negative">Negative</option>
              <option value="boundary">Boundary</option>
              <option value="regression">Regression</option>
              <option value="accessibility">Accessibility</option>
              <option value="smoke">Smoke</option>
            </select>
          </div>

          {/* Suitability */}
          <div>
            <label htmlFor="filter-suitability" className="sr-only">
              Filter by Automation Suitability
            </label>
            <select
              id="filter-suitability"
              value={suitabilityFilter}
              onChange={(e) => setSuitabilityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Suitability</option>
              <option value="automatable">Automatable</option>
              <option value="manual-only">Manual Only</option>
              <option value="needs-clarification">Needs Clarification</option>
            </select>
          </div>

          {/* Platform */}
          <div>
            <label htmlFor="filter-platform" className="sr-only">
              Filter by Platform
            </label>
            <select
              id="filter-platform"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <ClipboardList className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No Test Cases Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {testCases.length === 0
              ? 'Candidate test cases have not been generated yet for this specification (§3.3).'
              : 'No test cases matched the selected search or filter criteria. Try resetting filters.'}
          </p>
        </div>
      )}

      {/* RESPONSIVE LAYOUT (§W2): Tables on Desktop/Tablet (md: and up), Cards on Small/Mobile screens */}
      {filtered.length > 0 && (
        <>
          {/* DESKTOP TABLE VIEW (hidden on small screens, shown md and above) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="py-3 px-4 font-semibold w-28">Test ID</th>
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-3 font-semibold w-24">Priority</th>
                    <th className="py-3 px-3 font-semibold w-28">Type</th>
                    <th className="py-3 px-3 font-semibold w-20">Platform</th>
                    <th className="py-3 px-3 font-semibold w-32">Suitability</th>
                    <th className="py-3 px-3 font-semibold w-20 text-center">Steps</th>
                    <th className="py-3 px-4 font-semibold w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filtered.map((tc) => (
                    <tr
                      key={tc.id}
                      onClick={() => setSelectedCase(tc)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {tc.id}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        {tc.title}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadgeClass(
                            tc.priority,
                          )}`}
                        >
                          {tc.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="capitalize text-slate-600 dark:text-slate-400 font-medium">
                          {tc.testType}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 capitalize text-slate-600 dark:text-slate-400">
                        {tc.targetPlatform}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSuitabilityBadgeClass(
                            tc.automationSuitability,
                          )}`}
                        >
                          {tc.automationSuitability}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-500">
                        {tc.testSteps?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCase(tc);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD VIEW (shown below md, hidden on desktop) */}
          <div className="md:hidden space-y-3">
            {filtered.map((tc) => (
              <div
                key={tc.id}
                onClick={() => setSelectedCase(tc)}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
              >
                {/* Header: ID + Priority */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {tc.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadgeClass(
                      tc.priority,
                    )}`}
                  >
                    {tc.priority}
                  </span>
                </div>

                {/* Title */}
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {tc.title}
                </h4>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium capitalize">
                    {tc.testType}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-medium capitalize flex items-center gap-1">
                    {tc.targetPlatform === 'web' ? (
                      <Monitor className="w-3 h-3" />
                    ) : (
                      <Smartphone className="w-3 h-3" />
                    )}
                    {tc.targetPlatform}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold border ${getSuitabilityBadgeClass(
                      tc.automationSuitability,
                    )}`}
                  >
                    {tc.automationSuitability}
                  </span>
                </div>

                {/* Footer with steps and view details */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{tc.testSteps?.length || 0} Test Steps</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    Inspect <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* DETAIL MODAL / DRAWER */}
      {selectedCase && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="testcase-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedCase(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedCase.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadgeClass(
                      selectedCase.priority,
                    )}`}
                  >
                    {selectedCase.priority}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSuitabilityBadgeClass(
                      selectedCase.automationSuitability,
                    )}`}
                  >
                    {selectedCase.automationSuitability}
                  </span>
                </div>
                <h3
                  id="testcase-detail-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {selectedCase.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close test case details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Test Type
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {selectedCase.testType}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Target Platform
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {selectedCase.targetPlatform}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Parent Spec
                  </span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {specId}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Suitability
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {selectedCase.automationSuitability}
                  </span>
                </div>
              </div>

              {/* Preconditions */}
              {selectedCase.preconditions && selectedCase.preconditions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Preconditions
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                    {selectedCase.preconditions.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Test Steps Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Test Execution Steps ({selectedCase.testSteps?.length || 0})
                </h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                        <th className="py-2.5 px-3 w-14 font-semibold">#</th>
                        <th className="py-2.5 px-3 font-semibold">Action</th>
                        <th className="py-2.5 px-3 font-semibold">Expected Step Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                      {selectedCase.testSteps?.map((st) => (
                        <tr
                          key={st.stepNumber}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          <td className="py-2.5 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {st.stepNumber}
                          </td>
                          <td className="py-2.5 px-3 font-medium">{st.action}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {st.expectedResult}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expected Results */}
              {selectedCase.expectedResults && selectedCase.expectedResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Expected Overall Verification Results
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {selectedCase.expectedResults.map((er, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{er}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Playwright Traceability Header (§3.5) */}
              <div className="p-4 bg-slate-950 text-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Traceability Comment Header (§3.5)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyTraceabilitySnippet(selectedCase)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Comment
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                  {getTraceabilityComment(selectedCase)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
