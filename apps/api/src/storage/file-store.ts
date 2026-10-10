import fs from 'node:fs/promises';
import path from 'node:path';
import type { ApprovalRecord, PromotionRecord } from '@qaa/shared';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import { parseSpecId } from './id-generator.js';

export interface SpecArtifactsInput {
  userStory?: string;
  userStoryJson?: unknown;
  specification?: string;
  specificationJson?: unknown;
  testCases?: string;
  testCasesJson?: unknown;
  approvalRecord?: ApprovalRecord;
  promotionRecord?: PromotionRecord;
}

export interface SpecArtifacts {
  specId: string;
  userStory?: string;
  userStoryJson?: unknown;
  specification?: string;
  specificationJson?: unknown;
  testCases?: string;
  testCasesJson?: unknown;
  approvalRecord?: ApprovalRecord;
  promotionRecord?: PromotionRecord;
  files: string[];
}

export interface SpecSummary {
  specId: string;
  title?: string;
  status: string;
  hasUserStory: boolean;
  hasSpecification: boolean;
  hasTestCases: boolean;
  hasApprovalRecord: boolean;
  hasPromotionRecord?: boolean;
  testCaseCount?: number;
  targetApp?: string;
  platform?: string;
  priority?: string;
  promoted?: boolean;
  revalidationRequired?: boolean;
  updatedAt: string;
}

export class FileStore {
  readonly specsDir: string;
  readonly automationDir: string;
  readonly reportsDir: string;
  readonly tempWorkspaceDir: string;

  constructor(storageConfig?: AppConfig['storage']) {
    const config = storageConfig ?? getConfig().storage;
    this.specsDir = config.specsDir;
    this.automationDir = config.automationDir;
    this.reportsDir = config.reportsDir;
    this.tempWorkspaceDir = config.tempWorkspaceDir;
  }

  /**
   * Ensure all base folders exist according to §3.7
   */
  async init(): Promise<void> {
    await fs.mkdir(this.specsDir, { recursive: true });
    await fs.mkdir(this.tempWorkspaceDir, { recursive: true });

    const automationSubdirs = ['pages', 'tests', 'fixtures', 'utils'];
    for (const platform of ['web', 'mobile'] as const) {
      for (const sub of automationSubdirs) {
        await fs.mkdir(path.join(this.automationDir, platform, sub), { recursive: true });
      }
    }

    await fs.mkdir(path.join(this.reportsDir, 'execution-results'), { recursive: true });
  }

  // ==========================================
  // Specifications Store (§3.7)
  // ==========================================

  getSpecDir(specId: string): string {
    return path.join(this.specsDir, specId);
  }

  async specExists(specId: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.getSpecDir(specId));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async saveSpecArtifacts(specId: string, artifacts: SpecArtifactsInput): Promise<string> {
    const dir = this.getSpecDir(specId);
    await fs.mkdir(dir, { recursive: true });

    if (artifacts.userStory !== undefined) {
      await fs.writeFile(path.join(dir, 'user-story.md'), artifacts.userStory, 'utf-8');
    }
    if (artifacts.userStoryJson !== undefined) {
      await fs.writeFile(
        path.join(dir, 'user-story.json'),
        JSON.stringify(artifacts.userStoryJson, null, 2),
        'utf-8',
      );
    }
    if (artifacts.specification !== undefined) {
      await fs.writeFile(path.join(dir, 'specification.md'), artifacts.specification, 'utf-8');
    }
    if (artifacts.specificationJson !== undefined) {
      await fs.writeFile(
        path.join(dir, 'specification.json'),
        JSON.stringify(artifacts.specificationJson, null, 2),
        'utf-8',
      );
    }
    if (artifacts.testCases !== undefined) {
      await fs.writeFile(path.join(dir, 'test-cases.md'), artifacts.testCases, 'utf-8');
    }
    if (artifacts.testCasesJson !== undefined) {
      await fs.writeFile(
        path.join(dir, 'test-cases.json'),
        JSON.stringify(artifacts.testCasesJson, null, 2),
        'utf-8',
      );
    }
    if (artifacts.approvalRecord !== undefined) {
      await fs.writeFile(
        path.join(dir, 'approval-record.json'),
        JSON.stringify(artifacts.approvalRecord, null, 2),
        'utf-8',
      );
    }
    if (artifacts.promotionRecord !== undefined) {
      await fs.writeFile(
        path.join(dir, 'promotion-record.json'),
        JSON.stringify(artifacts.promotionRecord, null, 2),
        'utf-8',
      );
    }

    return dir;
  }

