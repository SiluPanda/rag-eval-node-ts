/**
 * Hallucination rate metric: does the answer contain claims not supported by any context?
 * Score = 1 - hallucination_rate (higher is better).
 */

import type { EvalSample, HeuristicOptions, MetricResult, EvalSignal } from '../types';
import { splitSentences } from '../heuristic/sentences';
import { ngramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_CLAIM_SUPPORT_THRESHOLD = 0.15;

export async function scoreHallucinationRate(
  sample: EvalSample,
  options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const claimSupportThreshold = options?.claimSupportThreshold ?? DEFAULT_CLAIM_SUPPORT_THRESHOLD;
  const signals: EvalSignal[] = [];

  const sentences = splitSentences(sample.answer);

  if (sentences.length === 0 || sample.contexts.length === 0) {
    return {
      metricId: 'hallucinationRate',
      score: sample.contexts.length === 0 ? 0 : 1,
      mode: 'heuristic',
      passed: sample.contexts.length === 0 ? false : true,
      threshold,
      explanation: 'No answer sentences or context chunks to evaluate.',
      signals,
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  let unsupportedCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    let maxOverlap = 0;
    for (const ctx of sample.contexts) {
      const overlap = ngramOverlap(sentence, ctx, 1);
      if (overlap > maxOverlap) maxOverlap = overlap;
    }

    if (maxOverlap < claimSupportThreshold) {
      unsupportedCount++;
      signals.push({
        id: `hallucination-unsupported-${i}`,
        metricId: 'hallucinationRate',
        severity: 'critical',
        message: `Answer sentence appears unsupported by any context (max overlap=${maxOverlap.toFixed(3)}).`,
        evidence: sentence,
      });
    }
  }

  const hallucinationRate = unsupportedCount / sentences.length;
  const score = 1 - hallucinationRate;

  return {
    metricId: 'hallucinationRate',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `${unsupportedCount}/${sentences.length} answer sentence(s) appear unsupported (hallucination rate=${hallucinationRate.toFixed(3)}, score=${score.toFixed(3)}).`,
    signals,
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
