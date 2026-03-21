/**
 * Answer relevance metric: is the answer relevant to the question?
 */

import type { EvalSample, HeuristicOptions, MetricResult, EvalSignal } from '../types';
import { tfidfSimilarity } from '../heuristic/tfidf';
import { ngramOverlap } from '../heuristic/ngrams';

const DEFAULT_THRESHOLD = 0.7;

export async function scoreAnswerRelevance(
  sample: EvalSample,
  _options?: HeuristicOptions,
): Promise<MetricResult> {
  const start = Date.now();
  const threshold = DEFAULT_THRESHOLD;
  const signals: EvalSignal[] = [];

  const tfidf = tfidfSimilarity(sample.question, sample.answer);
  const ngram = ngramOverlap(sample.question, sample.answer, 1);
  const score = (tfidf + ngram) / 2;

  if (score < 0.5) {
    signals.push({
      id: 'answer-relevance-low',
      metricId: 'answerRelevance',
      severity: 'warning',
      message: `Answer may not be relevant to the question (score=${score.toFixed(3)}).`,
    });
  }

  return {
    metricId: 'answerRelevance',
    score,
    mode: 'heuristic',
    passed: score >= threshold,
    threshold,
    explanation: `TF-IDF similarity: ${tfidf.toFixed(3)}, unigram overlap: ${ngram.toFixed(3)}, average: ${score.toFixed(3)}.`,
    signals,
    llmCalls: 0,
    durationMs: Date.now() - start,
  };
}
