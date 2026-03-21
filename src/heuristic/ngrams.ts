/**
 * N-gram utilities for heuristic evaluation.
 */

/**
 * Lowercase, split on whitespace and punctuation, filter empty tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(t => t.length > 0);
}

/**
 * Returns all n-grams from a token list as joined strings ("word1 word2").
 */
export function getNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(' '));
  }
  return result;
}

/**
 * Jaccard-style n-gram overlap: |intersection| / |union| using set semantics.
 * Default n=1 (unigram).
 */
export function ngramOverlap(a: string, b: string, n = 1): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const ngramsA = new Set(getNgrams(tokensA, n));
  const ngramsB = new Set(getNgrams(tokensB, n));

  if (ngramsA.size === 0 && ngramsB.size === 0) return 1.0;
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const ng of ngramsA) {
    if (ngramsB.has(ng)) intersectionCount++;
  }

  const unionCount = ngramsA.size + ngramsB.size - intersectionCount;
  return intersectionCount / unionCount;
}

/**
 * Weighted average of ngramOverlap for multiple n-gram sizes.
 * Default: n=[1,2], weights=[0.7, 0.3].
 */
export function weightedNgramOverlap(
  a: string,
  b: string,
  ngramSizes: number[] = [1, 2],
  weights: number[] = [0.7, 0.3],
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < ngramSizes.length; i++) {
    const n = ngramSizes[i];
    const w = weights[i] ?? 1;
    const overlap = ngramOverlap(a, b, n);
    weightedSum += overlap * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}
