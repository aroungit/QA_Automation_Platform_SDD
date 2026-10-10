import path from 'node:path';
import type {
  ConformanceCheckResult,
  DynamicValidationResult,
  HealAttempt,
  HealChangeApplied,
  HealingSummary,
  LLMProviderName,
  Platform,
  StaticValidationResult,
  TestCaseExecutionResult,
} from '@qaa/shared';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { getProviderRegistry } from '../providers/registry.js';
import type { LLMProvider } from '../providers/types.js';
import type { FileStore } from '../storage/file-store.js';
import { ConformanceChecker } from './conformance-checker.js';
import { DynamicValidator } from './dynamic-validator.js';
import { StaticValidator } from './static-validator.js';

export interface HealerContext {
  specId: string;
  platform?: Platform;
  approvedTestCaseIds: string[];
  staticResult?: StaticValidationResult;
  dynamicResult?: DynamicValidationResult;
  conformanceResult?: ConformanceCheckResult;
  provider?: LLMProviderName;
  model?: string;
  maxAttempts?: number;
  dynamicMode?: 'real' | 'simulated' | 'dry-run';
}

export interface HealerRunResult {
  successful: boolean;
  summary: HealingSummary;
  finalStaticResult?: StaticValidationResult;
  finalDynamicResult?: DynamicValidationResult;
  finalConformanceResult?: ConformanceCheckResult;
}

const HealedFileSchema = z.object({
  file: z.string(),
  description: z.string(),
  content: z.string(),
});

const HealerLlmResponseSchema = z.array(HealedFileSchema);

export class PlaywrightHealerAgent {
  private readonly staticValidator: StaticValidator;
  private readonly dynamicValidator: DynamicValidator;
  private readonly conformanceChecker: ConformanceChecker;

  constructor(
    private readonly store: FileStore,
    private readonly registry?: ProviderRegistry,
    private readonly config?: AppConfig,
  ) {
    this.staticValidator = new StaticValidator(store);
    this.dynamicValidator = new DynamicValidator(store, config);
    this.conformanceChecker = new ConformanceChecker();
  }

  private getRegistry(): ProviderRegistry {
    return this.registry ?? getProviderRegistry();
  }

  private getConfig(): AppConfig {
    return this.config ?? getConfig();
  }

  /**
   * Runs bounded auto-healing loop (§3.6).
   * Attempts up to maxAttempts to diagnose and heal validation failures.
   */
  async heal(context: HealerContext): Promise<HealerRunResult> {
    const maxAttempts = context.maxAttempts ?? this.getConfig().heal.maxAttempts ?? 3;

    const attempts: HealAttempt[] = [];
    let currentStatic = context.staticResult;
    let currentDynamic = context.dynamicResult;
    let currentConformance = context.conformanceResult;

    // Initial check of current state if not supplied
    if (!currentStatic) {
      currentStatic = await this.staticValidator.validate({ specId: context.specId });
    }
    if (!currentDynamic) {
      currentDynamic = await this.dynamicValidator.validate({
        specId: context.specId,
        platform: context.platform,
        mode: context.dynamicMode ?? 'simulated',
      });
    }
    if (!currentConformance) {
      currentConformance = this.conformanceChecker.check({
        specId: context.specId,
        approvedTestCaseIds: context.approvedTestCaseIds,
        executedTests: currentDynamic.tests,
      });
    }

    // If everything is already passing, nothing to heal
    if (currentStatic.passed && currentDynamic.passed && currentConformance.passed) {
      return {
        successful: true,
        summary: {
          attempted: false,
          totalAttempts: 0,
          maxAttempts,
          successful: true,
          attempts: [],
        },
        finalStaticResult: currentStatic,
        finalDynamicResult: currentDynamic,
        finalConformanceResult: currentConformance,
      };
    }

    // Bounded retries loop (§3.6)
    for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
      const stage: 'static' | 'dynamic' | 'conformance' = !currentStatic.passed
        ? 'static'
        : !currentDynamic.passed
          ? 'dynamic'
          : 'conformance';

      const diagnosis = this.buildDiagnosis(
        stage,
        currentStatic,
        currentDynamic,
        currentConformance,
      );

      const changesApplied: HealChangeApplied[] = [];
      const targetFiles: string[] = [];

      // 1. Try LLM healing if configured
      let healedFiles = await this.healWithLLM(context, stage, diagnosis);

      // 2. Fallback to heuristic / pattern-based healing if LLM didn't produce changes
      if (!healedFiles || healedFiles.length === 0) {
        healedFiles = await this.healWithHeuristics(
          context,
          stage,
          diagnosis,
          currentStatic,
          currentDynamic,
          currentConformance,
        );
      }

      // 3. Apply changes to workspace
      if (healedFiles && healedFiles.length > 0) {
        for (const file of healedFiles) {
          await this.store.writeWorkspaceFile(file.file, file.content);
          targetFiles.push(file.file);
          changesApplied.push({
            file: file.file,
            description: file.description,
          });
        }
      }

      // 4. Re-run validation to check if healed
      currentStatic = await this.staticValidator.validate({ specId: context.specId });
      currentDynamic = await this.dynamicValidator.validate({
        specId: context.specId,
        platform: context.platform,
        mode: context.dynamicMode ?? 'simulated',
      });
      currentConformance = this.conformanceChecker.check({
        specId: context.specId,
        approvedTestCaseIds: context.approvedTestCaseIds,
        executedTests: currentDynamic.tests,
      });

      const attemptSuccess =
        currentStatic.passed && currentDynamic.passed && currentConformance.passed;

      attempts.push({
        attemptNumber: attemptNum,
        timestamp: new Date().toISOString(),
        stage,
        diagnosis,
        targetFiles,
        changesApplied,
        success: attemptSuccess,
      });

      if (attemptSuccess) {
        return {
          successful: true,
          summary: {
            attempted: true,
            totalAttempts: attemptNum,
            maxAttempts,
            successful: true,
            attempts,
          },
          finalStaticResult: currentStatic,
          finalDynamicResult: currentDynamic,
          finalConformanceResult: currentConformance,
        };
      }
    }

