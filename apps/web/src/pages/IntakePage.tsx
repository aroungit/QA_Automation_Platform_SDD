import React from 'react';
import { Bot, Layers, PlusCircle } from 'lucide-react';
import { StorySubmissionForm } from '../components/intake/StorySubmissionForm';
import { useLLM } from '../providers/LLMContext';

export const IntakePage: React.FC = () => {
  const { selectedProvider, selectedModel } = useLLM();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PlusCircle
              className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
              aria-hidden="true"
            />
            User Story Intake (§3.1)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Submit user stories with acceptance criteria to autonomously generate specifications and
            candidate test cases.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 self-start sm:self-auto font-medium">
          <Bot className="w-3.5 h-3.5 text-indigo-500" />
          <span>
            Active LLM: <strong className="uppercase">{selectedProvider}</strong> ({selectedModel})
          </span>
        </div>
      </div>

      {/* SDD Pipeline Explainer Banner */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 rounded-xl border border-indigo-100 dark:border-slate-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200 shrink-0">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Spec-Driven Lifecycle:
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-semibold text-indigo-600 dark:text-indigo-400">
            1. User Story (§3.1)
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-semibold text-indigo-600 dark:text-indigo-400">
            2. Specification (§3.2)
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-semibold text-indigo-600 dark:text-indigo-400">
            3. Test Cases (§3.3)
          </span>
          <span>→</span>
          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
            4. Approval Gate (§3.4)
          </span>
        </div>
      </div>

      {/* Story Submission Form */}
      <StorySubmissionForm />
    </div>
  );
};
