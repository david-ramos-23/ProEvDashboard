/**
 * `Inbox.tsx` section state — single source of truth, validated on read.
 *
 * Extracted to a standalone pure-logic module (mirrors `bulkTemplates.ts`) so
 * `isSectionType` is unit-testable under the vitest `node` environment, which
 * cannot safely import `Inbox.tsx` itself (DOMPurify, CSS modules, router hooks).
 */

export const SECTIONS = ['bandeja', 'cola', 'comunicaciones'] as const;
export type SectionType = typeof SECTIONS[number];

export const isSectionType = (v: unknown): v is SectionType =>
  typeof v === 'string' && (SECTIONS as readonly string[]).includes(v);
