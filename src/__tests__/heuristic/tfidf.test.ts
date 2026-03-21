import { describe, it, expect } from 'vitest';
import { tfidfSimilarity, cosineSimilarity, buildTfIdfVectors } from '../../heuristic/tfidf';

describe('tfidfSimilarity', () => {
  it('returns a high score for identical texts', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const score = tfidfSimilarity(text, text);
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns a low score for unrelated texts', () => {
    const score = tfidfSimilarity(
      'quantum physics relativity wave particle',
      'cooking recipes pasta sauce garlic',
    );
    expect(score).toBeLessThan(0.2);
  });

  it('returns a value in [0,1]', () => {
    const score = tfidfSimilarity('hello world', 'world peace');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 0 for empty query', () => {
    const score = tfidfSimilarity('', 'some document text');
    expect(score).toBe(0);
  });

  it('returns higher similarity for related texts than unrelated', () => {
    const query = 'retrieval augmented generation RAG pipeline';
    const related = 'RAG combines retrieval with generation for grounded answers';
    const unrelated = 'the weather is sunny today';
    expect(tfidfSimilarity(query, related)).toBeGreaterThan(tfidfSimilarity(query, unrelated));
  });
});

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const vec = new Map([['a', 0.5], ['b', 0.3]]);
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = new Map([['x', 1.0]]);
    const b = new Map([['y', 1.0]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0.0 for empty vectors', () => {
    expect(cosineSimilarity(new Map(), new Map())).toBe(0);
  });
});

describe('buildTfIdfVectors', () => {
  it('builds query and document vectors with correct structure', () => {
    const { queryVec, docVecs } = buildTfIdfVectors('hello world', ['hello there', 'another doc']);
    expect(queryVec instanceof Map).toBe(true);
    expect(docVecs).toHaveLength(2);
    expect(docVecs[0] instanceof Map).toBe(true);
  });

  it('assigns non-zero weight to terms in query', () => {
    const { queryVec } = buildTfIdfVectors('hello world', ['unrelated content']);
    expect(queryVec.size).toBeGreaterThan(0);
  });
});
