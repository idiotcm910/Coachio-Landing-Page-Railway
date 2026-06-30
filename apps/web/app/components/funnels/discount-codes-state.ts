/**
 * Pure helpers for the funnel checkout discount-codes list state.
 * Extracted to be testable without DOM / React.
 */

/** Add a code (trimmed, uppercased, deduped) to the list. Returns new list. */
export function addDiscountCode(codes: string[], raw: string): string[] {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return codes;
  if (codes.includes(normalized)) return codes;
  return [...codes, normalized];
}

/** Remove a code by exact match. Returns new list. */
export function removeDiscountCode(codes: string[], code: string): string[] {
  return codes.filter((c) => c !== code);
}

/** Derive the args for quoteFunnelOrder from current state. */
export function quoteArgs(slug: string, codes: string[]): { slug: string; codes: string[] } {
  return { slug, codes };
}
