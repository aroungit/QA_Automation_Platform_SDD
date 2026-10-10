import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  Bot,
  FileText,
  PlusCircle,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { SpecSummaryItem } from '@qaa/shared';
import { useLLM } from '../providers/LLMContext';
import { api } from '../services/api';

export const HomePage: React.FC = () => {
  const { selectedProvider, selectedModel } = useLLM();
  const [specs, setSpecs] = useState<SpecSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .listSpecs()
      .then((data) => {
        if (mounted) setSpecs(data);
      })
      .catch((err) => console.warn('Could not load specs:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalSpecs = specs.length;
  const approvedSpecs = specs.filter((s) => s.status === 'Approved').length;
  const promotedSpecs = specs.filter((s) => s.promoted).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-10 border border-indigo-800/50 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Spec-Driven Development (SDD)
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            QA_Automation_Platform_Agent
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Transform user stories into formal specifications, candidate test cases, verified
            Playwright scripts, and release-ready automation artifacts with automated validation and
            8 quality gates.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/intake"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Start New Story Intake
            </Link>

            <Link
              to="/specs"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-sm border border-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Browse Specifications
            </Link>

            <Link
              to="/repository"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-sm border border-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
              Repository &amp; Gates
            </Link>
          </div>
        </div>

        {/* Hero Title Image Decorative Element */}
        <div className="hidden lg:block absolute -right-10 -bottom-10 opacity-20 pointer-events-none w-96 h-96">
          <img src="/logo.svg" alt="" className="w-full h-full object-contain filter blur-xs" />
        </div>
      </section>

      {/* Quick Metrics Bar */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total Specifications
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {loading ? '...' : totalSpecs}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Approved Test Suites
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '...' : approvedSpecs}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Promoted Artifacts
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {loading ? '...' : promotedSpecs}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Bot className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" /> Active LLM
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 uppercase tracking-wide truncate">
            {selectedProvider}
          </div>
          <div
            className="text-[11px] text-slate-400 dark:text-slate-500 truncate"
            title={selectedModel}
          >
            {selectedModel}
          </div>
        </div>
      </section>

      {/* End-to-End Workflow (§6) Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            End-to-End SDD Workflow (§6)
          </h2>
          <span className="text-xs text-slate-500">6 Continuous Stages</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Story Intake &amp; Spec Generation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Accept user story and acceptance criteria. Generates structured Specification and
              candidate Test Cases.
            </p>
            <Link
              to="/intake"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline pt-2"
            >
              Launch intake <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 2 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Approval Gate (§3.4)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Human reviewer reviews and approves test cases. Only approved test cases proceed to
              Playwright generation.
            </p>
            <Link
              to="/approval"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline pt-2"
            >
              Review approvals <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 3 */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Playwright POM &amp; Auto-Healing (§3.5, §3.6)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Generates TypeScript Page Object Model scripts, runs static &amp; dynamic validation,
              and auto-heals failures.
            </p>
            <Link
              to="/validation"
              className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 font-medium hover:underline pt-2"
            >
              Validation reports <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quality Gates Section (§8) */}
      <section className="p-6 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs tracking-wide uppercase">
            <Shield className="w-4 h-4" aria-hidden="true" />
            Strict Quality Gates (§8)
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            8 Mandatory Verification Gates Before Promotion
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unapproved or failing scripts remain quarantined in the temporary workspace. Only
            passing, traceable scripts that meet all 8 gates are committed to the repository.
          </p>
        </div>

        <Link
          to="/repository"
          className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
        >
          View Quality Gate Status
        </Link>
      </section>
    </div>
  );
};
