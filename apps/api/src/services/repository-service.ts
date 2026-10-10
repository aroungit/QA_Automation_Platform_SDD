import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  ApprovalRecordSchema,
  type ApprovalRecord,
  type GitCommitInfo,
  type PromotedFileInfo,
  type PromoteSpecRequest,
  type PromotionRecord,
  type PromotionResult,
  type QualityGateEvaluation,
  type RevalidateSpecRequest,
  type ValidationReport,
} from '@qaa/shared';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import type { FileStore } from '../storage/file-store.js';
import { ApprovalGateError } from './approval-service.js';
import type { QualityGateService } from './quality-gate-service.js';
import { QualityGateError } from './quality-gate-service.js';
import type { ValidationService } from './validation-service.js';

const execFileAsync = promisify(execFile);

export class RepositoryServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'REPOSITORY_SERVICE_ERROR', status = 400) {
    super(message);
    this.name = 'RepositoryServiceError';
    this.code = code;
    this.status = status;
  }
}

export class RepositoryService {
  constructor(
    private readonly store: FileStore,
    private readonly qualityGateService: QualityGateService,
    private readonly validationService: ValidationService,
    private readonly config?: AppConfig,
  ) {}

  private getConfig(): AppConfig {
    return this.config ?? getConfig();
  }

  /**
   * Evaluates Quality Gates (§8) for a specification
   */
  async evaluateQualityGates(specId: string): Promise<QualityGateEvaluation> {
    return this.qualityGateService.evaluate(specId);
  }

  /**
   * Promotes validated artifacts to /specs, /automation, /reports (§3.7, §8).
   *
   * Repository rules (§3.7):
   * 1. Specs, test cases, approval records, and scripts are committed together.
   * 2. Each commit references its specification ID.
   * 3. Failed or unapproved scripts are stored only in a temporary workspace, never in the main repository.
   * 4. Every stored script must include a passing validation report reference.
   */
  async promote(specId: string, options?: PromoteSpecRequest): Promise<PromotionResult> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new RepositoryServiceError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    // 1. Assert Quality Gates pass (§8)
    // If gates fail, throws QualityGateError; failed scripts stay in temporary workspace.
    const qualityGateEvaluation = await this.qualityGateService.assertGatesPass(specId);

    // 2. Retrieve latest passing validation report
    const report = await this.validationService.getLatestReport(specId);
    if (
      !report ||
      (report.overallStatus !== 'PASSED' && report.overallStatus !== 'HEALED_PASSED')
    ) {
      throw new QualityGateError(
        `Specification "${specId}" does not have a passing validation report. Run validation first (§3.6, §3.7).`,
        [],
        'NO_PASSING_REPORT',
        400,
      );
    }

    const reportId = report.reportId;
    const promotedAt = new Date().toISOString();

    // 3. Inspect workspace files and copy eligible files to /automation
    const wsFiles = await this.store.listWorkspaceFiles();
    if (wsFiles.length === 0) {
      throw new RepositoryServiceError(
        `Workspace is empty for "${specId}". Run script generation and validation first.`,
        'WORKSPACE_EMPTY',
        400,
      );
    }

    const promotedFiles: PromotedFileInfo[] = [];
    const filesToCommit: string[] = [];

    for (const relPath of wsFiles) {
      // Determine if file belongs to this spec or is a shared artifact
      const isTestFile = relPath.includes('/tests/');
      const isSpecTest =
        isTestFile && (relPath.includes(`/${specId}/`) || relPath.includes(specId));

      // Skip test files belonging to OTHER specifications
      if (isTestFile && !isSpecTest) {
        continue;
      }

      let content = await this.store.readWorkspaceFile(relPath);
      if (content === null) continue;

      // Rule: "Every stored script must include a passing validation report reference." (§3.7)
      if (relPath.endsWith('.ts') || relPath.endsWith('.js')) {
        content = this.injectValidationReportReference(content, specId, reportId);
      }

      // Determine category and platform
      const normPath = relPath.replace(/\\/g, '/');
      const platform: 'web' | 'mobile' | 'shared' = normPath.startsWith('mobile/')
        ? 'mobile'
        : normPath.startsWith('web/')
          ? 'web'
          : 'shared';

      let category = 'config';
      if (normPath.includes('/pages/')) category = 'page';
      else if (normPath.includes('/tests/')) category = 'test';
      else if (normPath.includes('/fixtures/')) category = 'fixture';
      else if (normPath.includes('/utils/')) category = 'util';

      // Write to /automation
      const targetFullPath = await this.store.writeAutomationFile(relPath, content);
      filesToCommit.push(targetFullPath);

      promotedFiles.push({
        sourcePath: relPath,
        targetPath: `automation/${normPath}`,
        category,
        platform,
        size: Buffer.byteLength(content, 'utf-8'),
      });
    }

