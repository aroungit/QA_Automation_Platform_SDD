import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Loader2,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
} from 'lucide-react';

export type ProcessStatus = 'completed' | 'in_progress' | 'todo';

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  name: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'intake',
    stepNumber: 1,
    name: 'Story Intake',
    path: '/intake',
    description: 'Accept user story & acceptance criteria (§3.1)',
    icon: PlusCircle,
  },
  {
    id: 'specs',
    stepNumber: 2,
    name: 'Specifications & TCs',
    path: '/specs',
    description: 'Inspect generated spec & candidate test cases (§3.2-3.3)',
    icon: FileText,
  },
  {
    id: 'approval',
    stepNumber: 3,
    name: 'Human Approval Gate',
    path: '/approval',
    description: 'Review and approve candidate test cases (§3.4)',
    icon: FileCheck2,
  },
  {
    id: 'validation',
    stepNumber: 4,
    name: 'Validation & Auto-Healing',
    path: '/validation',
    description: 'Static, dynamic execution & self-healing (§3.5-3.6)',
    icon: Sparkles,
  },
  {
    id: 'repository',
    stepNumber: 5,
    name: 'Quality Gates & Repository',
    path: '/repository',
    description: '8 Release quality gates & promotion (§3.7, §8)',
    icon: ShieldCheck,
  },
];

interface WorkflowProcessNavProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onItemClick?: () => void;
}

export const WorkflowProcessNav: React.FC<WorkflowProcessNavProps> = ({
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  onItemClick,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);

  // Derive which step is currently active from URL pathname
  const currentPath = location.pathname;
  let activeStepIndex = -1;

  if (currentPath === '/intake') {
    activeStepIndex = 0;
  } else if (currentPath.startsWith('/specs')) {
    activeStepIndex = 1;
  } else if (currentPath.startsWith('/approval')) {
    activeStepIndex = 2;
  } else if (currentPath.startsWith('/validation')) {
    activeStepIndex = 3;
  } else if (currentPath.startsWith('/repository')) {
    activeStepIndex = 4;
  }

  // Determine status for a step:
  // If user is on Dashboard (/), all steps start as 'todo' unless already progressed.
  // Otherwise:
  // - Step index < activeStepIndex: Completed
  // - Step index === activeStepIndex: In Progress (user is currently working in this process)
  // - Step index > activeStepIndex: To Do
  const getStepStatus = (index: number): ProcessStatus => {
    if (activeStepIndex === -1) {
      // On dashboard or other page
      return 'todo';
    }
    if (index < activeStepIndex) {
      return 'completed';
    }
    if (index === activeStepIndex) {
      return 'in_progress';
    }
    return 'todo';
  };

  const isExpanded = controlledCollapsed !== undefined ? !controlledCollapsed : internalExpanded;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const handleStepClick = (path: string) => {
    navigate(path);
    if (onItemClick) {
      onItemClick();
    }
  };

  const activeStep = activeStepIndex >= 0 ? WORKFLOW_STEPS[activeStepIndex] : null;

  return (
    <div
      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden transition-all duration-200"
      data-testid="workflow-process-nav"
    >
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls="workflow-process-steps-content"
        className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
            <Workflow className="w-4 h-4 shrink-0" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Workflow Process</span>
              {activeStep && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                  Step {activeStep.stepNumber}/5
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeStep ? (
                <span>
                  Current:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {activeStep.name}
                  </strong>
                </span>
              ) : (
                'SDD Pipeline Stages'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <span className="text-[10px] font-medium hidden sm:inline text-slate-400">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expandable Step Flow List */}
      {isExpanded && (
        <div
          id="workflow-process-steps-content"
          className="border-t border-slate-100 dark:border-slate-800/80 p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/40 animate-fadeIn"
        >
          {WORKFLOW_STEPS.map((step, idx) => {
            const status = getStepStatus(idx);
            const isCurrent = idx === activeStepIndex;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                onClick={() => handleStepClick(step.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStepClick(step.path);
                  }
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isCurrent
                    ? 'bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-600 shadow-xs ring-1 ring-indigo-400/30'
                    : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Active Indicator Bar on Left */}
                {isCurrent && (
                  <div
                    className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r"
                    aria-hidden="true"
                  />
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : status === 'in_progress'
                            ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {step.stepNumber}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isCurrent
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                        <span
                          className={`text-xs font-semibold truncate ${
                            isCurrent
                              ? 'text-indigo-900 dark:text-indigo-200'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {step.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-1">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge with Clear Differentiation */}
                  <div className="shrink-0 ml-1">
                    {status === 'completed' && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        title="Completed"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Completed</span>
                      </span>
                    )}

                    {status === 'in_progress' && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 animate-pulse"
                        title="Currently in progress"
                      >
                        <Loader2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0 animate-spin" />
                        <span>In Progress</span>
                      </span>
                    )}

                    {status === 'todo' && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700"
                        title="To Do"
                      >
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>To Do</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
