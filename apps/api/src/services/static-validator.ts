import path from 'node:path';
import type { StaticValidationResult } from '@qaa/shared';
import ts from 'typescript';
import type { FileStore } from '../storage/file-store.js';

const AMBIENT_PLAYWRIGHT_TYPES = `
declare module '@playwright/test' {
  export interface Page {
    goto(url: string, options?: any): Promise<any>;
    locator(selector: string, options?: any): Locator;
    getByRole(role: string, options?: any): Locator;
    getByPlaceholder(text: string | RegExp, options?: any): Locator;
    getByLabel(text: string | RegExp, options?: any): Locator;
    getByText(text: string | RegExp, options?: any): Locator;
    getByTestId(id: string | RegExp): Locator;
    getByAltText(text: string | RegExp): Locator;
    getByTitle(text: string | RegExp): Locator;
    waitForLoadState(state?: string, options?: any): Promise<void>;
    waitForTimeout(timeout: number): Promise<void>;
    [key: string]: any;
  }
  export interface Locator {
    fill(value: string, options?: any): Promise<void>;
    clear(options?: any): Promise<void>;
    click(options?: any): Promise<void>;
    textContent(options?: any): Promise<string | null>;
    isVisible(options?: any): Promise<boolean>;
    waitFor(options?: any): Promise<void>;
    first(): Locator;
    [key: string]: any;
  }
  export interface TestInfo {
    title: string;
    [key: string]: any;
  }
  export interface PlaywrightTestArgs {
    page: Page;
    [key: string]: any;
  }
  export type TestFunction = (args: PlaywrightTestArgs, testInfo?: TestInfo) => Promise<void> | void;
  export function test(title: string, fn: TestFunction): void;
  export namespace test {
    export function describe(title: string, fn: () => void): void;
    export function beforeEach(fn: (args: PlaywrightTestArgs) => Promise<void> | void): void;
    export function afterEach(fn: (args: PlaywrightTestArgs) => Promise<void> | void): void;
  }
  export interface ExpectMatcher {
    toBe(expected: any): any;
    toEqual(expected: any): any;
    toContain(expected: any): any;
    toContainText(expected: any, options?: any): Promise<any>;
    toHaveURL(expected: any, options?: any): Promise<any>;
    toBeVisible(options?: any): Promise<any>;
    toBeDefined(): any;
    toBeTruthy(): any;
    toBeFalsy(): any;
    not: ExpectMatcher;
    [key: string]: any;
  }
  export function expect(actual: any): ExpectMatcher;
  export function defineConfig(config: any): any;
  export const devices: Record<string, any>;
}
`;

export interface StaticValidatorOptions {
  specId?: string;
  allowWarnings?: boolean;
}

export class StaticValidator {
  constructor(private readonly store: FileStore) {}

  /**
   * Performs static validation on files in the temporary workspace (§3.6).
   * 1. TypeScript compilation
   * 2. Lint checks (anti-patterns, assertions, empty blocks)
   * 3. Selector validation (stable locators vs brittle selectors)
   * 4. Import validation (resolvability of internal and external imports)
   */
  async validate(options?: StaticValidatorOptions): Promise<StaticValidationResult> {
    const allFiles = await this.store.listWorkspaceFiles();
    const tsFiles = allFiles.filter((f) => f.endsWith('.ts'));

    if (tsFiles.length === 0) {
      return {
        passed: false,
        typeScriptCheck: {
          passed: false,
          errors: ['No TypeScript files found in workspace to validate.'],
        },
        lintCheck: {
          passed: false,
          errors: ['No files available for linting.'],
          warnings: [],
        },
        selectorValidation: {
          passed: false,
          validCount: 0,
          warnings: ['No files available for selector validation.'],
          locatorsFound: [],
        },
        importValidation: {
          passed: false,
          errors: ['No files available for import validation.'],
          imports: [],
        },
      };
    }

    // Read all files for in-memory inspection
    const fileContents = new Map<string, string>();
    for (const relPath of allFiles) {
      const content = await this.store.readWorkspaceFile(relPath);
      if (content !== null) {
        fileContents.set(relPath.replace(/\\/g, '/'), content);
      }
    }

    // Filter by specId if provided
    const targetTsFiles = options?.specId
      ? tsFiles.filter(
          (f) =>
            !f.includes('/tests/') ||
            f.includes(`/tests/${options.specId}/`) ||
            f.includes(`${options.specId}.spec.ts`) ||
            f.includes('playwright.config.ts'),
        )
      : tsFiles;

    const tsResult = this.checkTypeScript(targetTsFiles, fileContents);
    const lintResult = this.checkLint(targetTsFiles, fileContents);
    const selectorResult = this.checkSelectors(targetTsFiles, fileContents);
    const importResult = this.checkImports(targetTsFiles, fileContents);

    const passed =
      tsResult.passed && lintResult.passed && selectorResult.passed && importResult.passed;

    return {
      passed,
      typeScriptCheck: tsResult,
      lintCheck: lintResult,
      selectorValidation: selectorResult,
      importValidation: importResult,
    };
  }

