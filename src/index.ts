// rag-eval-node-ts - Lightweight RAG evaluation metrics for CI/CD pipelines

// Types
export type {
  MetricId,
  EvaluationMode,
  EvalSample,
  EvalSignal,
  MetricResult,
  CostTracker,
  EvalResult,
  MetricAggregate,
  MetricRegression,
  BatchEvalResult,
  JudgeFn,
  PromptOverrides,
  MetricThresholds,
  HeuristicOptions,
  EvaluateOptions,
  BatchEvaluateOptions,
  EvaluatorConfig,
  Evaluator,
} from './types';

// Core evaluation functions
export { evaluate, evaluateBatch } from './evaluate';

// Evaluator factory
export { createEvaluator } from './evaluator';

// Metric functions
export {
  scoreFaithfulness,
  scoreAnswerRelevance,
  scoreContextPrecision,
  scoreContextRecall,
  scoreContextRelevance,
  scoreAnswerCorrectness,
  scoreHallucinationRate,
  computeMetric,
} from './metrics/index';

// Heuristic primitives
export { splitSentences, filterFactualSentences } from './heuristic/sentences';
export { tokenize, getNgrams, ngramOverlap, weightedNgramOverlap } from './heuristic/ngrams';
export { buildTfIdfVectors, cosineSimilarity, tfidfSimilarity } from './heuristic/tfidf';
export { tokenF1 } from './heuristic/token-f1';