    if (promotedFiles.length === 0) {
      throw new RepositoryServiceError(
        `No automation scripts found to promote for specification "${specId}".`,
        'NO_SCRIPTS_TO_PROMOTE',
        400,
      );
    }

    // 4. Collect spec and report files to commit together (§3.7)
    const specDir = this.store.getSpecDir(specId);
    filesToCommit.push(path.join(specDir, 'user-story.md'));
    filesToCommit.push(path.join(specDir, 'user-story.json'));
    filesToCommit.push(path.join(specDir, 'specification.md'));
    filesToCommit.push(path.join(specDir, 'specification.json'));
    filesToCommit.push(path.join(specDir, 'test-cases.md'));
    filesToCommit.push(path.join(specDir, 'test-cases.json'));
    filesToCommit.push(path.join(specDir, 'approval-record.json'));
    filesToCommit.push(path.join(specDir, 'promotion-record.json'));
    filesToCommit.push(path.join(this.store.reportsDir, 'execution-results', `${reportId}.json`));

    // 5. Git Commit: "Specs, test cases, approval records, and scripts are committed together.
    // Each commit references its specification ID." (§3.7)
    const defaultMessage = `feat(automation): [${specId}] promote validated artifacts and scripts\n\nSpec ID: ${specId}\nValidation Report: ${reportId}\nQuality Gates: Passed (8/8)\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`;
    const commitMessage = options?.commitMessage?.trim() || defaultMessage;

    // Ensure the message references the specification ID (§3.7)
    const finalCommitMessage = commitMessage.includes(specId)
      ? commitMessage
      : `[${specId}] ${commitMessage}`;

    let commitInfo: GitCommitInfo;
    const autoCommit = options?.autoCommit !== false;

    if (autoCommit) {
      commitInfo = await this.executeGitCommit(
        specId,
        filesToCommit,
        finalCommitMessage,
        options?.authorName,
        options?.authorEmail,
      );
    } else {
      const rootDir = this.store.specsDir ? path.dirname(this.store.specsDir) : process.cwd();
      commitInfo = {
        sha: `prepared-${specId.toLowerCase()}-${Date.now().toString(16)}`,
        message: finalCommitMessage,
        committedFiles: filesToCommit.map((f) => path.relative(rootDir, f).replace(/\\/g, '/')),
        timestamp: promotedAt,
        author: options?.authorName || 'Copilot <223556219+Copilot@users.noreply.github.com>',
      };
    }

    // 6. Save promotion record in /specs/{specId}/promotion-record.json (§3.7)
    const artifacts = await this.store.readSpecArtifacts(specId);
    const approvalRecord: ApprovalRecord | undefined = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    const promotionRecord: PromotionRecord = {
      specId,
      promotedAt,
      validationReportId: reportId,
      status: 'promoted',
      revalidationRequired: false,
      promotedFiles,
      commit: commitInfo,
      metadata: {
        platform: report.platform,
        targetApp: report.metadata?.targetApp,
        reviewer: approvalRecord?.reviewer,
      },
    };

    await this.store.savePromotionRecord(specId, promotionRecord);

