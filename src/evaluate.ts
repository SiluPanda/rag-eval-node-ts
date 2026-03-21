/**
 * Core evaluate() and evaluateBatch() functions.
 */

import type {
  MetricId,
  EvalSample,
  EvalResult,
  BatchEvalResult,
  MetricResult,
  MetricAggregate,
  MetricRegression,
  CostTracker,
  EvaluateOptions,
  BatchEvaluateOptions,
} from './types';
import { computeMetric } from './metrics/index';

const ALL_METRICS: MetricId[] = [
  'faithfulness',
  'answerRelevance',
  'contextPrecision',
  'contextRecall',
  'contextRelevance',
  'answerCorrectness',
  'hallucinationRate',
];

const DEFAULT_COMPOSITE_THRESHOLD = 0.6;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_REGRESSION_THRESHOLD = 0.05;

/**
 * Evaluate a single EvalSample against the requested metrics.
 * Only heuristic mode is implemented; LLM/hybrid options are accepted but ignored.
 */
export async function evaluate(
  sample: EvalSample,
  metrics?: MetricId[],
  options?: EvaluateOptions,
): Promise<EvalResult> {
  const start = Date.now();
  const activeMetrics = metrics ?? ALL_METRICS;
  const heuristicOptions = options?.heuristic;
  const thresholds = options?.thresholds ?? {};
  const compositeThreshold = options?.compositeThreshold ?? DEFAULT_COMPOSITE_THRESHOLD;
  const compositeWeights = options?.compositeWeights ?? {};

  const metricResults: Partial<Record<MetricId, MetricResult>> = {};

  for (const metricId of activeMetrics) {
    const result = await computeMetric(metricId, sample, heuristicOptions);
    // Apply per-metric threshold overrides
    const overrideThreshold = thresholds[metricId];
    if (overrideThreshold !== undefined) {
      const adjustedPassed = result.score !== null ? result.score >= overrideThreshold : null;
      metricResults[metricId] = {
        ...result,
        threshold: overrideThreshold,
        passed: adjustedPassed,
      };
    } else {
      metricResults[metricId] = result;
    }
  }

  // Compute composite score: weighted average of non-null scores
  let weightedSum = 0;
  let totalWeight = 0;
  let allPassed = true;

  for (const metricId of activeMetrics) {
    const r = metricResults[metricId];
    if (!r) continue;
    if (r.score !== null) {
      const w = compositeWeights[metricId] ?? 1;
      weightedSum += r.score * w;
      totalWeight += w;
    }
    if (r.passed === false) allPassed = false;
  }

  const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : null;
  const compositePassed = compositeScore !== null ? compositeScore >= compositeThreshold : false;
  const passed = allPassed && compositePassed;

  const cost: CostTracker = {
    llmCalls: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    parseFailures: 0,
  };

  return {
    sample,
    metrics: metricResults as Record<MetricId, MetricResult>,
    compositeScore,
    passed,
    cost,
    durationMs: Date.now() - start,
    evaluatedAt: new Date().toISOString(),
  };
}

function computeAggregate(metricId: MetricId, results: EvalResult[], _threshold: number): MetricAggregate {
  const scores: number[] = [];
  let nullCount = 0;
  let passCount = 0;

  for (const r of results) {
    const mr = r.metrics[metricId];
    if (!mr) continue;
    if (mr.score === null) {
      nullCount++;
    } else {
      scores.push(mr.score);
    }
    if (mr.passed === true) passCount++;
  }

  const total = results.length;
  const nullRate = total > 0 ? nullCount / total : 0;
  const passRate = total > 0 ? passCount / total : 0;

  if (scores.length === 0) {
    return { metricId, mean: 0, median: 0, min: 0, max: 0, stdDev: 0, passRate, nullRate };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  return { metricId, mean, median, min, max, stdDev, passRate, nullRate };
}

function computeCompositeAggregate(results: EvalResult[]) {
  const scores = results.map(r => r.compositeScore).filter((s): s is number => s !== null);

  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0, passRate: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const passRate = results.filter(r => r.passed).length / results.length;

  return { mean, median, min, max, stdDev, passRate };
}

/**
 * Evaluate a batch of EvalSamples with concurrency control.
 */
export async function evaluateBatch(
  samples: EvalSample[],
  metrics?: MetricId[],
  options?: BatchEvaluateOptions,
): Promise<BatchEvalResult> {
  const start = Date.now();
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const regressionThreshold = options?.regressionThreshold ?? DEFAULT_REGRESSION_THRESHOLD;
  const onProgress = options?.onProgress;

  const results: EvalResult[] = new Array(samples.length);
  let completed = 0;

  // Process with limited concurrency
  async function processChunk(startIdx: number): Promise<void> {
    for (let i = startIdx; i < samples.length; i += concurrency) {
      results[i] = await evaluate(samples[i], metrics, options);
      completed++;
      onProgress?.(completed, samples.length);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, samples.length); i++) {
    workers.push(processChunk(i));
  }
  await Promise.all(workers);

  const activeMetrics = metrics ?? ALL_METRICS;

  // Build aggregates
  const thresholds = options?.thresholds ?? {};
  const aggregates: Partial<Record<MetricId, MetricAggregate>> = {};
  for (const metricId of activeMetrics) {
    const defaultThreshold = results[0]?.metrics[metricId]?.threshold ?? 0.7;
    const threshold = thresholds[metricId] ?? defaultThreshold;
    aggregates[metricId] = computeAggregate(metricId, results, threshold);
  }

  const compositeAggregate = computeCompositeAggregate(results);

  // Compute total cost
  const totalCost: CostTracker = {
    llmCalls: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    parseFailures: 0,
  };

  // Regression detection
  let regressions: MetricRegression[] | undefined;
  if (options?.baselineResult) {
    regressions = [];
    const baseline = options.baselineResult;
    for (const metricId of activeMetrics) {
      const baselineAgg = baseline.aggregates[metricId];
      const currentAgg = aggregates[metricId];
      if (!baselineAgg || !currentAgg) continue;
      const delta = currentAgg.mean - baselineAgg.mean;
      const regressed = delta < -regressionThreshold;
      regressions.push({
        metricId,
        baselineMean: baselineAgg.mean,
        currentMean: currentAgg.mean,
        delta,
        regressed,
      });
    }
  }

  const passed = results.every(r => r.passed) && compositeAggregate.passRate >= 0.5;

  return {
    results,
    aggregates: aggregates as Record<MetricId, MetricAggregate>,
    compositeAggregate,
    passed,
    totalCost,
    totalDurationMs: Date.now() - start,
    regressions,
    evaluatedAt: new Date().toISOString(),
  };
}