  /**
   * TypeScript compiler check
   */
  checkTypeScript(
    tsFiles: string[],
    fileMap: Map<string, string>,
  ): { passed: boolean; errors: string[] } {
    const errors: string[] = [];

    // Syntactic diagnostics per file using TypeScript transpile/parser
    for (const file of tsFiles) {
      const content = fileMap.get(file);
      if (content === undefined) continue;

      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
      );

      // Collect syntactic diagnostics
      const sourceDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
        .parseDiagnostics;

      if (sourceDiagnostics && sourceDiagnostics.length > 0) {
        for (const diag of sourceDiagnostics) {
          const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
          const line =
            diag.start !== undefined
              ? sourceFile.getLineAndCharacterOfPosition(diag.start).line + 1
              : 0;
          errors.push(`${file}:${line} - ${msg}`);
        }
      }
    }

    // If no syntactic errors, run semantic check using CompilerHost against workspace
    if (errors.length === 0 && tsFiles.length > 0) {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        esModuleInterop: true,
      };

      const host = ts.createCompilerHost(compilerOptions);
      const originalGetSourceFile = host.getSourceFile;
      const originalFileExists = host.fileExists;
      const originalReadFile = host.readFile;

      host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (fileName.endsWith('__playwright_ambient.d.ts')) {
          return ts.createSourceFile(
            fileName,
            AMBIENT_PLAYWRIGHT_TYPES,
            languageVersion,
            true,
            ts.ScriptKind.TS,
          );
        }
        const normalized = this.normalizeWorkspaceRelPath(fileName);
        if (fileMap.has(normalized)) {
          return ts.createSourceFile(
            fileName,
            fileMap.get(normalized)!,
            languageVersion,
            true,
            fileName.endsWith('.json') ? ts.ScriptKind.JSON : ts.ScriptKind.TS,
          );
        }
        return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
      };

      host.fileExists = (fileName) => {
        if (fileName.endsWith('__playwright_ambient.d.ts')) return true;
        const normalized = this.normalizeWorkspaceRelPath(fileName);
        if (fileMap.has(normalized)) return true;
        return originalFileExists(fileName);
      };

      host.readFile = (fileName) => {
        if (fileName.endsWith('__playwright_ambient.d.ts')) return AMBIENT_PLAYWRIGHT_TYPES;
        const normalized = this.normalizeWorkspaceRelPath(fileName);
        if (fileMap.has(normalized)) return fileMap.get(normalized)!;
        return originalReadFile(fileName);
      };

      const rootFilePaths = [
        ...tsFiles.map((f) => this.store.getWorkspacePath(f)),
        path.join(this.store.tempWorkspaceDir, '__playwright_ambient.d.ts'),
      ];
      const program = ts.createProgram(rootFilePaths, compilerOptions, host);
      const semanticDiagnostics = program.getSemanticDiagnostics();

      for (const diag of semanticDiagnostics) {
        // Filter out lib/node_modules errors that are outside workspace
        if (diag.file) {
          const rel = this.normalizeWorkspaceRelPath(diag.file.fileName);
          if (fileMap.has(rel) && !rel.endsWith('__playwright_ambient.d.ts')) {
            const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
            const line =
              diag.start !== undefined
                ? diag.file.getLineAndCharacterOfPosition(diag.start).line + 1
                : 0;
            errors.push(`${rel}:${line} - TS${diag.code}: ${msg}`);
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }

  /**
   * Lint and style checks (§3.6)
   */
  checkLint(
    tsFiles: string[],
    fileMap: Map<string, string>,
  ): { passed: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of tsFiles) {
      const content = fileMap.get(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i] ?? '';

        // 1. Check for debugger statement
        if (/^\s*debugger\s*;?$/m.test(line.trim())) {
          errors.push(`${file}:${lineNum} - Unexpected "debugger" statement.`);
        }

        // 2. Check for arbitrary timeouts (anti-pattern in Playwright)
        if (/page\.waitForTimeout\s*\(/.test(line)) {
          warnings.push(
            `${file}:${lineNum} - Avoid arbitrary page.waitForTimeout(); prefer locator.waitFor() or web assertions.`,
          );
        }

        // 3. Check for leftover console.log in test scripts
        if (/console\.(log|debug)\s*\(/.test(line) && file.includes('/tests/')) {
          warnings.push(`${file}:${lineNum} - Leftover console statement in test file.`);
        }
      }

      // 4. Test file specific checks
      if (file.includes('/tests/') && file.endsWith('.spec.ts')) {
        const hasTestCall = /\btest\s*\(/i.test(content) || /\btest\.describe\s*\(/i.test(content);
        if (!hasTestCall) {
          errors.push(`${file} - Test file does not define any test cases.`);
        }

        const hasExpect = /\bexpect\s*\(/i.test(content);
        if (!hasExpect) {
          warnings.push(`${file} - Test file contains no assertions (expect statements).`);
        }
      }

      // 5. Page Object specific checks
      if (file.includes('/pages/') && file.endsWith('.ts')) {
        const hasClass = /\bclass\s+\w+/i.test(content);
        if (!hasClass) {
          errors.push(`${file} - Page object file does not define a class.`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Selector validation (§3.5, §3.6)
   * Enforces stable user-facing locators, flags brittle locators (e.g. XPath, deep CSS chains).
   */
  checkSelectors(
    tsFiles: string[],
    fileMap: Map<string, string>,
  ): { passed: boolean; validCount: number; warnings: string[]; locatorsFound: string[] } {
    const warnings: string[] = [];
    const locatorsFound: string[] = [];
    let validCount = 0;

    const stableLocatorPatterns = [
      /getByRole\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /getByPlaceholder\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /getByLabel\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /getByText\s*\(\s*(\/[^/]+\/[a-z]*|['"`][^'"`]+['"`])/g,
      /getByTestId\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /getByAltText\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /getByTitle\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    const brittleLocatorPatterns: { regex: RegExp; reason: string }[] = [
      {
        regex: /(locator|page\.\$)\s*\(\s*['"`](\/\/[^'"`]+|\/html[^'"`]+)['"`]\s*\)/g,
        reason: 'Brittle absolute XPath locator detected',
      },
      {
        regex: /locator\s*\(\s*['"`]xpath=([^'"`]+)['"`]\s*\)/g,
        reason: 'Brittle XPath locator detected; prefer stable user-facing locators',
      },
      {
        regex: /locator\s*\(\s*['"`]([^'"`]*>[^'"`]*>[^'"`]*>[^'"`]*)['"`]\s*\)/g,
        reason: 'Overly deep CSS selector chain detected',
      },
      {
        regex: /locator\s*\(\s*['"`]\.[a-zA-Z0-9_-]*_[a-zA-Z0-9]{5,}\b['"`]\s*\)/g,
        reason: 'Auto-generated or hashed CSS class locator detected',
      },
    ];

    for (const file of tsFiles) {
      const content = fileMap.get(file);
      if (!content) continue;

      // Extract stable locators
      for (const pattern of stableLocatorPatterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          validCount++;
          locatorsFound.push(`${file}: ${match[0].trim()}`);
        }
      }

      // Also check standard page.locator with attributes like [name=...], [type=...]
      const semanticLocatorPattern =
        /locator\s*\(\s*['"`]\[(name|type|id|aria-\w+)='?[^'"\]]+'?\]['"`]\s*\)/g;
      let semMatch: RegExpExecArray | null;
      while ((semMatch = semanticLocatorPattern.exec(content)) !== null) {
        validCount++;
        locatorsFound.push(`${file}: ${semMatch[0].trim()}`);
      }

      // Check for brittle locators
      for (const { regex, reason } of brittleLocatorPatterns) {
        regex.lastIndex = 0;
        let brittleMatch: RegExpExecArray | null;
        while ((brittleMatch = regex.exec(content)) !== null) {
          warnings.push(`${file}: ${reason} -> "${brittleMatch[0].trim()}"`);
        }
      }
    }

    // Selector validation fails only if critical brittle locators exist and no stable locators found
    const passed = warnings.length === 0;

    return {
      passed,
      validCount,
      warnings,
      locatorsFound,
    };
  }

  /**
   * Import validation (§3.6)
   * Verifies that all relative imports point to existing workspace files,
   * and all external imports come from allowed packages.
   */
  checkImports(
    tsFiles: string[],
    fileMap: Map<string, string>,
  ): { passed: boolean; errors: string[]; imports: string[] } {
    const errors: string[] = [];
    const importsFound: string[] = [];

    const allowedPackages = new Set([
      '@playwright/test',
      'playwright',
      'node:path',
      'node:fs',
      'node:fs/promises',
      'node:process',
      'path',
      'fs',
    ]);

    const importRegex =
      /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

    for (const file of tsFiles) {
      const content = fileMap.get(file);
      if (!content) continue;

      importRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        if (!importPath) continue;

        importsFound.push(`${file} -> ${importPath}`);

        if (importPath.startsWith('.')) {
          // Relative import: resolve relative to file
          const fileDir = path.dirname(file);
          const resolvedRel = path.normalize(path.join(fileDir, importPath)).replace(/\\/g, '/');

          const candidateExtensions = ['', '.ts', '.tsx', '.json', '.js', '/index.ts'];
          const exists = candidateExtensions.some((ext) => fileMap.has(resolvedRel + ext));

          if (!exists) {
            errors.push(
              `${file}: Cannot resolve relative import "${importPath}" (target "${resolvedRel}" does not exist in workspace).`,
            );
          }
        } else {
          // Package import
          const basePkg =
            (importPath.startsWith('@')
              ? importPath.split('/').slice(0, 2).join('/')
              : importPath.split('/')[0]) ?? '';

          if (!allowedPackages.has(importPath) && !allowedPackages.has(basePkg)) {
            errors.push(
              `${file}: Disallowed or unverified external package import "${importPath}".`,
            );
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      imports: importsFound,
    };
  }

  private normalizeWorkspaceRelPath(filePath: string): string {
    const ws = this.store.tempWorkspaceDir.replace(/\\/g, '/');
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.startsWith(ws + '/')) {
      return normalized.slice(ws.length + 1);
    }
    // Also handle relative
    return normalized;
  }
}
