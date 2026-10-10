import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { ApprovalGateView } from '../components/approval/ApprovalGateView';

export const ApprovalPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileCheck2
            className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          Approval Gate (§3.4)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review candidate test cases, submit human approval decisions, and manage
          rejection/clarification loops before Playwright script generation.
        </p>
      </div>

      {/* Main Approval Gate Interface */}
      <ApprovalGateView />
    </div>
  );
};