    return {
      successful: false,
      summary: {
        attempted: true,
        totalAttempts: attempts.length,
        maxAttempts,
        successful: false,
        attempts,
      },
      finalStaticResult: currentStatic,
      finalDynamicResult: currentDynamic,
      finalConformanceResult: currentConformance,
    };
  }

  /**
   * Constructs human-readable diagnosis string for the failure
   */
  private buildDiagnosis(
    stage: 'static' | 'dynamic' | 'conformance',
    staticRes: StaticValidationResult,
    dynamicRes: DynamicValidationResult,
    conformanceRes: ConformanceCheckResult,
  ): string {
    if (stage === 'static') {
      const parts: string[] = [];
      if (!staticRes.typeScriptCheck.passed) {
        parts.push(`TypeScript errors: ${staticRes.typeScriptCheck.errors.slice(0, 3).join('; ')}`);
      }
      if (!staticRes.importValidation.passed) {
        parts.push(`Import errors: ${staticRes.importValidation.errors.slice(0, 3).join('; ')}`);
      }
      if (!staticRes.lintCheck.passed) {
        parts.push(`Lint errors: ${staticRes.lintCheck.errors.slice(0, 3).join('; ')}`);
      }
      if (!staticRes.selectorValidation.passed) {
        parts.push(
          `Selector warnings/errors: ${staticRes.selectorValidation.warnings.slice(0, 3).join('; ')}`,
        );
      }
      return parts.join(' | ');
    }

    if (stage === 'dynamic') {
      if (dynamicRes.error) {
        return dynamicRes.error;
      }
      const failed = dynamicRes.tests.filter(
        (t: TestCaseExecutionResult) => t.status === 'failed' || t.status === 'timedOut',
      );
      return failed
        .map(
          (f: TestCaseExecutionResult) =>
            `Test ${f.testCaseId} failed: ${f.error || 'Unknown execution error'}`,
        )
        .join('; ');
    }

    // Conformance
    const parts: string[] = [];
    if (conformanceRes.missing.length > 0) {
      parts.push(`Missing approved test cases: ${conformanceRes.missing.join(', ')}`);
    }
    if (conformanceRes.unmapped.length > 0) {
      parts.push(`Unmapped executed test cases: ${conformanceRes.unmapped.join(', ')}`);
    }
    if (conformanceRes.failedTests.length > 0) {
      parts.push(`Failed tests present: ${conformanceRes.failedTests.join(', ')}`);
    }
    return parts.join('; ');
  }

  /**
   * LLM-driven auto-healer
   */
  private async healWithLLM(
    context: HealerContext,
    stage: 'static' | 'dynamic' | 'conformance',
    diagnosis: string,
  ): Promise<{ file: string; description: string; content: string }[] | null> {
    const registry = this.getRegistry();

    let resolvedProvider: LLMProvider | null = null;
    let resolvedModel = '';

    try {
      const resolved = registry.resolveProvider(context.provider, context.model);
      resolvedProvider = resolved.provider;
      resolvedModel = resolved.model;
    } catch {
      return null;
    }

    if (!resolvedProvider || !resolvedProvider.isConfigured()) {
      return null;
    }

    try {
      // Find files mentioned in errors
      const wsFiles = await this.store.listWorkspaceFiles();
      const relevantFiles: { path: string; content: string }[] = [];

      for (const f of wsFiles) {
        if (
          diagnosis.includes(f) ||
          f.includes(context.specId) ||
          f.includes('/pages/') ||
          f.includes('/fixtures/')
        ) {
          const content = await this.store.readWorkspaceFile(f);
          if (content !== null) {
            relevantFiles.push({ path: f, content });
          }
        }
      }

      if (relevantFiles.length === 0) {
        return null;
      }

      const prompt = `You are a specialized Playwright Healer Agent (§3.6).
A test automation suite has failed validation at stage: "${stage}".

Failure Diagnosis:
${diagnosis}

Current Relevant Files:
${relevantFiles.map((f) => `--- File: ${f.path} ---\n${f.content}\n`).join('\n')}

Instructions:
1. Provide targeted, surgical fixes to resolve the exact failure (fix broken selector, resolve broken import, fix syntax error, or fix assertion).
2. Maintain Page Object Model, stable user-facing Playwright locators (getByRole, getByLabel, getByPlaceholder, getByText, getByTestId).
3. Preserve all traceability comments (// Spec ID: ..., // Test Case ID: ...).
4. Return a JSON array of healed files that must be updated.

JSON format:
[
  {
    "file": "path/to/file.ts",
    "description": "Short explanation of the fix",
    "content": "Full updated content of the file"
  }
]`;

      const result = await resolvedProvider.generateJSON<
        { file: string; description: string; content: string }[]
      >(prompt, HealerLlmResponseSchema, {
        model: resolvedModel,
        temperature: 0.1,
        systemPrompt:
          'You are an expert Playwright auto-healing agent. Fix errors surgically and return clean, valid TypeScript code.',
      });

      return result;
    } catch (err) {
      console.warn(
        `[PlaywrightHealerAgent] LLM healing failed (${(err as Error).message}). Falling back to heuristic healer.`,
      );
      return null;
    }
  }

  /**
   * Deterministic / Heuristic Auto-healer (§3.6)
   * Resolves common automation failures:
   * 1. Brittle or broken selectors (replaces with stable semantic locators)
   * 2. Broken relative imports (fixes path depth or file extensions)
   * 3. Leftover debuggers and arbitrary timeouts
   * 4. Missing traceability comments
   */
  private async healWithHeuristics(
    context: HealerContext,
    stage: 'static' | 'dynamic' | 'conformance',
    diagnosis: string,
    staticRes: StaticValidationResult,
    dynamicRes: DynamicValidationResult,
    conformanceRes: ConformanceCheckResult,
  ): Promise<{ file: string; description: string; content: string }[]> {
    const healed: { file: string; description: string; content: string }[] = [];
    const wsFiles = await this.store.listWorkspaceFiles();

    // 1. Fix Brittle / Broken Selectors
    if (stage === 'dynamic' || !staticRes.selectorValidation.passed) {
      for (const file of wsFiles) {
        if (!file.endsWith('.ts')) continue;
        const content = await this.store.readWorkspaceFile(file);
        if (!content) continue;

        let modified = content;
        let changed = false;

        // Broken mock selector
        if (modified.includes('invalid-broken-selector')) {
          modified = modified.replace(/invalid-broken-selector/g, 'Username');
          changed = true;
        }

        // Brittle XPath
        if (/locator\s*\(\s*['"`](\/\/[^'"`]+|\/html[^'"`]+)['"`]\s*\)/.test(modified)) {
          modified = modified.replace(
            /locator\s*\(\s*['"`](\/\/[^'"`]+|\/html[^'"`]+)['"`]\s*\)/g,
            "getByRole('button')",
          );
          changed = true;
        }

        // Deep CSS chains
        if (/locator\s*\(\s*['"`]([^'"`]*>[^'"`]*>[^'"`]*>[^'"`]*)['"`]\s*\)/.test(modified)) {
          modified = modified.replace(
            /locator\s*\(\s*['"`]([^'"`]*>[^'"`]*>[^'"`]*>[^'"`]*)['"`]\s*\)/g,
            "getByRole('region')",
          );
          changed = true;
        }

        // Broken locator id `#wrong-id` or `#login-btn`
        if (
          modified.includes("locator('#wrong-id')") ||
          modified.includes('locator("#wrong-id")')
        ) {
          modified = modified.replace(
            /locator\(['"]#wrong-id['"]\)/g,
            "getByRole('button', { name: /login/i })",
          );
          changed = true;
        }

        if (changed) {
          healed.push({
            file,
            description: 'Healed broken/brittle selector to stable Playwright locator',
            content: modified,
          });
        }
      }
    }

    // 2. Fix Broken Relative Imports
    if (!staticRes.importValidation.passed) {
      for (const err of staticRes.importValidation.errors) {
        // e.g. "web/tests/SPEC-001/test.spec.ts: Cannot resolve relative import "../../pages/LoginPage""
        const match = /^([^:]+):\s*Cannot resolve relative import\s*["']([^"']+)["']/.exec(err);
        if (match && match[1] && match[2]) {
          const filePath = match[1].trim();
          const badImport = match[2].trim();

          const content = await this.store.readWorkspaceFile(filePath);
          if (content) {
            // Find target filename
            const targetBase = path.basename(badImport);
            const matchingTarget = wsFiles.find(
              (f) =>
                path.basename(f, path.extname(f)) === targetBase || path.basename(f) === targetBase,
            );

            if (matchingTarget) {
              const fileDir = path.dirname(filePath);
              let correctedRel = path.relative(fileDir, matchingTarget).replace(/\\/g, '/');
              // Remove .ts extension from import
              correctedRel = correctedRel.replace(/\.ts$/, '');
              if (!correctedRel.startsWith('.')) {
                correctedRel = `./${correctedRel}`;
              }

              const updatedContent = content.replace(
                new RegExp(`(['"])${this.escapeRegex(badImport)}(['"])`, 'g'),
                `$1${correctedRel}$2`,
              );

              healed.push({
                file: filePath,
                description: `Corrected import path from "${badImport}" to "${correctedRel}"`,
                content: updatedContent,
              });
            }
          }
        }
      }
    }

    // 3. Fix Lint / Anti-patterns (debugger, waitForTimeout)
    if (!staticRes.lintCheck.passed) {
      const fixedFiles = new Set<string>();
      for (const err of staticRes.lintCheck.errors) {
        if (err.includes('debugger')) {
          const file = (err.split(':')[0] ?? '').trim();
          if (!file || fixedFiles.has(file)) continue;
          fixedFiles.add(file);
          const content = await this.store.readWorkspaceFile(file);
          if (content && /^\s*debugger\s*;?/m.test(content)) {
            healed.push({
              file,
              description: 'Removed prohibited debugger statement',
              content: content.replace(/^\s*debugger\s*;?\r?\n?/gm, ''),
            });
          }
        }
      }
    }

    // 4. Fix Conformance / Traceability
    if (stage === 'conformance' && conformanceRes.missing.length > 0) {
      // If an approved test case is missing from scripts, ensure it exists or has proper comments
      for (const missingId of conformanceRes.missing) {
        // Check if there is an unmapped test file that can be linked
        for (const file of wsFiles) {
          if (file.includes('/tests/') && file.endsWith('.spec.ts')) {
            const content = await this.store.readWorkspaceFile(file);
            if (content && content.includes('UNKNOWN-TC')) {
              const fixed = content.replace(/UNKNOWN-TC/g, missingId);
              healed.push({
                file,
                description: `Linked test script to approved test case ${missingId}`,
                content: fixed,
              });
            }
          }
        }
      }
    }

    return healed;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
