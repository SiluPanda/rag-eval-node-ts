/**
 * Answer correctness metric: is the answer factually correct vs ground truth?
 * Requires groundTruth.
 */

import type { EvalSample, HeuristicOptions, MetricResult, EvalSignal } from '../types';
import { tokenF1 } from '../heuristic/token-f1';
import { ngramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.6;

export async function scoreAnswerCorrectness(
  sample: EvalSample,
  _options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const signals: EvalSignal[] = [];

  if (!sample.groundTruth) {
    return {
      metricId: 'answerCorrectness',
      score: null,
      mode: 'heuristic',
      passed: null,
      threshold,
      explanation: 'groundTruth is required for answerCorrectness but was not provided.',
      signals,
      llmCalls: 0,
      durationMs: Date.now() - start,
    };
  }

  const f1 = tokenF1(sample.groundTruth, sample.answer);
  const ngram = ngramOverlap(sample.groundTruth, sample.answer, 1);
  const score = 0.7 * f1 + 0.3 * ngram;

  if (score < 0.5) {
    signals.push({
      id: 'answer-correctness-low',
      metricId: 'answerCorrectness',
      severity: 'warning',
      message: `Answer correctness is low (score=${score.toFixed(3)}).`,
    });
  }

  return {
    metricId: 'answerCorrectness',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `Token F1: ${f1.toFixed(3)}, unigram overlap: ${ngram.toFixed(3)}, blended score (70%F1 + 30%ngram): ${score.toFixed(3)}.`,
    signals,
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
