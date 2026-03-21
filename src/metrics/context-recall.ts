/**
 * Context recall metric: do contexts cover the ground truth?
 * Requires groundTruth.
 */

import type { EvalSample, HeuristicOptions, MetricResult } from '../types';
import { splitSentences } from '../heuristic/sentences';
import { ngramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.7;
const COVERAGE_THRESHOLD = 0.3;

export async function scoreContextRecall(
  sample: EvalSample,
  _options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;

  if (!sample.groundTruth) {
    return {
      metricId: 'contextRecall',
      score: null,
      mode: 'heuristic',
      passed: null,
      threshold,
      explanation: 'groundTruth is required for contextRecall but was not provided.',
      signals: [],
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  const gtSentences = splitSentences(sample.groundTruth);

  if (gtSentences.length === 0 || sample.contexts.length === 0) {
    return {
      metricId: 'contextRecall',
      score: 0,
      mode: 'heuristic',
      passed: false,
      threshold,
      explanation: 'No ground truth sentences or context chunks to evaluate.',
      signals: [],
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  let coveredCount = 0;
  for (const sentence of gtSentences) {
    let maxOverlap = 0;
    for (const ctx of sample.contexts) {
      const overlap = ngramOverlap(sentence, ctx, 1);
      if (overlap > maxOverlap) maxOverlap = overlap;
    }
    if (maxOverlap >= COVERAGE_THRESHOLD) coveredCount++;
  }

  const score = coveredCount / gtSentences.length;

  return {
    metricId: 'contextRecall',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `${coveredCount}/${gtSentences.length} ground truth sentence(s) covered by contexts (overlap >= ${COVERAGE_THRESHOLD}): score=${score.toFixed(3)}.`,
    signals: [],
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
