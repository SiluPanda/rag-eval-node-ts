import { describe, it, expect } from 'vitest';
import { tokenize, getNgrams, ngramOverlap, weightedNgramOverlap } from '../../heuristic/ngrams';

describe('tokenize', () => {
  it('lowercases and splits on whitespace and punctuation', () => {
    const tokens = tokenize('Hello, World! This is a test.');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('this');
    expect(tokens).toContain('is');
    expect(tokens).toContain('a');
    expect(tokens).toContain('test');
    // punctuation stripped
    expect(tokens).not.toContain(',');
    expect(tokens).not.toContain('!');
    expect(tokens).not.toContain('.');
  });

  it('filters empty tokens', () => {
    const tokens = tokenize('  hello   world  ');
    expect(tokens.every(t => t.length > 0)).toBe(true);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('getNgrams', () => {
  it('returns unigrams for n=1', () => {
    const tokens = ['a', 'b', 'c'];
    expect(getNgrams(tokens, 1)).toEqual(['a', 'b', 'c']);
  });

  it('returns bigrams for n=2', () => {
    const tokens = ['a', 'b', 'c'];
    expect(getNgrams(tokens, 2)).toEqual(['a b', 'b c']);
  });

  it('returns empty for tokens shorter than n', () => {
    expect(getNgrams(['a'], 2)).toEqual([]);
  });

  it('returns empty for empty tokens', () => {
    expect(getNgrams([], 1)).toEqual([]);
  });
});

describe('ngramOverlap', () => {
  it('returns 1.0 for identical strings', () => {
    expect(ngramOverlap('the cat sat on the mat', 'the cat sat on the mat')).toBeCloseTo(1.0);
  });

  it('returns 0.0 for completely disjoint strings', () => {
    expect(ngramOverlap('alpha beta gamma', 'delta epsilon zeta')).toBeCloseTo(0.0);
  });

  it('returns approximately 0.5 for 50% token overlap', () => {
    // "a b" vs "a c" — intersection={a}, union={a,b,c} → 1/3
    // "a b c" vs "a b d" — intersection={a,b}, union={a,b,c,d} → 2/4 = 0.5
    const overlap = ngramOverlap('a b c', 'a b d');
    expect(overlap).toBeCloseTo(0.5, 1);
  });

  it('returns 1.0 for both empty strings', () => {
    expect(ngramOverlap('', '')).toBe(1.0);
  });

  it('returns 0.0 when one string is empty', () => {
    expect(ngramOverlap('hello world', '')).toBe(0.0);
    expect(ngramOverlap('', 'hello world')).toBe(0.0);
  });

  it('supports bigram overlap', () => {
    const overlap = ngramOverlap('the quick brown fox', 'the quick red fox', 2);
    // bigrams a: {the quick, quick brown, brown fox}
    // bigrams b: {the quick, quick red, red fox}
    // intersection: {the quick} = 1, union = 5
    expect(overlap).toBeCloseTo(1 / 5, 3);
  });
});

describe('weightedNgramOverlap', () => {
  it('returns 1.0 for identical strings', () => {
    expect(weightedNgramOverlap('hello world test', 'hello world test')).toBeCloseTo(1.0);
  });

  it('returns 0.0 for completely disjoint strings', () => {
    expect(weightedNgramOverlap('alpha beta', 'gamma delta')).toBeCloseTo(0.0);
  });

  it('returns value between 0 and 1 for partial overlap', () => {
    const score = weightedNgramOverlap('the cat sat', 'the cat ran');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('uses custom ngramSizes and weights', () => {
    const score = weightedNgramOverlap('a b c', 'a b d', [1], [1.0]);
    // unigram: intersection={a,b}, union={a,b,c,d} = 2/4 = 0.5
    expect(score).toBeCloseTo(0.5, 1);
  });
});
