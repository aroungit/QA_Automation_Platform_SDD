import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { SpecSummaryItem } from '@qaa/shared';
import { api } from '../services/api';

export const SpecsListPage: React.FC = () => {
  const [specs, setSpecs] = useState<SpecSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchSpecs = () => {
    setLoading(true);
    setError(null);
    api
      .listSpecs()
      .then((data) => {
        setSpecs(data || []);
      })
      .catch((err) => {
        console.warn('Could not load specs:', err);
        setError((err as Error).message || 'Failed to load specifications.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSpecs();
  }, []);

  const filtered = specs.filter((s) => {
    const matchesSearch =
      s.specId.toLowerCase().includes(search.toLowerCase()) ||
      (s.title && s.title.toLowerCase().includes(search.toLowerCase())) ||
      (s.targetApp && s.targetApp.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            Specifications &amp; Test Cases
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse and inspect formal specifications and candidate test cases generated from user
            stories (§3.1–3.3, §3.7).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchSpecs}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
            title="Refresh specifications"
            aria-label="Refresh specifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            New Story Intake
          </Link>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between text-xs sm:text-sm text-red-700 dark:text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchSpecs}
            className="text-xs font-semibold underline hover:text-red-900 dark:hover:text-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls Bar: Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative max-w-md w-full">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="search-specs" className="sr-only">
            Search specifications
          </label>
          <input
            id="search-specs"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Spec ID, Title, or Target App..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium overflow-x-auto">
          {['all', 'Draft', 'Under Review', 'Approved', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors capitalize ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* List or Table */}
      {loading ? (
        <div className="p-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-xs sm:text-sm text-slate-400 font-medium">Loading specifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
          <FileText className="w-10 h-10 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">
            No specifications found
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {specs.length === 0
              ? 'Submit a user story to generate your first specification and candidate test cases.'
              : 'No specifications match your search or filter criteria. Try resetting your query.'}
          </p>
          <Link
            to="/intake"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl mt-2 hover:bg-indigo-500 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Start Intake
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((spec) => (
            <Link
              key={spec.specId}
              to={`/specs/${spec.specId}`}
              className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    {spec.specId}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      spec.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                        : spec.status === 'Under Review'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                          : spec.status === 'Rejected'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {spec.status}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {spec.title || 'Untitled Specification'}
                </h3>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {spec.testCaseCount || 0} Test Cases
                  </span>
                  <span>•</span>
                  <span className="capitalize">{spec.platform || 'web'}</span>
                  <span>•</span>
                  <span>{spec.targetApp || 'OrangeHRM'}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  {spec.promoted ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> Promoted
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      {spec.hasSpecification ? 'Spec Ready' : 'Draft'}
                    </span>
                  )}
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Inspect <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
