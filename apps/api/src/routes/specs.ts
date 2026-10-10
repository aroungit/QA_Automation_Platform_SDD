import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type {
  ApiResponse,
  ApprovalRecord,
  CanProceedResponse,
  GenerateScriptsResult,
  HealResponse,
  PromotionRecord,
  PromotionResult,
  QualityGateEvaluation,
  SpecArtifactsPayload,
  SpecScriptsResponse,
  SpecSummaryItem,
  ValidationReport,
  WorkspaceFilesResponse,
} from '@qaa/shared';
import { extractProviderSelection } from '../middleware/request-context.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { IntakeService } from '../services/intake-service.js';
import type { FileStore } from '../storage/file-store.js';

export function createSpecsRouter(store: FileStore, registry: ProviderRegistry): Router {
  const router = Router();
  const intakeService = new IntakeService(store, registry);
  const approvalService = intakeService.getApprovalService();

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
      const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback : undefined;
      const data = await intakeService.generateSpecification(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
        feedback,
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
      const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback : undefined;
      const data = await intakeService.generateTestCases(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
        feedback,
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
      const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback : undefined;
      const data = await intakeService.generateAll(req.params.specId, {
        provider: selection.providerName,
        model: selection.model,
        feedback,
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

  // ========================================================
  // Approval Gate API (§3.4)
  // ========================================================

  // GET /api/specs/:specId/approval - Get current approval record & history (§3.4)
  router.get('/api/specs/:specId/approval', async (req, res, next) => {
    try {
      const data = await approvalService.getApprovalRecord(req.params.specId as string);
      const response: ApiResponse<ApprovalRecord> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/approval & PUT /api/specs/:specId/approval - Submit approval decision (§3.4)
  const handleApprovalDecision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await approvalService.submitDecision(req.params.specId as string, req.body);
      const response: ApiResponse<ApprovalRecord> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  };

  router.post('/api/specs/:specId/approval', handleApprovalDecision);
  router.put('/api/specs/:specId/approval', handleApprovalDecision);

  // GET /api/specs/:specId/approval/can-proceed - Check if Approved to proceed to script generation (§3.4, §3.5)
  router.get('/api/specs/:specId/approval/can-proceed', async (req, res, next) => {
    try {
      const data = await approvalService.canProceedToScriptGeneration(req.params.specId as string);
      const response: ApiResponse<CanProceedResponse> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/approval/loopback & /api/specs/:specId/loopback - Rejected/clarification loop back (§3.4)
  const handleLoopback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const selection = extractProviderSelection(req);
      const data = await approvalService.loopback(req.params.specId as string, req.body, {
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
  };

  router.post('/api/specs/:specId/approval/loopback', handleLoopback);
  router.post('/api/specs/:specId/loopback', handleLoopback);

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

  // ========================================================
  // Playwright Script Generation Endpoints (§3.5)
  // ========================================================

  // POST /api/specs/:specId/generate-scripts - Generate Playwright scripts for approved test cases (§3.5)
  router.post('/api/specs/:specId/generate-scripts', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const requestData = {
        ...req.body,
        provider: req.body?.provider ?? selection.providerName,
        model: req.body?.model ?? selection.model,
      };
      const data = await intakeService.generateScripts(req.params.specId as string, requestData);
      const response: ApiResponse<GenerateScriptsResult> = {
        success: true,
        data,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/specs/:specId/scripts - Get generated scripts for specification (§3.5)
  router.get('/api/specs/:specId/scripts', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }
      const data = await intakeService.getWorkspaceScripts(req.params.specId as string);
      const response: ApiResponse<SpecScriptsResponse> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workspace/files - List files in the temporary workspace (.workspace)
  router.get('/api/workspace/files', async (req, res, next) => {
    try {
      const subDir = typeof req.query?.subDir === 'string' ? req.query.subDir : '';
      const data = await intakeService.listWorkspaceFiles(subDir);
      const response: ApiResponse<WorkspaceFilesResponse> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workspace/file - Read file content from temporary workspace (.workspace) (§3.7)
  router.get('/api/workspace/file', async (req, res, next) => {
    try {
      const filePath = typeof req.query?.path === 'string' ? req.query.path : '';
      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Query parameter "path" is required.',
            code: 'INVALID_QUERY',
          },
        });
      }

      const content = await intakeService.readWorkspaceFile(filePath);
      if (content === null) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Workspace file "${filePath}" not found.`,
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

  // DELETE /api/workspace - Clean temporary workspace (.workspace)
  router.delete('/api/workspace', async (_req, res, next) => {
    try {
      await intakeService.cleanWorkspace();
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'Workspace cleaned successfully',
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // ========================================================
  // Automated Validation & Auto-Heal Endpoints (§3.6)
  // ========================================================

  // POST /api/specs/:specId/validate - Run static, dynamic, conformance validation & auto-healing (§3.6)
  router.post('/api/specs/:specId/validate', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const requestOptions = {
        ...req.body,
        provider: req.body?.provider ?? selection.providerName,
        model: req.body?.model ?? selection.model,
      };

      const data = await intakeService.validateSpec(req.params.specId as string, requestOptions);
      const response: ApiResponse<ValidationReport> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/specs/:specId/validation-reports - List all validation reports for specification (§3.6, §3.7)
  router.get('/api/specs/:specId/validation-reports', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const data = await intakeService.listValidationReports(req.params.specId as string);
      const response: ApiResponse<ValidationReport[]> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/specs/:specId/validation-reports/latest - Get latest validation report for specification (§3.6, §3.7)
  router.get('/api/specs/:specId/validation-reports/latest', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const data = await intakeService.getLatestValidationReport(req.params.specId as string);
      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            message: `No validation reports found for specification "${req.params.specId}"`,
            code: 'NOT_FOUND',
          },
        });
      }

      const response: ApiResponse<ValidationReport> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/heal - Trigger Playwright Healer Agent directly (§3.6)
  router.post('/api/specs/:specId/heal', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const requestOptions = {
        ...req.body,
        provider: req.body?.provider ?? selection.providerName,
        model: req.body?.model ?? selection.model,
      };

      const data = await intakeService.healSpec(req.params.specId as string, requestOptions);
      const response: ApiResponse<HealResponse> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // ========================================================
  // Quality Gates & Repository Promotion Endpoints (§3.7, §8)
  // ========================================================

  // GET /api/specs/:specId/quality-gate - Evaluate all 8 quality gates (§8)
  router.get('/api/specs/:specId/quality-gate', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const data = await intakeService.evaluateQualityGates(req.params.specId as string);
      const response: ApiResponse<QualityGateEvaluation> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/promote - Promote validated artifacts to /specs, /automation, /reports (§3.7, §8)
  router.post('/api/specs/:specId/promote', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const data = await intakeService.promoteSpec(req.params.specId as string, req.body);
      const response: ApiResponse<PromotionResult> = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/specs/:specId/promotion - Get current promotion record (§3.7)
  router.get('/api/specs/:specId/promotion', async (req, res, next) => {
    try {
      const exists = await store.specExists(req.params.specId as string);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Specification "${req.params.specId}" not found`,
            code: 'NOT_FOUND',
          },
        });
      }

      const data = await intakeService.getPromotionRecord(req.params.specId as string);
      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            message: `No promotion record found for specification "${req.params.specId}"`,
            code: 'NOT_FOUND',
          },
        });
      }

      const response: ApiResponse<PromotionRecord> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/specs/:specId/revalidate - Trigger revalidation for modified spec (§8)
  router.post('/api/specs/:specId/revalidate', async (req, res, next) => {
    try {
      const selection = extractProviderSelection(req);
      const requestOptions = {
        ...req.body,
        provider: req.body?.provider ?? selection.providerName,
        model: req.body?.model ?? selection.model,
      };

      const data = await intakeService.revalidateSpec(req.params.specId as string, requestOptions);
      const response: ApiResponse<ValidationReport> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/promotions - List all promoted specifications (§3.7)
  router.get('/api/promotions', async (_req, res, next) => {
    try {
      const data = await intakeService.listPromotedSpecs();
      const response: ApiResponse<PromotionRecord[]> = {
        success: true,
        data,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