  async readSpecArtifacts(specId: string): Promise<SpecArtifacts | null> {
    const dir = this.getSpecDir(specId);
    try {
      const entries = await fs.readdir(dir);
      const result: SpecArtifacts = {
        specId,
        files: entries,
      };

      if (entries.includes('user-story.md')) {
        result.userStory = await fs.readFile(path.join(dir, 'user-story.md'), 'utf-8');
      }
      if (entries.includes('user-story.json')) {
        const raw = await fs.readFile(path.join(dir, 'user-story.json'), 'utf-8');
        try {
          result.userStoryJson = JSON.parse(raw);
        } catch {
          // ignore parse error
        }
      }
      if (entries.includes('specification.md')) {
        result.specification = await fs.readFile(path.join(dir, 'specification.md'), 'utf-8');
      }
      if (entries.includes('specification.json')) {
        const raw = await fs.readFile(path.join(dir, 'specification.json'), 'utf-8');
        try {
          result.specificationJson = JSON.parse(raw);
        } catch {
          // ignore parse error
        }
      }
      if (entries.includes('test-cases.md')) {
        result.testCases = await fs.readFile(path.join(dir, 'test-cases.md'), 'utf-8');
      }
      if (entries.includes('test-cases.json')) {
        const raw = await fs.readFile(path.join(dir, 'test-cases.json'), 'utf-8');
        try {
          result.testCasesJson = JSON.parse(raw);
        } catch {
          // ignore parse error
        }
      }
      if (entries.includes('approval-record.json')) {
        const raw = await fs.readFile(path.join(dir, 'approval-record.json'), 'utf-8');
        try {
          result.approvalRecord = JSON.parse(raw) as ApprovalRecord;
        } catch {
          // ignore parse error
        }
      }
      if (entries.includes('promotion-record.json')) {
        const raw = await fs.readFile(path.join(dir, 'promotion-record.json'), 'utf-8');
        try {
          result.promotionRecord = JSON.parse(raw) as PromotionRecord;
        } catch {
          // ignore parse error
        }
      }

      return result;
    } catch {
      return null;
    }
  }

