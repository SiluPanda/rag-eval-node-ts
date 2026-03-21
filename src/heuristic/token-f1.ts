/**
 * Token-level F1 score for answer correctness evaluation.
 */

import { tokenize } from './ngrams';

/**
 * Compute token-level F1 using multiset intersection (counting duplicates).
 * precision = |common| / |hypothesis tokens|
 * recall    = |common| / |reference tokens|
 * F1 = 2 * precision * recall / (precision + recall)
 * Returns 0 if either input is empty.
 */
export function tokenF1(reference: string, hypothesis: string): number {
  const refTokens = tokenize(reference);
  const hypTokens = tokenize(hypothesis);

  if (refTokens.length === 0 || hypTokens.length === 0) return 0;

  // Build frequency maps
  const refCounts = new Map<string, number>();
  for (const t of refTokens) {
    refCounts.set(t, (refCounts.get(t) ?? 0) + 1);
  }

  const hypCounts = new Map<string, number>();
  for (const t of hypTokens) {
    hypCounts.set(t, (hypCounts.get(t) ?? 0) + 1);
  }

  // Multiset intersection count
  let commonCount = 0;
  for (const [term, refCount] of refCounts) {
    const hypCount = hypCounts.get(term) ?? 0;
    commonCount += Math.min(refCount, hypCount);
  }

  if (commonCount === 0) return 0;

  const precision = commonCount / hypTokens.length;
  const recall = commonCount / refTokens.length;

  return (2 * precision * recall) / (precision + recall);
}
