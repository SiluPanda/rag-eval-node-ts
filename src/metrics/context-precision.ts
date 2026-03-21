/**
 * Context precision metric: are the retrieved contexts relevant to answering the question?
 */

import type { EvalSample, HeuristicOptions, MetricResult, EvalSignal } from '../types';
import { tfidfSimilarity } from '../heuristic/tfidf';

const DEFAULT_THRESHOLD = 0.7;
const LOW_RELEVANCE_THRESHOLD = 0.3;

export async function scoreContextPrecision(
  sample: EvalSample,
  _options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const signals: EvalSignal[] = [];

  if (sample.contexts.length === 0) {
    return {
      metricId: 'contextPrecision',
      score: 0,
      mode: 'heuristic',
      passed: false,
      threshold,
      explanation: 'No context chunks provided.',
      signals,
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  const relevances: number[] = [];
  const lowChunks: number[] = [];

  for (let i = 0; i < sample.contexts.length; i++) {
    const relevance = tfidfSimilarity(sample.question, sample.contexts[i]);
    relevances.push(relevance);
    if (relevance < LOW_RELEVANCE_THRESHOLD) {
      lowChunks.push(i);
    }
  }

  if (lowChunks.length > 0) {
    signals.push({
      id: 'context-precision-low-relevance-chunks',
      metricId: 'contextPrecision',
      severity: 'info',
      message: `Context chunk(s) with low relevance (< ${LOW_RELEVANCE_THRESHOLD}): indices [${lowChunks.join(', ')}].`,
    });
  }

  const score = relevances.reduce((a, b) => a + b, 0) / relevances.length;

  return {
    metricId: 'contextPrecision',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `Average TF-IDF relevance of ${sample.contexts.length} context chunk(s) to the question: ${score.toFixed(3)}.`,
    signals,
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
