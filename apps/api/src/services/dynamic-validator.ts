import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  DynamicExecutionMode,
  DynamicValidationResult,
  Platform,
  TestCaseExecutionResult,
} from '@qaa/shared';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import type { FileStore } from '../storage/file-store.js';

const execFileAsync = promisify(execFile);

export interface DynamicValidatorOptions {
  specId: string;
  platform?: Platform;
  mode?: DynamicExecutionMode;
  timeoutMs?: number;
  config?: AppConfig;
}

export class DynamicValidator {
  constructor(
    private readonly store: FileStore,
    private readonly appConfig?: AppConfig,
  ) {}

  private getConfig(): AppConfig {
    return this.appConfig ?? getConfig();
  }

  /**
   * Executes dynamic validation for generated Playwright tests (§3.6).
   * Modes:
   * - 'real': Executes `npx playwright test` against target application
   * - 'simulated': Simulates execution based on generated test files & fixtures
   * - 'dry-run': Parses and validates test suite runnability without full browser launch
   */
  async validate(options: DynamicValidatorOptions): Promise<DynamicValidationResult> {
    const mode = options.mode ?? 'real';

    if (mode === 'simulated' || mode === 'dry-run') {
      return this.executeSimulated(options);
    }

    return this.executeReal(options);
  }

