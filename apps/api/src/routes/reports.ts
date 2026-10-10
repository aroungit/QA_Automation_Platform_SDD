import { Router } from 'express';
import type { ApiResponse, ValidationReport } from '@qaa/shared';
import type { FileStore } from '../storage/file-store.js';

export function createReportsRouter(store: FileStore): Router {
  const router = Router();

  // GET /api/reports/execution-results - List all execution reports (§3.7)
  router.get('/api/reports/execution-results', async (_req, res, next) => {
    try {
      const reportIds = await store.listExecutionReports();
      const reports: ValidationReport[] = [];

      for (const id of reportIds) {
        const raw = await store.readExecutionReport(id);
        if (raw) {
          try {
            reports.push(JSON.parse(raw));
          } catch {
            // ignore malformed
          }
        }
      }

      // Sort descending by timestamp
      reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const response: ApiResponse<ValidationReport[]> = {
        success: true,
        data: reports,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/reports/execution-results/:reportId - Get execution report by ID (§3.7)
  const handleGetReport = async (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    try {
      const reportId = req.params.reportId as string;
      const raw = await store.readExecutionReport(reportId);
      if (!raw) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Execution report "${reportId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const report = JSON.parse(raw) as ValidationReport;
      const response: ApiResponse<ValidationReport> = {
        success: true,
        data: report,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  };

  router.get('/api/reports/execution-results/:reportId', handleGetReport);
  router.get('/api/reports/:reportId', handleGetReport);

  return router;
}
