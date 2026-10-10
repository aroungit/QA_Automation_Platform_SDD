import { Router } from 'express';
import type { ApiResponse } from '@qaa/shared';
import type { FileStore } from '../storage/file-store.js';

export function createAutomationRouter(store: FileStore): Router {
  const router = Router();

  // GET /api/automation/files - List all promoted automation files (§3.7)
  router.get('/api/automation/files', async (req, res, next) => {
    try {
      const platform =
        req.query.platform === 'web' || req.query.platform === 'mobile'
          ? req.query.platform
          : undefined;

      const files = platform
        ? await store.listAutomationFiles(platform)
        : await store.listAllAutomationFiles();

      const response: ApiResponse<{ files: string[]; count: number }> = {
        success: true,
        data: {
          files,
          count: files.length,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/automation/file - Read content of a promoted automation file (§3.7)
  router.get('/api/automation/file', async (req, res, next) => {
    try {
      const filePath = typeof req.query.path === 'string' ? req.query.path : '';
      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Query parameter "path" is required.',
            code: 'INVALID_QUERY',
          },
        });
      }

      const content = await store.readAutomationFileDirect(filePath);
      if (content === null) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Automation file "${filePath}" not found.`,
            code: 'NOT_FOUND',
          },
        });
      }

      const response: ApiResponse<{ path: string; content: string }> = {
        success: true,
        data: {
          path: filePath,
          content,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