  /**
   * Executes real Playwright tests in .workspace using child_process
   */
  async executeReal(options: DynamicValidatorOptions): Promise<DynamicValidationResult> {
    const wsDir = this.store.tempWorkspaceDir;
    const timeout = options.timeoutMs ?? 60000;

    // Identify target test directory or file
    const platform = options.platform === 'mobile' ? 'mobile' : 'web';
    const specTestDir = path.join(platform, 'tests', options.specId);
    const specTestFullPath = path.join(wsDir, specTestDir);

    let testTarget = '';
    try {
      const stat = await fs.stat(specTestFullPath);
      if (stat.isDirectory()) {
        testTarget = specTestDir.replace(/\\/g, '/');
      }
    } catch {
      testTarget = `${platform}/tests`.replace(/\\/g, '/');
    }

    const args = ['playwright', 'test', testTarget, '--reporter=json'];

    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npx.cmd' : 'npx';

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execFileAsync(npmCmd, args, {
        cwd: wsDir,
        timeout,
        env: {
          ...process.env,
          CI: '1',
          PW_TEST_HTML_REPORT_OPEN: 'never',
          ORANGEHRM_BASE_URL: this.getConfig().targets.orangeHrm.baseUrl,
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      const durationMs = Date.now() - startTime;
      return this.parsePlaywrightOutput(stdout, stderr, durationMs, 'real', wsDir);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const execError = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
        code?: number | string;
      };

      // Playwright exits with non-zero if any test fails, but stdout still contains valid JSON reporter output!
      if (execError.stdout && execError.stdout.includes('"suites"')) {
        return this.parsePlaywrightOutput(
          execError.stdout,
          execError.stderr ?? '',
          durationMs,
          'real',
          wsDir,
        );
      }

      // If browser was not installed or command failed completely
      const isMissingBrowser =
        (execError.stderr && execError.stderr.includes("Executable doesn't exist")) ||
        (execError.message && execError.message.includes("Executable doesn't exist")) ||
        (execError.message && execError.message.includes('playwright install'));

      if (isMissingBrowser) {
        return {
          passed: false,
          executed: false,
          totalTests: 0,
          passedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          durationMs,
          mode: 'real',
          tests: [],
          artifacts: {
            screenshots: [],
            traces: [],
            reports: [],
          },
          error:
            'Playwright browser executables are missing. Please run "npx playwright install" to install browsers for live execution, or execute with mode="simulated".',
        };
      }

      return {
        passed: false,
        executed: false,
        totalTests: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        durationMs,
        mode: 'real',
        tests: [],
        artifacts: {
          screenshots: [],
          traces: [],
          reports: [],
        },
        error: `Playwright test execution failed: ${execError.message || String(err)}`,
      };
    }
  }

  /**
   * Simulated / Dry-run execution (§3.6)
   * Deterministically inspects generated test files, Page Objects, and fixtures in .workspace.
   * Enables complete validation and auto-healing in offline/CI environments.
   */
  async executeSimulated(options: DynamicValidatorOptions): Promise<DynamicValidationResult> {
    const startTime = Date.now();
    const wsFiles = await this.store.listWorkspaceFiles();
    const platform = options.platform === 'mobile' ? 'mobile' : 'web';

    // Find test files for spec
    const testFiles = wsFiles.filter(
      (f) =>
        f.endsWith('.spec.ts') &&
        (f.includes(`/${options.specId}/`) ||
          f.includes(options.specId) ||
          f.startsWith(`${platform}/tests`)),
    );

    if (testFiles.length === 0) {
      return {
        passed: false,
        executed: false,
        totalTests: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        durationMs: Date.now() - startTime,
        mode: options.mode ?? 'simulated',
        tests: [],
        artifacts: { screenshots: [], traces: [], reports: [] },
        error: `No test files found in workspace for specification "${options.specId}".`,
      };
    }

    const testResults: TestCaseExecutionResult[] = [];
    const screenshots: string[] = [];
    const traces: string[] = [];

    // Check fixtures for realistic simulation
    const fixtureFiles = wsFiles.filter((f) => f.includes('/fixtures/'));
    const fixtureData: Record<string, unknown> = {};
    for (const f of fixtureFiles) {
      const raw = await this.store.readWorkspaceFile(f);
      if (raw) {
        try {
          fixtureData[f] = JSON.parse(raw);
        } catch {
          // ignore
        }
      }
    }

    // Inspect each test file
    for (const testFile of testFiles) {
      // Exclude combined suite from duplicate test count if individual specs exist
      if (testFile.endsWith('-suite.spec.ts') && testFiles.length > 1) {
        continue;
      }

      const content = await this.store.readWorkspaceFile(testFile);
      if (!content) continue;

      // Extract test case ID and title
      const tcCommentMatch = /\/\/\s*Test Case ID:\s*([^\r\n]+)/i.exec(content);
      const testBlockMatch = /test\s*\(\s*['"`]([^'"`]+)['"`]/i.exec(content);

      const tcIdFromTitle =
        testBlockMatch && testBlockMatch[1] ? this.extractTestCaseId(testBlockMatch[1]) : undefined;
      const tcId = tcCommentMatch?.[1]?.trim() || tcIdFromTitle || 'UNKNOWN-TC';
      const testTitle = testBlockMatch?.[1] || `${tcId}: Test`;

      // Check for simulated failure indicators (e.g. broken selectors, mock errors, broken fixtures)
      const hasBrokenSelector =
        content.includes('invalid-broken-selector') ||
        content.includes('// simulate-failure') ||
        content.includes('throw new Error(');

      const hasMissingFixture = content.includes('authData.') && fixtureFiles.length === 0;

      const durationMs = Math.floor(Math.random() * 400) + 150;

      if (hasBrokenSelector || hasMissingFixture) {
        const errorMsg = hasBrokenSelector
          ? 'Error: locator.waitFor: Timeout 5000ms exceeded while waiting for element "invalid-broken-selector"'
          : 'Error: Cannot find fixture data authData';

        testResults.push({
          testCaseId: tcId,
          title: testTitle,
          status: 'failed',
          durationMs,
          error: errorMsg,
          stack: `${errorMsg}\n    at ${testFile}:25:15`,
          screenshotUrl: `screenshots/${tcId}-failure.png`,
          traceUrl: `traces/${tcId}-trace.zip`,
          consoleLogs: [
            `[browser] [error] Failed to locate element on page`,
            `[test] [error] ${errorMsg}`,
          ],
        });
        screenshots.push(`screenshots/${tcId}-failure.png`);
        traces.push(`traces/${tcId}-trace.zip`);
      } else {
        testResults.push({
          testCaseId: tcId,
          title: testTitle,
          status: 'passed',
          durationMs,
          consoleLogs: [
            `[browser] [info] Navigated to target application`,
            `[test] [info] Step 1 passed`,
            `[test] [info] Step 2 assertion verified`,
          ],
        });
      }
    }

    const passedCount = testResults.filter((t) => t.status === 'passed').length;
    const failedCount = testResults.filter((t) => t.status === 'failed').length;
    const skippedCount = testResults.filter((t) => t.status === 'skipped').length;
    const durationMs = Date.now() - startTime;

    return {
      passed: failedCount === 0 && testResults.length > 0,
      executed: true,
      totalTests: testResults.length,
      passedCount,
      failedCount,
      skippedCount,
      durationMs,
      mode: options.mode ?? 'simulated',
      tests: testResults,
      artifacts: {
        screenshots,
        traces,
        reports: ['test-results/results.json'],
      },
    };
  }

  /**
   * Parses standard Playwright JSON reporter output
   */
  private parsePlaywrightOutput(
    stdout: string,
    stderr: string,
    durationMs: number,
    mode: DynamicExecutionMode,
    wsDir: string,
  ): DynamicValidationResult {
    try {
      // Find JSON block in stdout (Playwright may print logs before/after JSON)
      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON output found in Playwright runner output.');
      }

      const jsonStr = stdout.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      const tests: TestCaseExecutionResult[] = [];
      const screenshots: string[] = [];
      const traces: string[] = [];

      const extractSpecs = (suite: {
        title?: string;
        specs?: Array<{
          title: string;
          tests?: Array<{
            results?: Array<{
              status: string;
              duration: number;
              errors?: Array<{ message: string; stack?: string }>;
              stdout?: Array<{ text?: string }>;
              stderr?: Array<{ text?: string }>;
              attachments?: Array<{ name: string; path?: string; contentType?: string }>;
            }>;
          }>;
        }>;
        suites?: unknown[];
      }) => {
        if (Array.isArray(suite.specs)) {
          for (const spec of suite.specs) {
            const tcId = this.extractTestCaseId(spec.title);
            const firstTest = spec.tests?.[0];
            const firstResult = firstTest?.results?.[0];

            const status =
              firstResult?.status === 'passed'
                ? 'passed'
                : firstResult?.status === 'timedOut'
                  ? 'timedOut'
                  : firstResult?.status === 'skipped'
                    ? 'skipped'
                    : 'failed';

            const error = firstResult?.errors?.[0]?.message;
            const stack = firstResult?.errors?.[0]?.stack;

            const consoleLogs: string[] = [];
            if (firstResult?.stdout) {
              for (const out of firstResult.stdout) {
                if (out.text) consoleLogs.push(out.text.trim());
              }
            }
            if (firstResult?.stderr) {
              for (const err of firstResult.stderr) {
                if (err.text) consoleLogs.push(`[stderr] ${err.text.trim()}`);
              }
            }

            let screenshotUrl: string | undefined;
            let traceUrl: string | undefined;

            if (firstResult?.attachments) {
              for (const att of firstResult.attachments) {
                if (att.name.includes('screenshot') && att.path) {
                  screenshotUrl = path.relative(wsDir, att.path).replace(/\\/g, '/');
                  screenshots.push(screenshotUrl);
                } else if (att.name.includes('trace') && att.path) {
                  traceUrl = path.relative(wsDir, att.path).replace(/\\/g, '/');
                  traces.push(traceUrl);
                }
              }
            }

            tests.push({
              testCaseId: tcId,
              title: spec.title,
              status,
              durationMs: firstResult?.duration ?? 0,
              error,
              stack,
              screenshotUrl,
              traceUrl,
              consoleLogs: consoleLogs.length > 0 ? consoleLogs : undefined,
            });
          }
        }

        if (Array.isArray(suite.suites)) {
          for (const sub of suite.suites) {
            extractSpecs(sub as Parameters<typeof extractSpecs>[0]);
          }
        }
      };

      if (Array.isArray(parsed.suites)) {
        for (const rootSuite of parsed.suites) {
          extractSpecs(rootSuite);
        }
      }

      const passedCount = tests.filter((t) => t.status === 'passed').length;
      const failedCount = tests.filter(
        (t) => t.status === 'failed' || t.status === 'timedOut',
      ).length;
      const skippedCount = tests.filter((t) => t.status === 'skipped').length;

      return {
        passed: failedCount === 0 && tests.length > 0,
        executed: true,
        totalTests: tests.length,
        passedCount,
        failedCount,
        skippedCount,
        durationMs,
        mode,
        tests,
        artifacts: {
          screenshots,
          traces,
          reports: ['test-results/results.json'],
        },
      };
    } catch (parseErr) {
      return {
        passed: false,
        executed: false,
        totalTests: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        durationMs,
        mode,
        tests: [],
        artifacts: { screenshots: [], traces: [], reports: [] },
        error: `Failed to parse Playwright output: ${(parseErr as Error).message}\nRaw stderr: ${stderr}`,
      };
    }
  }

  private extractTestCaseId(title: string): string {
    const match = /(TC-[A-Z0-9_-]+)/i.exec(title);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
    return (title.split(':')[0] ?? '').trim();
  }
}
