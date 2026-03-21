/**
 * Metric dispatcher: route MetricId to the correct scoring function.
 */

import type { MetricId, EvalSample, HeuristicOptions, MetricResult } from '../types';
import { scoreFaithfulness } from './faithfulness';
import { scoreAnswerRelevance } from './answer-relevance';
import { scoreContextPrecision } from './context-precision';
import { scoreContextRecall } from './context-recall';
import { scoreContextRelevance } from './context-relevance';
import { scoreAnswerCorrectness } from './answer-correctness';
import { scoreHallucinationRate } from './hallucination-rate';

export {
  scoreFaithfulness,
  scoreAnswerRelevance,
  scoreContextPrecision,
  scoreContextRecall,
  scoreContextRelevance,
  scoreAnswerCorrectness,
  scoreHallucinationRate,
};

export async function computeMetric(
  metricId: MetricId,
  sample: EvalSample,
  options?: HeuristicOptions,
): Promise<MetricResult> {
  switch (metricId) {
    case 'faithfulness':
      return scoreFaithfulness(sample, options);
    case 'answerRelevance':
      return scoreAnswerRelevance(sample, options);
    case 'contextPrecision':
      return scoreContextPrecision(sample, options);
    case 'contextRecall':
      return scoreContextRecall(sample, options);
    case 'contextRelevance':
      return scoreContextRelevance(sample, options);
    case 'answerCorrectness':
      return scoreAnswerCorrectness(sample, options);
    case 'hallucinationRate':
      return scoreHallucinationRate(sample, options);
  }
}
