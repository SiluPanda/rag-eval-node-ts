/**
 * Faithfulness metric: is the answer supported by the retrieved contexts?
 */

import type { EvalSample, HeuristicOptions, MetricResult, EvalSignal } from '../types';
import { splitSentences } from '../heuristic/sentences';
import { weightedNgramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.7;
const LOW_SUPPORT_THRESHOLD = 0.3;

export async function scoreFaithfulness(
  sample: EvalSample,
  options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const ngramSizes = options?.ngramSizes ?? [1, 2];
  const ngramWeights = options?.ngramWeights ?? [0.7, 0.3];

  const sentences = splitSentences(sample.answer);
  const signals: EvalSignal[] = [];

  if (sentences.length === 0 || sample.contexts.length === 0) {
    return {
      metricId: 'faithfulness',
      score: 0,
      mode: 'heuristic',
      passed: false,
      threshold,
      explanation: 'No answer sentences or context chunks to evaluate.',
      signals,
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  const sentenceScores: number[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    let maxOverlap = 0;
    for (const ctx of sample.contexts) {
      const overlap = weightedNgramOverlap(sentence, ctx, ngramSizes, ngramWeights);
      if (overlap > maxOverlap) maxOverlap = overlap;
    }
    sentenceScores.push(maxOverlap);

    if (maxOverlap < LOW_SUPPORT_THRESHOLD) {
      signals.push({
        id: `faithfulness-low-support-${i}`,
        metricId: 'faithfulness',
        severity: 'warning',
        message: `Answer sentence has low context support (overlap=${maxOverlap.toFixed(3)}).`,
        evidence: sentence,
      });
    }
  }

  const score = sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length;

  return {
    metricId: 'faithfulness',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `Average max-context overlap across ${sentences.length} answer sentence(s): ${score.toFixed(3)}.`,
    signals,
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
