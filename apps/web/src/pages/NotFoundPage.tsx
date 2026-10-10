import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="py-16 text-center space-y-4">
      <div className="text-6xl font-extrabold text-indigo-600 dark:text-indigo-400">404</div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        The page you are looking for does not exist in the QA Automation Platform Agent.
      </p>
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
