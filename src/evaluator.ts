/**
 * createEvaluator() factory: returns a pre-configured Evaluator instance.
 */

import type {
  EvaluatorConfig,
  Evaluator,
  EvalSample,
  EvalResult,
  BatchEvalResult,
  MetricId,
  EvaluateOptions,
  BatchEvaluateOptions,
} from './types';
import { evaluate, evaluateBatch } from './evaluate';

/**
 * Create a pre-configured Evaluator bound to the given config.
 * Per-call options are merged with config, with per-call options taking precedence.
 */
export function createEvaluator(config: EvaluatorConfig): Evaluator {
  const defaultMetrics = config.metrics;

  function mergeOptions<T extends EvaluateOptions>(perCallOptions?: T): T {
    if (!perCallOptions) return config as unknown as T;
    return {
      ...config,
      ...perCallOptions,
      thresholds: { ...config.thresholds, ...perCallOptions.thresholds },
      compositeWeights: { ...config.compositeWeights, ...perCallOptions.compositeWeights },
      heuristic: { ...config.heuristic, ...perCallOptions.heuristic },
    };
  }

  return {
    config,

    async evaluate(
      sample: EvalSample,
      metrics?: MetricId[],
      options?: EvaluateOptions,
    ): Promise<EvalResult> {
      const activeMetrics = metrics ?? defaultMetrics;
      const merged = mergeOptions(options);
      return evaluate(sample, activeMetrics, merged);
    },

    async evaluateBatch(
      samples: EvalSample[],
      metrics?: MetricId[],
      options?: BatchEvaluateOptions,
    ): Promise<BatchEvalResult> {
      const activeMetrics = metrics ?? defaultMetrics;
      const merged = mergeOptions(options);
      return evaluateBatch(samples, activeMetrics, merged);
    },
  };
}
