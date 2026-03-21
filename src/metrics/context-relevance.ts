/**
 * Context relevance metric: are context chunks relevant to the question (stricter than precision)?
 */

import type { EvalSample, HeuristicOptions, MetricResult } from '../types';
import { weightedNgramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_CHUNK_RELEVANCE_THRESHOLD = 0.2;

export async function scoreContextRelevance(
  sample: EvalSample,
  options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const chunkRelevanceThreshold = options?.chunkRelevanceThreshold ?? DEFAULT_CHUNK_RELEVANCE_THRESHOLD;
  const ngramSizes = options?.ngramSizes ?? [1, 2];
  const ngramWeights = options?.ngramWeights ?? [0.7, 0.3];

  if (sample.contexts.length === 0) {
    return {
      metricId: 'contextRelevance',
      score: 0,
      mode: 'heuristic',
      passed: false,
      threshold,
      explanation: 'No context chunks provided.',
      signals: [],
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  let relevantCount = 0;
  for (const ctx of sample.contexts) {
    const overlap = weightedNgramOverlap(sample.question, ctx, ngramSizes, ngramWeights);
    if (overlap >= chunkRelevanceThreshold) relevantCount++;
  }

  const score = relevantCount / sample.contexts.length;

  return {
    metricId: 'contextRelevance',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `${relevantCount}/${sample.contexts.length} context chunk(s) meet relevance threshold (>= ${chunkRelevanceThreshold}): score=${score.toFixed(3)}.`,
    signals: [],
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