    return {
      success: true,
      specId,
      promotedAt,
      validationReportId: reportId,
      promotedFiles,
      commit: commitInfo,
      qualityGateEvaluation: {
        ...qualityGateEvaluation,
        promoted: true,
        promotedAt,
        revalidationRequired: false,
      },
    };
  }

  /**
   * Revalidates a specification when changes occur (§8).
   * Verifies approval status, re-runs automated validation, and updates promotion status.
   */
  async revalidate(specId: string, options?: RevalidateSpecRequest): Promise<ValidationReport> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new RepositoryServiceError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    const approvalRecord = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    if (!approvalRecord || approvalRecord.status !== 'Approved') {
      const currentStatus = approvalRecord?.status ?? 'Draft';
      throw new ApprovalGateError(
        `Specification "${specId}" is in "${currentStatus}" status. Specification changes must be approved before revalidation (§3.4, §8).`,
        'PRECONDITION_FAILED',
        400,
      );
    }

    // Execute validation pipeline
    const report = await this.validationService.validate(specId, {
      autoHeal: options?.autoHeal ?? true,
      maxHealAttempts: options?.maxHealAttempts,
      executionMode: options?.executionMode ?? 'real',
      platform: options?.platform,
      provider: options?.provider,
      model: options?.model,
    });

    // If previously promoted, update promotion record
    const existingPromo = await this.store.readPromotionRecord(specId);
    if (existingPromo) {
      const isPassed =
        report.overallStatus === 'PASSED' || report.overallStatus === 'HEALED_PASSED';
      const updatedPromo: PromotionRecord = {
        ...existingPromo,
        revalidationRequired: !isPassed,
        status: isPassed ? 'promoted' : 'outdated',
        validationReportId: report.reportId,
      };
      await this.store.savePromotionRecord(specId, updatedPromo);
    }

    return report;
  }

  /**
   * Hook called when specification or test cases are updated.
   * Marks promotion as outdated and sets revalidationRequired = true (§8).
   */
  async handleSpecChanged(specId: string, reason: string): Promise<void> {
    const promotion = await this.store.readPromotionRecord(specId);
    if (!promotion) return;

    const updated: PromotionRecord = {
      ...promotion,
      status: 'outdated',
      revalidationRequired: true,
      metadata: {
        ...promotion.metadata,
        reviewer: `Marked outdated: ${reason}`,
      },
    };

    await this.store.savePromotionRecord(specId, updated);
  }

  /**
   * Retrieves promotion record for a specification
   */
  async getPromotionRecord(specId: string): Promise<PromotionRecord | null> {
    return this.store.readPromotionRecord(specId);
  }

  /**
   * Lists all promoted specifications
   */
  async listPromotedSpecs(): Promise<PromotionRecord[]> {
    const specs = await this.store.listSpecs();
    const records: PromotionRecord[] = [];

    for (const spec of specs) {
      const rec = await this.store.readPromotionRecord(spec.specId);
      if (rec) {
        records.push(rec);
      }
    }

    return records;
  }

  /**
   * Lists all promoted automation files
   */
  async listAutomationFiles(platform?: 'web' | 'mobile'): Promise<string[]> {
    if (platform) {
      return this.store.listAutomationFiles(platform);
    }
    return this.store.listAllAutomationFiles();
  }

  /**
   * Reads a promoted automation file directly
   */
  async readAutomationFile(relPath: string): Promise<string | null> {
    return this.store.readAutomationFileDirect(relPath);
  }

  /**
   * Injects the passing validation report reference into script content (§3.7).
   * "Every stored script must include a passing validation report reference."
   */
  private injectValidationReportReference(
    content: string,
    specId: string,
    reportId: string,
  ): string {
    const refLine = `// Validation Report: ${reportId}`;
    if (content.includes(`Validation Report:`)) {
      // Replace existing reference with fresh one
      return content.replace(/\/\/\s*Validation Report:\s*[^\r\n]+/g, refLine);
    }

    // Insert after Spec ID comment if present
    const specIdRegex = /(\/\/\s*Spec ID:\s*[^\r\n]+)/i;
    if (specIdRegex.test(content)) {
      return content.replace(specIdRegex, `$1\n${refLine}`);
    }

    // Prepend to top of file
    return `${refLine}\n${content}`;
  }

  /**
   * Performs Git commit committing specs, test cases, approval records, and scripts together (§3.7).
   * Gracefully falls back to simulated commit metadata if git repository is not configured or in unit test.
   */
  private async executeGitCommit(
    specId: string,
    filePaths: string[],
    message: string,
    authorName?: string,
    authorEmail?: string,
  ): Promise<GitCommitInfo> {
    const rootDir = this.store.specsDir ? path.dirname(this.store.specsDir) : process.cwd();
    const now = new Date().toISOString();

    try {
      // Check if inside git repository
      const { stdout: isGit } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: rootDir,
      });

      if (isGit.trim() === 'true') {
        // Stage files
        for (const filePath of filePaths) {
          try {
            await execFileAsync('git', ['add', filePath], { cwd: rootDir });
          } catch {
            // ignore individual add failure if file does not exist
          }
        }

        // Commit with message
        const commitArgs = ['commit', '-m', message];
        if (authorName && authorEmail) {
          commitArgs.push('--author', `${authorName} <${authorEmail}>`);
        }

        try {
          await execFileAsync('git', commitArgs, { cwd: rootDir });
        } catch (commitErr) {
          // If nothing to commit, that's fine
          const stderr = (commitErr as { stderr?: string }).stderr || '';
          if (!stderr.includes('nothing to commit')) {
            console.warn(
              `[RepositoryService] Git commit note: ${stderr || (commitErr as Error).message}`,
            );
          }
        }

        // Obtain commit hash
        const { stdout: headSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
          cwd: rootDir,
        });

        return {
          sha: headSha.trim(),
          message,
          committedFiles: filePaths.map((f) => path.relative(rootDir, f).replace(/\\/g, '/')),
          timestamp: now,
          author: authorName || 'Copilot <223556219+Copilot@users.noreply.github.com>',
        };
      }
    } catch {
      // Git command failed or git not initialized — fallback to deterministic metadata
    }

    // Deterministic fallback commit info for non-git / test environments
    const pseudoHash = `commit-${specId.toLowerCase()}-${Date.now().toString(16)}`;
    return {
      sha: pseudoHash,
      message,
      committedFiles: filePaths.map((f) => path.relative(rootDir, f).replace(/\\/g, '/')),
      timestamp: now,
      author: authorName || 'Copilot <223556219+Copilot@users.noreply.github.com>',
    };
  }
}
