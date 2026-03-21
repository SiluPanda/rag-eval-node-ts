/**
 * TF-IDF vectorization and cosine similarity utilities for heuristic evaluation.
 */

import { tokenize } from './ngrams';

/**
 * Build TF-IDF vectors for a query and a set of documents.
 * TF = count/total, IDF = log((N+1)/(df+1))+1 (sklearn-style smooth IDF).
 */
export function buildTfIdfVectors(
  query: string,
  documents: string[],
): { queryVec: Map<string, number>; docVecs: Map<string, number>[] } {
  const allTexts = [query, ...documents];
  const tokenLists = allTexts.map(t => tokenize(t));

  // Build vocabulary
  const vocab = new Set<string>();
  for (const tokens of tokenLists) {
    for (const t of tokens) vocab.add(t);
  }

  const N = allTexts.length;

  // Compute document frequencies
  const df = new Map<string, number>();
  for (const term of vocab) {
    let count = 0;
    for (const tokens of tokenLists) {
      if (tokens.includes(term)) count++;
    }
    df.set(term, count);
  }

  // Compute IDF (sklearn smooth): log((N+1)/(df+1)) + 1
  const idf = new Map<string, number>();
  for (const term of vocab) {
    const docFreq = df.get(term) ?? 0;
    idf.set(term, Math.log((N + 1) / (docFreq + 1)) + 1);
  }

  // Build TF-IDF vector for a token list
  function buildVec(tokens: string[]): Map<string, number> {
    const vec = new Map<string, number>();
    if (tokens.length === 0) return vec;

    const counts = new Map<string, number>();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    for (const [term, count] of counts) {
      const tf = count / tokens.length;
      const termIdf = idf.get(term) ?? 1;
      vec.set(term, tf * termIdf);
    }
    return vec;
  }

  const queryVec = buildVec(tokenLists[0]);
  const docVecs = tokenLists.slice(1).map(tl => buildVec(tl));

  return { queryVec, docVecs };
}

/**
 * Cosine similarity between two TF-IDF vectors.
 * Returns 0 if either vector is zero.
 */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, val] of a) {
    normA += val * val;
    const bVal = b.get(term) ?? 0;
    dot += val * bVal;
  }
  for (const [, val] of b) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convenience: compute TF-IDF cosine similarity between a query and a document.
 */
export function tfidfSimilarity(query: string, document: string): number {
  const { queryVec, docVecs } = buildTfIdfVectors(query, [document]);
  return cosineSimilarity(queryVec, docVecs[0]);
}
