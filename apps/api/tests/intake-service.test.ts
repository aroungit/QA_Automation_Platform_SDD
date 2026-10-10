import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IntakeService } from '../src/services/intake-service.js';
import { FileStore } from '../src/storage/file-store.js';

describe('IntakeService (§3.1–3.3)', () => {
  let tempDir: string;
  let store: FileStore;
  let service: IntakeService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-intake-test-'));
    store = new FileStore({
      rootDir: tempDir,
      specsDir: path.join(tempDir, 'specs'),
      automationDir: path.join(tempDir, 'automation'),
      reportsDir: path.join(tempDir, 'reports'),
      tempWorkspaceDir: path.join(tempDir, '.workspace'),
    });
    await store.init();
    service = new IntakeService(store);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('processes user story intake, assigns unique specId, and saves artifacts (§3.1)', async () => {
    const payload = await service.processIntake({
      title: 'OrangeHRM Login',
      story: 'As an HR user, I want to log in to OrangeHRM, so that I can access the dashboard.',
      acceptanceCriteria: [
        'Valid credentials redirect to dashboard',
        'Invalid credentials show error message',
      ],
      priority: 'high',
      platform: 'web',
      targetApp: 'OrangeHRM',
      slug: 'LOGIN',
    });

    expect(payload.specId).toBe('SPEC-LOGIN-001');
    expect(payload.userStory).toContain('# User Story: OrangeHRM Login');
    expect(payload.userStoryJson?.title).toBe('OrangeHRM Login');
    expect(payload.userStoryJson?.priority).toBe('high');
    expect(payload.approvalRecord?.status).toBe('Draft');
    expect(payload.approvalRecord?.reviewer).toBe('System');

    // Second intake with same slug gets sequence 002
    const secondPayload = await service.processIntake({
      title: 'OrangeHRM Login Two',
      story: 'Another story',
      acceptanceCriteria: ['Condition one'],
      slug: 'LOGIN',
    });
    expect(secondPayload.specId).toBe('SPEC-LOGIN-002');
  });

  it('generates specification and test cases on intake when requested (§3.1–3.3)', async () => {
    const payload = await service.processIntake({
      title: 'Employee Search',
      story: 'As an HR manager, I want to search for employees by name',
      acceptanceCriteria: [
        'Matching records are displayed in table',
        'No records found message for unknown query',
      ],
      slug: 'EMP-SEARCH',
      generateSpec: true,
      generateTestCases: true,
    });

    expect(payload.specId).toBe('SPEC-EMP-SEARCH-001');

    // Specification artifacts
    expect(payload.specification).toBeDefined();
    expect(payload.specification).toContain('# Specification: Employee Search');
    expect(payload.specificationJson).toBeDefined();
    expect(payload.specificationJson?.specId).toBe('SPEC-EMP-SEARCH-001');

    // Test Cases artifacts
    expect(payload.testCases).toBeDefined();
    expect(payload.testCases).toContain('# Test Cases: Employee Search');
    expect(payload.testCasesJson).toBeDefined();
    expect(payload.testCasesJson!.length).toBeGreaterThan(0);
    expect(payload.testCasesJson![0]?.specId).toBe('SPEC-EMP-SEARCH-001');
  });

  it('generates specification for an existing specId (§3.2)', async () => {
    const intake = await service.processIntake({
      title: 'Leave Request',
      story: 'As an employee, I want to apply for annual leave',
      acceptanceCriteria: [
        'Available leave balance decreases on submission',
        'Error displayed if requested days exceed balance',
      ],
      slug: 'LEAVE',
    });

    expect(intake.specification).toBeUndefined();

    const result = await service.generateSpecification(intake.specId);
    expect(result.specification).toBeDefined();
    expect(result.specificationJson?.title).toBe('Leave Request');
    expect(result.specificationJson?.specId).toBe(intake.specId);
    expect(result.specificationJson?.mainFlow.length).toBeGreaterThan(0);
  });

  it('generates test cases for an existing specification (§3.3)', async () => {
    const intake = await service.processIntake({
      title: 'Admin User Management',
      story: 'As an admin, I want to add new system users',
      acceptanceCriteria: [
        'New user is saved and active',
        'Duplicate username is rejected with validation error',
      ],
      slug: 'ADMIN-USER',
      generateSpec: true,
    });

    const result = await service.generateTestCases(intake.specId);
    expect(result.testCases).toBeDefined();
    expect(result.testCasesJson).toBeDefined();
    expect(result.testCasesJson!.length).toBeGreaterThanOrEqual(2);
    expect(result.testCasesJson!.every((t) => t.specId === intake.specId)).toBe(true);
  });

  it('lists specifications with summary metadata (§3.7)', async () => {
    await service.processIntake({
      title: 'Story A',
      story: 'Story description A',
      acceptanceCriteria: ['Criteria A'],
      slug: 'STORY-A',
      generateSpec: true,
      generateTestCases: true,
    });

    await service.processIntake({
      title: 'Story B',
      story: 'Story description B',
      acceptanceCriteria: ['Criteria B'],
      slug: 'STORY-B',
    });

    const list = await service.listSpecs();
    expect(list.length).toBe(2);

    const a = list.find((s) => s.specId.includes('STORY-A'));
    expect(a).toBeDefined();
    expect(a?.hasUserStory).toBe(true);
    expect(a?.hasSpecification).toBe(true);
    expect(a?.hasTestCases).toBe(true);
    expect(a?.testCaseCount).toBeGreaterThan(0);

    const b = list.find((s) => s.specId.includes('STORY-B'));
    expect(b).toBeDefined();
    expect(b?.hasSpecification).toBe(false);
  });

  it('updates user story, specification, and test cases', async () => {
    const intake = await service.processIntake({
      title: 'Profile Update',
      story: 'Update profile info',
      acceptanceCriteria: ['Profile updated'],
      slug: 'PROFILE',
    });

    // Update story
    const updatedStory = await service.updateUserStory(intake.specId, {
      title: 'Profile Photo Update',
    });
    expect(updatedStory.userStoryJson?.title).toBe('Profile Photo Update');

    // Update spec
    const updatedSpec = await service.updateSpecification(intake.specId, {
      specId: intake.specId,
      title: 'Profile Photo Update',
      businessObjective: 'Allow uploading photo',
      actors: ['User'],
      preconditions: ['Logged in'],
      mainFlow: [{ step: 1, action: 'Upload PNG', expected: 'Photo displayed' }],
      alternateFlows: [],
      exceptionFlows: [],
      dataRequirements: [],
      acceptanceCriteria: ['Photo updated'],
      nonFunctionalRequirements: [],
      targetApp: 'OrangeHRM',
      environment: 'default',
    });
    expect(updatedSpec.specificationJson?.title).toBe('Profile Photo Update');

    // Delete spec
    const deleted = await service.deleteSpec(intake.specId);
    expect(deleted).toBe(true);
    expect(await service.getSpec(intake.specId)).toBeNull();
  });
});
