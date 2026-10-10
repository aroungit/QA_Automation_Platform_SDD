/**
 * ID generator for Specifications and Test Cases
 * Conventions follow SDD architecture:
 * - Specification: SPEC-<SLUG>-<001> or SPEC-<001>
 * - Test Case: TC-<SLUG>-<001> or TC-<SPEC_NUMBER>-<001>
 */

export interface SpecIdOptions {
  slug?: string;
  sequence?: number;
}

export function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'GEN';
}

export function generateSpecId(options?: SpecIdOptions): string {
  const seq = (options?.sequence ?? 1).toString().padStart(3, '0');
  if (options?.slug) {
    const slug = sanitizeSlug(options.slug);
    return `SPEC-${slug}-${seq}`;
  }
  return `SPEC-${seq}`;
}

export function parseSpecId(specId: string): { valid: boolean; slug?: string; sequence?: number } {
  const match = specId.match(/^SPEC(?:-([A-Z0-9-]+))?-(\d{3,})$/);
  if (!match) {
    return { valid: false };
  }
  return {
    valid: true,
    slug: match[1],
    sequence: parseInt(match[2]!, 10),
  };
}

export function generateTestCaseId(specId: string, index: number): string {
  const parsed = parseSpecId(specId);
  const tcNum = index.toString().padStart(3, '0');
  if (parsed.valid && parsed.slug) {
    return `TC-${parsed.slug}-${tcNum}`;
  }
  if (parsed.valid && parsed.sequence !== undefined) {
    return `TC-${parsed.sequence.toString().padStart(3, '0')}-${tcNum}`;
  }
  // Fallback for non-standard specId
  const cleaned = specId.replace(/^SPEC-?/i, '');
  return `TC-${cleaned || 'GEN'}-${tcNum}`;
}

export function parseTestCaseId(tcId: string): { valid: boolean; prefix?: string; index?: number } {
  const match = tcId.match(/^TC-([A-Z0-9-]+)-(\d{3,})$/);
  if (!match) {
    return { valid: false };
  }
  return {
    valid: true,
    prefix: match[1],
    index: parseInt(match[2]!, 10),
  };
}
