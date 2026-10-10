import { describe, expect, it } from 'vitest';
import {
  generateSpecId,
  generateTestCaseId,
  parseSpecId,
  parseTestCaseId,
  sanitizeSlug,
} from '../src/storage/id-generator.js';

describe('ID Generator', () => {
  describe('sanitizeSlug', () => {
    it('normalizes spaces and symbols into uppercase dashes', () => {
      expect(sanitizeSlug('user login flow')).toBe('USER-LOGIN-FLOW');
      expect(sanitizeSlug('auth & permissions!')).toBe('AUTH-PERMISSIONS');
      expect(sanitizeSlug('---hello---')).toBe('HELLO');
    });

    it('falls back to GEN when string is empty or symbols only', () => {
      expect(sanitizeSlug('')).toBe('GEN');
      expect(sanitizeSlug('!!!')).toBe('GEN');
    });
  });

  describe('generateSpecId & parseSpecId', () => {
    it('generates sequential spec ID with slug', () => {
      expect(generateSpecId({ slug: 'login', sequence: 1 })).toBe('SPEC-LOGIN-001');
      expect(generateSpecId({ slug: 'checkout', sequence: 42 })).toBe('SPEC-CHECKOUT-042');
    });

    it('generates spec ID without slug', () => {
      expect(generateSpecId({ sequence: 3 })).toBe('SPEC-003');
    });

    it('defaults sequence to 1 when omitted', () => {
      expect(generateSpecId({ slug: 'cart' })).toBe('SPEC-CART-001');
      expect(generateSpecId()).toBe('SPEC-001');
    });

    it('parses valid spec IDs correctly', () => {
      expect(parseSpecId('SPEC-LOGIN-001')).toEqual({
        valid: true,
        slug: 'LOGIN',
        sequence: 1,
      });

      expect(parseSpecId('SPEC-005')).toEqual({
        valid: true,
        slug: undefined,
        sequence: 5,
      });

      expect(parseSpecId('SPEC-ADMIN-USER-MGMT-123')).toEqual({
        valid: true,
        slug: 'ADMIN-USER-MGMT',
        sequence: 123,
      });
    });

    it('rejects invalid spec IDs', () => {
      expect(parseSpecId('INVALID-ID')).toEqual({ valid: false });
      expect(parseSpecId('SPEC-')).toEqual({ valid: false });
      expect(parseSpecId('SPEC-LOGIN')).toEqual({ valid: false });
    });
  });

  describe('generateTestCaseId & parseTestCaseId', () => {
    it('generates test case ID linked to spec slug', () => {
      expect(generateTestCaseId('SPEC-LOGIN-001', 1)).toBe('TC-LOGIN-001');
      expect(generateTestCaseId('SPEC-LOGIN-001', 5)).toBe('TC-LOGIN-005');
    });

    it('generates test case ID linked to numeric spec', () => {
      expect(generateTestCaseId('SPEC-002', 1)).toBe('TC-002-001');
    });

    it('parses valid test case IDs', () => {
      expect(parseTestCaseId('TC-LOGIN-001')).toEqual({
        valid: true,
        prefix: 'LOGIN',
        index: 1,
      });

      expect(parseTestCaseId('TC-002-010')).toEqual({
        valid: true,
        prefix: '002',
        index: 10,
      });
    });

    it('rejects invalid test case IDs', () => {
      expect(parseTestCaseId('TC-')).toEqual({ valid: false });
      expect(parseTestCaseId('LOGIN-001')).toEqual({ valid: false });
    });
  });
});
