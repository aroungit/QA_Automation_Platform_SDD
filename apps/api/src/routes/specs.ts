import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { ApiResponse, SpecArtifactsPayload, SpecSummaryItem } from '@qaa/shared';
import { extractProviderSelection } from '../middleware/request-context.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { IntakeService } from '../services/intake-service.js';
import type { FileStore } from '../storage/file-store.js';

export function createSpecsRouter(store: FileStore, registry: ProviderRegistry): Router {
  const router = Router();
  const intakeService = new IntakeService(store, registry);

  // POST /api/specs/intake and POST /api/specs - User Story Intake (§3.1)
  const handleIntake = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const selection = extractProviderSelection(req);
      const data = await intakeService.processIntake(req.body, {
        provider: selection.providerName,
        model: selection.model,
      });
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  router.post('/api/specs/intake', handleIntake);
  router.post('/api/specs', handleIntake);

  // GET /api/specs - List all specifications (§3.7)
  router.get('/api/specs', async (_req, res, next) => {
    try {
      const data = await intakeService.listSpecs();
      const response: ApiResponse<SpecSummaryItem[]> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/specs/:specId - Get specification details and all artifacts (§3.7)
  router.get('/api/specs/:specId', async (req, res, next) => {
    try {
      const data = await intakeService.getSpec(req.params.specId);
      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/generate-spec - Generate/regenerate Specification (§3.2)
  router.post('/api/specs/:specId/generate-spec', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const data = await intakeService.generateSpecification(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
      });
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/generate-test-cases - Generate/regenerate Test Cases (§3.3)
  router.post('/api/specs/:specId/generate-test-cases', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const data = await intakeService.generateTestCases(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
      });
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/generate-all - Sequential Spec & Test Case generation (§3.2, §3.3)
  router.post('/api/specs/:specId/generate-all', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const data = await intakeService.generateAll(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
      });
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/specs/:specId/user-story - Update user story
  router.put('/api/specs/:specId/user-story', async (req, res, next) => {
    try {
      const data = await intakeService.updateUserStory(req.params.specId, req.body);
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/specs/:specId/specification - Manual specification update
  router.put('/api/specs/:specId/specification', async (req, res, next) => {
    try {
      const data = await intakeService.updateSpecification(req.params.specId, req.body);
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/specs/:specId/test-cases - Manual test cases update
  router.put('/api/specs/:specId/test-cases', async (req, res, next) => {
    try {
      const data = await intakeService.updateTestCases(req.params.specId, req.body);
      const response: ApiResponse<SpecArtifactsPayload> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/specs/:specId - Delete specification
  router.delete('/api/specs/:specId', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      await intakeService.deleteSpec(req.params.specId);
      const response: ApiResponse<{ deleted: boolean; specId: string }> = {
        success: true,
        data: {
          deleted: true,
          specId: req.params.specId,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
