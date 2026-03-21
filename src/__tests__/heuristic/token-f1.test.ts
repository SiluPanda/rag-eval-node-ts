import { describe, it, expect } from 'vitest';
import { tokenF1 } from '../../heuristic/token-f1';

describe('tokenF1', () => {
  it('returns 1.0 for a perfect match', () => {
    const text = 'the cat sat on the mat';
    expect(tokenF1(text, text)).toBeCloseTo(1.0);
  });

  it('returns 0.0 for completely disjoint texts', () => {
    expect(tokenF1('alpha beta gamma', 'delta epsilon zeta')).toBe(0.0);
  });

  it('returns 0.0 when reference is empty', () => {
    expect(tokenF1('', 'hello world')).toBe(0.0);
  });

  it('returns 0.0 when hypothesis is empty', () => {
    expect(tokenF1('hello world', '')).toBe(0.0);
  });

  it('returns partial score for partial overlap', () => {
    // reference: [a, b, c], hypothesis: [a, b, d]
    // common: a, b (2 tokens)
    // precision = 2/3, recall = 2/3
    // F1 = 2*(2/3)*(2/3) / (2/3 + 2/3) = 2/3
    const score = tokenF1('a b c', 'a b d');
    expect(score).toBeCloseTo(2 / 3, 2);
  });

  it('handles duplicate tokens correctly using multiset intersection', () => {
    // reference: [a, a, b], hypothesis: [a, b, c]
    // common: a(min(2,1)=1), b(min(1,1)=1) = 2
    // precision = 2/3, recall = 2/3
    const score = tokenF1('a a b', 'a b c');
    expect(score).toBeCloseTo(2 / 3, 2);
  });

  it('returns a score between 0 and 1', () => {
    const score = tokenF1('RAG is a technique for grounded generation', 'RAG combines retrieval with generation');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