  async deleteSpec(specId: string): Promise<boolean> {
    try {
      const dir = this.getSpecDir(specId);
      await fs.rm(dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async listSpecs(): Promise<SpecSummary[]> {
    try {
      const entries = await fs.readdir(this.specsDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      const summaries: SpecSummary[] = [];

      for (const dir of dirs) {
        const specId = dir.name;
        const specPath = path.join(this.specsDir, specId);
        const files: string[] = await fs.readdir(specPath).catch(() => [] as string[]);
        const stat = await fs.stat(specPath).catch(() => null);

        let status = 'Draft';
        if (files.includes('approval-record.json')) {
          try {
            const raw = await fs.readFile(path.join(specPath, 'approval-record.json'), 'utf-8');
            const parsed = JSON.parse(raw) as { status?: string };
            if (parsed.status) status = parsed.status;
          } catch {
            // keep Draft
          }
        }

        let title: string | undefined;
        let targetApp: string | undefined;
        let platform: string | undefined;
        let priority: string | undefined;

        if (files.includes('user-story.json')) {
          try {
            const raw = await fs.readFile(path.join(specPath, 'user-story.json'), 'utf-8');
            const parsed = JSON.parse(raw) as {
              title?: string;
              targetApp?: string;
              platform?: string;
              priority?: string;
            };
            title = parsed.title;
            targetApp = parsed.targetApp;
            platform = parsed.platform;
            priority = parsed.priority;
          } catch {
            // ignore
          }
        } else if (files.includes('specification.json')) {
          try {
            const raw = await fs.readFile(path.join(specPath, 'specification.json'), 'utf-8');
            const parsed = JSON.parse(raw) as { title?: string; targetApp?: string };
            title = parsed.title;
            targetApp = parsed.targetApp;
          } catch {
            // ignore
          }
        }

        let testCaseCount: number | undefined;
        if (files.includes('test-cases.json')) {
          try {
            const raw = await fs.readFile(path.join(specPath, 'test-cases.json'), 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              testCaseCount = parsed.length;
            }
          } catch {
            // ignore
          }
        }

        let promoted = false;
        let revalidationRequired = false;
        if (files.includes('promotion-record.json')) {
          try {
            const raw = await fs.readFile(path.join(specPath, 'promotion-record.json'), 'utf-8');
            const parsed = JSON.parse(raw) as PromotionRecord;
            promoted = parsed.status === 'promoted';
            revalidationRequired = Boolean(parsed.revalidationRequired);
          } catch {
            // ignore
          }
        }

        summaries.push({
          specId,
          title,
          status,
          hasUserStory: files.includes('user-story.md'),
          hasSpecification: files.includes('specification.md'),
          hasTestCases: files.includes('test-cases.md'),
          hasApprovalRecord: files.includes('approval-record.json'),
          hasPromotionRecord: files.includes('promotion-record.json'),
          testCaseCount,
          targetApp,
          platform,
          priority,
          promoted,
          revalidationRequired,
          updatedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
        });
      }

      return summaries;
    } catch {
      return [];
    }
  }

  async getNextSpecSequence(slug?: string): Promise<number> {
    const list = await this.listSpecs();
    let maxSeq = 0;
    for (const item of list) {
      const parsed = parseSpecId(item.specId);
      if (parsed.valid && parsed.sequence !== undefined) {
        if (!slug || (parsed.slug && parsed.slug.toUpperCase() === slug.toUpperCase())) {
          if (parsed.sequence > maxSeq) {
            maxSeq = parsed.sequence;
          }
        }
      }
    }
    return maxSeq + 1;
  }

  // ==========================================
  // Promotion Record Store (§3.7)
  // ==========================================

  async savePromotionRecord(specId: string, record: PromotionRecord): Promise<string> {
    const dir = this.getSpecDir(specId);
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, 'promotion-record.json');
    await fs.writeFile(fullPath, JSON.stringify(record, null, 2), 'utf-8');
    return fullPath;
  }

  async readPromotionRecord(specId: string): Promise<PromotionRecord | null> {
    const fullPath = path.join(this.getSpecDir(specId), 'promotion-record.json');
    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(raw) as PromotionRecord;
    } catch {
      return null;
    }
  }

  async getSpecFileMtimes(specId: string): Promise<Record<string, Date>> {
    const dir = this.getSpecDir(specId);
    const mtimes: Record<string, Date> = {};
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        try {
          const stat = await fs.stat(path.join(dir, entry));
          mtimes[entry] = stat.mtime;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return mtimes;
  }

  // ==========================================
  // Workspace Store (Temporary / Validation)
  // ==========================================

  getWorkspacePath(...parts: string[]): string {
    return path.join(this.tempWorkspaceDir, ...parts);
  }

  async writeWorkspaceFile(relPath: string, content: string): Promise<string> {
    const fullPath = this.getWorkspacePath(relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }

  async readWorkspaceFile(relPath: string): Promise<string | null> {
    try {
      const fullPath = this.getWorkspacePath(relPath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listWorkspaceFiles(subDir = ''): Promise<string[]> {
    const targetDir = this.getWorkspacePath(subDir);
    try {
      const results: string[] = [];
      const traverse = async (current: string, rel: string) => {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const entryRel = path.join(rel, entry.name);
          const entryFull = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await traverse(entryFull, entryRel);
          } else {
            results.push(entryRel.replace(/\\/g, '/'));
          }
        }
      };
      await traverse(targetDir, '');
      return results;
    } catch {
      return [];
    }
  }

  async cleanWorkspace(): Promise<void> {
    try {
      await fs.rm(this.tempWorkspaceDir, { recursive: true, force: true });
      await fs.mkdir(this.tempWorkspaceDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  // ==========================================
  // Automation Store (Promoted repository files)
  // ==========================================

  getAutomationPath(
    platform: 'web' | 'mobile',
    category: 'pages' | 'tests' | 'fixtures' | 'utils',
    filename: string,
  ): string {
    return path.join(this.automationDir, platform, category, filename);
  }

  async saveAutomationFile(
    platform: 'web' | 'mobile',
    category: 'pages' | 'tests' | 'fixtures' | 'utils',
    filename: string,
    content: string,
  ): Promise<string> {
    const fullPath = this.getAutomationPath(platform, category, filename);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }

  async readAutomationFile(
    platform: 'web' | 'mobile',
    category: 'pages' | 'tests' | 'fixtures' | 'utils',
    filename: string,
  ): Promise<string | null> {
    try {
      return await fs.readFile(this.getAutomationPath(platform, category, filename), 'utf-8');
    } catch {
      return null;
    }
  }

  async writeAutomationFile(relPath: string, content: string): Promise<string> {
    const fullPath = path.join(this.automationDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }

  async readAutomationFileDirect(relPath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.automationDir, relPath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listAllAutomationFiles(): Promise<string[]> {
    try {
      const results: string[] = [];
      const traverse = async (current: string, rel: string) => {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
          const entryFull = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await traverse(entryFull, entryRel);
          } else {
            results.push(entryRel.replace(/\\/g, '/'));
          }
        }
      };
      await traverse(this.automationDir, '');
      return results;
    } catch {
      return [];
    }
  }

  async listAutomationFiles(
    platform: 'web' | 'mobile',
    category?: 'pages' | 'tests' | 'fixtures' | 'utils',
  ): Promise<string[]> {
    const base = category
      ? path.join(this.automationDir, platform, category)
      : path.join(this.automationDir, platform);
    try {
      const results: string[] = [];
      const traverse = async (current: string, rel: string) => {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
          const entryFull = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await traverse(entryFull, entryRel);
          } else {
            results.push(entryRel);
          }
        }
      };
      await traverse(base, '');
      return results;
    } catch {
      return [];
    }
  }

  // ==========================================
  // Reports Store (§3.7)
  // ==========================================

  async saveExecutionReport(reportId: string, content: string | object): Promise<string> {
    const fullPath = path.join(this.reportsDir, 'execution-results', `${reportId}.json`);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await fs.writeFile(fullPath, text, 'utf-8');
    return fullPath;
  }

  async readExecutionReport(reportId: string): Promise<string | null> {
    const fullPath = path.join(this.reportsDir, 'execution-results', `${reportId}.json`);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listExecutionReports(): Promise<string[]> {
    const dir = path.join(this.reportsDir, 'execution-results');
    try {
      const entries = await fs.readdir(dir);
      return entries.filter((e) => e.endsWith('.json')).map((e) => e.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }
}

let defaultStore: FileStore | null = null;

export function getFileStore(): FileStore {
  if (!defaultStore) {
    defaultStore = new FileStore();
  }
  return defaultStore;
}
