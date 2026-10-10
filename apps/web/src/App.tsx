import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ApprovalPage } from './pages/ApprovalPage';
import { HomePage } from './pages/HomePage';
import { IntakePage } from './pages/IntakePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RepositoryPage } from './pages/RepositoryPage';
import { SpecDetailPage } from './pages/SpecDetailPage';
import { SpecsListPage } from './pages/SpecsListPage';
import { ValidationPage } from './pages/ValidationPage';
import { LLMProviderComponent } from './providers/LLMContext';
import { ThemeProvider } from './theme/ThemeContext';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LLMProviderComponent>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="specs" element={<SpecsListPage />} />
              <Route path="specs/:specId" element={<SpecDetailPage />} />
              <Route path="intake" element={<IntakePage />} />
              <Route path="approval" element={<ApprovalPage />} />
              <Route path="validation" element={<ValidationPage />} />
              <Route path="repository" element={<RepositoryPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LLMProviderComponent>
    </ThemeProvider>
  );
};
