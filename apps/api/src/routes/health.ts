import { Router } from 'express';
import type { ApiResponse, HealthResponse } from '@qaa/shared';

export function createHealthRouter(): Router {
  const router = Router();

  const startTime = Date.now();

  const handler = (_req: unknown, res: { json: (body: ApiResponse<HealthResponse>) => void }) => {
    const payload: HealthResponse = {
      status: 'ok',
      name: 'QA_Automation_Platform_Agent',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: payload,
    });
  };

  router.get('/health', handler);
  router.get('/api/health', handler);

  return router;
}
