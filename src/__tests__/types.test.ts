import { describe, it, expect } from 'vitest';
import type {
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
} from '../types';

// ---------------------------------------------------------------------------
// Helper: a compile-time type assertion that T is assignable to Expected.
// At runtime this is just an identity function — the real value is that
// TypeScript will reject the test file if the shape is wrong.
// ---------------------------------------------------------------------------
function assertType<Expected>(_val: Expected): void { /* no-op */ }

// ---------------------------------------------------------------------------
// MetricId union — all 7 values
// ---------------------------------------------------------------------------
describe('MetricId', () => {
  it('contains all seven metric identifiers', () => {
    const ids: MetricId[] = [
      'faithfulness',
      'answerRelevance',
      'contextPrecision',
      'contextRecall',
      'contextRelevance',
      'answerCorrectness',
      'hallucinationRate',
    ];
    expect(ids).toHaveLength(7);
    expect(ids).toContain('faithfulness');
    expect(ids).toContain('answerRelevance');
    expect(ids).toContain('contextPrecision');
    expect(ids).toContain('contextRecall');
    expect(ids).toContain('contextRelevance');
    expect(ids).toContain('answerCorrectness');
    expect(ids).toContain('hallucinationRate');
  });
});

// ---------------------------------------------------------------------------
// EvaluationMode union — 3 values
// ---------------------------------------------------------------------------
describe('EvaluationMode', () => {
  it('contains heuristic, llm, and hybrid', () => {
    const modes: EvaluationMode[] = ['heuristic', 'llm', 'hybrid'];
    expect(modes).toHaveLength(3);
    expect(modes).toContain('heuristic');
    expect(modes).toContain('llm');
    expect(modes).toContain('hybrid');
  });
});

// ---------------------------------------------------------------------------
// EvalSample
// ---------------------------------------------------------------------------
describe('EvalSample', () => {
  it('requires question, answer, contexts and accepts optional fields', () => {
    const minimal: EvalSample = {
      question: 'What is RAG?',
      answer: 'RAG stands for Retrieval-Augmented Generation.',
      contexts: ['Context about RAG'],
    };
    assertType<EvalSample>(minimal);
    expect(minimal.question).toBe('What is RAG?');
    expect(minimal.answer).toBeDefined();
    expect(Array.isArray(minimal.contexts)).toBe(true);
    expect(minimal.groundTruth).toBeUndefined();
    expect(minimal.id).toBeUndefined();
    expect(minimal.metadata).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const full: EvalSample = {
      question: 'What is RAG?',
      answer: 'RAG stands for Retrieval-Augmented Generation.',
      contexts: ['Context about RAG'],
      groundTruth: 'RAG is a technique that combines retrieval with generation.',
      id: 'sample-001',
      metadata: { source: 'test', priority: 1 },
    };
    assertType<EvalSample>(full);
    expect(full.groundTruth).toBeDefined();
    expect(full.id).toBe('sample-001');
    expect(full.metadata).toEqual({ source: 'test', priority: 1 });
  });
});

// ---------------------------------------------------------------------------
// EvalSignal
// ---------------------------------------------------------------------------
describe('EvalSignal', () => {
  it('has required id, metricId, severity, message fields', () => {
    const signal: EvalSignal = {
      id: 'unsupported-claim-1',
      metricId: 'faithfulness',
      severity: 'critical',
      message: 'Claim not supported by any context chunk.',
    };
    assertType<EvalSignal>(signal);
    expect(signal.id).toBe('unsupported-claim-1');
    expect(signal.metricId).toBe('faithfulness');
    expect(signal.severity).toBe('critical');
    expect(signal.message).toBeDefined();
    expect(signal.evidence).toBeUndefined();
    expect(signal.contextChunkIndex).toBeUndefined();
  });

  it('accepts optional evidence and contextChunkIndex', () => {
    const signal: EvalSignal = {
      id: 'irrelevant-chunk',
      metricId: 'contextPrecision',
      severity: 'warning',
      message: 'Context chunk appears irrelevant.',
      evidence: 'The cat sat on the mat.',
      contextChunkIndex: 2,
    };
    assertType<EvalSignal>(signal);
    expect(signal.evidence).toBe('The cat sat on the mat.');
    expect(signal.contextChunkIndex).toBe(2);
  });

  it('severity is constrained to info | warning | critical', () => {
    const severities: Array<EvalSignal['severity']> = ['info', 'warning', 'critical'];
    expect(severities).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// MetricResult
// ---------------------------------------------------------------------------
describe('MetricResult', () => {
  it('has score as number | null and passed as boolean | null', () => {
    const result: MetricResult = {
      metricId: 'faithfulness',
      score: 0.85,
      mode: 'heuristic',
      passed: true,
      threshold: 0.7,
      explanation: 'All claims were found in the context.',
      signals: [],
      llmCalls: 0,
      durationMs: 12,
    };
    assertType<MetricResult>(result);
    expect(result.score).toBe(0.85);
    expect(result.passed).toBe(true);
  });

  it('allows null score and null passed', () => {
    const result: MetricResult = {
      metricId: 'contextRecall',
      score: null,
      mode: 'llm',
      passed: null,
      threshold: 0.7,
      explanation: 'groundTruth was not provided.',
      signals: [],
      llmCalls: 0,
      durationMs: 1,
    };
    assertType<MetricResult>(result);
    expect(result.score).toBeNull();
    expect(result.passed).toBeNull();
  });

  it('mode is constrained to heuristic | llm (not hybrid)', () => {
    const modes: Array<MetricResult['mode']> = ['heuristic', 'llm'];
    expect(modes).toHaveLength(2);
  });

  it('has all required numeric fields', () => {
    const result: MetricResult = {
      metricId: 'answerRelevance',
      score: 0.72,
      mode: 'llm',
      passed: true,
      threshold: 0.7,
      explanation: 'Answer is relevant to the question.',
      signals: [],
      llmCalls: 3,
      durationMs: 450,
    };
    expect(typeof result.threshold).toBe('number');
    expect(typeof result.llmCalls).toBe('number');
    expect(typeof result.durationMs).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// CostTracker — 4 numeric fields
// ---------------------------------------------------------------------------
describe('CostTracker', () => {
  it('has exactly 4 numeric fields', () => {
    const cost: CostTracker = {
      llmCalls: 5,
      estimatedInputTokens: 1200,
      estimatedOutputTokens: 300,
      parseFailures: 0,
    };
    assertType<CostTracker>(cost);
    expect(typeof cost.llmCalls).toBe('number');
    expect(typeof cost.estimatedInputTokens).toBe('number');
    expect(typeof cost.estimatedOutputTokens).toBe('number');
    expect(typeof cost.parseFailures).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// EvalResult
// ---------------------------------------------------------------------------
describe('EvalResult', () => {
  it('has sample, metrics (Record), compositeScore, passed, cost, durationMs, evaluatedAt', () => {
    const mockMetrics: Record<MetricId, MetricResult> = {
      faithfulness: {
        metricId: 'faithfulness', score: 0.9, mode: 'heuristic', passed: true,
        threshold: 0.7, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 10,
      },
      answerRelevance: {
        metricId: 'answerRelevance', score: 0.8, mode: 'heuristic', passed: true,
        threshold: 0.7, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 8,
      },
      contextPrecision: {
        metricId: 'contextPrecision', score: 0.75, mode: 'heuristic', passed: true,
        threshold: 0.7, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 5,
      },
      contextRecall: {
        metricId: 'contextRecall', score: 0.7, mode: 'heuristic', passed: true,
        threshold: 0.7, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 5,
      },
      contextRelevance: {
        metricId: 'contextRelevance', score: 0.65, mode: 'heuristic', passed: true,
        threshold: 0.6, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 4,
      },
      answerCorrectness: {
        metricId: 'answerCorrectness', score: 0.6, mode: 'heuristic', passed: true,
        threshold: 0.6, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 4,
      },
      hallucinationRate: {
        metricId: 'hallucinationRate', score: 0.85, mode: 'heuristic', passed: true,
        threshold: 0.7, explanation: 'ok', signals: [], llmCalls: 0, durationMs: 3,
      },
    };

    const result: EvalResult = {
      sample: { question: 'Q?', answer: 'A.', contexts: ['C'] },
      metrics: mockMetrics,
      compositeScore: 0.75,
      passed: true,
      cost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      durationMs: 39,
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };
    assertType<EvalResult>(result);
    expect(result.compositeScore).toBe(0.75);
    expect(result.passed).toBe(true);
    expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('compositeScore can be null', () => {
    const result: EvalResult = {
      sample: { question: 'Q?', answer: 'A.', contexts: [] },
      metrics: {} as Record<MetricId, MetricResult>,
      compositeScore: null,
      passed: false,
      cost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      durationMs: 1,
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };
    assertType<EvalResult>(result);
    expect(result.compositeScore).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MetricAggregate
// ---------------------------------------------------------------------------
describe('MetricAggregate', () => {
  it('has all required fields including median, stdDev, and nullRate', () => {
    const agg: MetricAggregate = {
      metricId: 'faithfulness',
      mean: 0.82,
      median: 0.85,
      min: 0.41,
      max: 1.0,
      stdDev: 0.12,
      passRate: 0.905,
      nullRate: 0.0,
    };
    assertType<MetricAggregate>(agg);
    expect(typeof agg.mean).toBe('number');
    expect(typeof agg.median).toBe('number');
    expect(typeof agg.min).toBe('number');
    expect(typeof agg.max).toBe('number');
    expect(typeof agg.stdDev).toBe('number');
    expect(typeof agg.passRate).toBe('number');
    expect(typeof agg.nullRate).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// MetricRegression — SPEC field names
// ---------------------------------------------------------------------------
describe('MetricRegression', () => {
  it('has metricId, baselineMean, currentMean, delta, regressed fields', () => {
    const regression: MetricRegression = {
      metricId: 'faithfulness',
      baselineMean: 0.85,
      currentMean: 0.78,
      delta: -0.07,
      regressed: true,
    };
    assertType<MetricRegression>(regression);
    expect(regression.baselineMean).toBe(0.85);
    expect(regression.currentMean).toBe(0.78);
    expect(regression.delta).toBe(-0.07);
    expect(regression.regressed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BatchEvalResult
// ---------------------------------------------------------------------------
describe('BatchEvalResult', () => {
  it('requires results, aggregates, compositeAggregate, passed, totalCost, totalDurationMs, evaluatedAt', () => {
    const batch: BatchEvalResult = {
      results: [],
      aggregates: {} as Record<MetricId, MetricAggregate>,
      compositeAggregate: {
        mean: 0.74,
        median: 0.76,
        min: 0.42,
        max: 0.97,
        stdDev: 0.1,
        passRate: 0.762,
      },
      passed: true,
      totalCost: { llmCalls: 189, estimatedInputTokens: 47250, estimatedOutputTokens: 12000, parseFailures: 0 },
      totalDurationMs: 34200,
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };
    assertType<BatchEvalResult>(batch);
    expect(Array.isArray(batch.results)).toBe(true);
    expect(batch.passed).toBe(true);
    expect(batch.regressions).toBeUndefined();
  });

  it('accepts optional regressions array', () => {
    const batch: BatchEvalResult = {
      results: [],
      aggregates: {} as Record<MetricId, MetricAggregate>,
      compositeAggregate: { mean: 0.7, median: 0.7, min: 0.5, max: 0.9, stdDev: 0.1, passRate: 0.8 },
      passed: false,
      totalCost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      totalDurationMs: 100,
      regressions: [
        { metricId: 'faithfulness', baselineMean: 0.85, currentMean: 0.78, delta: -0.07, regressed: true },
      ],
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };
    assertType<BatchEvalResult>(batch);
    expect(batch.regressions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// MetricThresholds — all optional, per-metric keys matching MetricId
// ---------------------------------------------------------------------------
describe('MetricThresholds', () => {
  it('is fully optional', () => {
    const empty: MetricThresholds = {};
    assertType<MetricThresholds>(empty);
    expect(empty).toEqual({});
  });

  it('accepts all per-metric keys', () => {
    const full: MetricThresholds = {
      faithfulness: 0.8,
      answerRelevance: 0.7,
      contextPrecision: 0.7,
      contextRecall: 0.7,
      contextRelevance: 0.6,
      answerCorrectness: 0.6,
      hallucinationRate: 0.7,
    };
    assertType<MetricThresholds>(full);
    expect(full.faithfulness).toBe(0.8);
    expect(full.answerCorrectness).toBe(0.6);
    expect(full.hallucinationRate).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// HeuristicOptions — all optional
// ---------------------------------------------------------------------------
describe('HeuristicOptions', () => {
  it('is fully optional', () => {
    const empty: HeuristicOptions = {};
    assertType<HeuristicOptions>(empty);
    expect(empty).toEqual({});
  });

  it('accepts all optional fields', () => {
    const opts: HeuristicOptions = {
      claimSupportThreshold: 0.5,
      chunkRelevanceThreshold: 0.4,
      sentenceCoverageThreshold: 0.6,
      ngramWeight: 0.6,
      tfidfWeight: 0.4,
      ngramSizes: [1, 2, 3],
      ngramWeights: [0.5, 0.3, 0.2],
    };
    assertType<HeuristicOptions>(opts);
    expect(opts.ngramSizes).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// EvaluateOptions
// ---------------------------------------------------------------------------
describe('EvaluateOptions', () => {
  it('is fully optional', () => {
    const opts: EvaluateOptions = {};
    assertType<EvaluateOptions>(opts);
    expect(opts).toEqual({});
  });

  it('accepts mode, judge, thresholds, metricModes, compositeThreshold, compositeWeights, heuristic, promptOverrides', () => {
    const judge: JudgeFn = async (_prompt) => '{"supported": true}';
    const opts: EvaluateOptions = {
      mode: 'hybrid',
      judge,
      thresholds: { faithfulness: 0.8 },
      metricModes: { contextPrecision: 'llm', answerCorrectness: 'heuristic' },
      compositeThreshold: 0.7,
      compositeWeights: { faithfulness: 2.0, answerRelevance: 1.5 },
      heuristic: { ngramSizes: [1, 2] },
      promptOverrides: { faithfulness: 'Custom prompt for faithfulness' },
    };
    assertType<EvaluateOptions>(opts);
    expect(opts.mode).toBe('hybrid');
    expect(opts.compositeThreshold).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// BatchEvaluateOptions extends EvaluateOptions
// ---------------------------------------------------------------------------
describe('BatchEvaluateOptions', () => {
  it('extends EvaluateOptions with concurrency, onProgress, baselineResult, regressionThreshold', () => {
    const mockBaseline: BatchEvalResult = {
      results: [],
      aggregates: {} as Record<MetricId, MetricAggregate>,
      compositeAggregate: { mean: 0.8, median: 0.82, min: 0.5, max: 1.0, stdDev: 0.1, passRate: 0.9 },
      passed: true,
      totalCost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      totalDurationMs: 5000,
      evaluatedAt: '2026-01-01T00:00:00.000Z',
    };

    const opts: BatchEvaluateOptions = {
      mode: 'heuristic',
      concurrency: 8,
      onProgress: (completed, total) => { void completed; void total; },
      baselineResult: mockBaseline,
      regressionThreshold: 0.05,
    };
    assertType<BatchEvaluateOptions>(opts);
    expect(opts.concurrency).toBe(8);
    expect(opts.regressionThreshold).toBe(0.05);
    expect(typeof opts.onProgress).toBe('function');
  });

  it('is fully optional', () => {
    const opts: BatchEvaluateOptions = {};
    assertType<BatchEvaluateOptions>(opts);
    expect(opts).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// EvaluatorConfig extends EvaluateOptions with optional metrics
// ---------------------------------------------------------------------------
describe('EvaluatorConfig', () => {
  it('extends EvaluateOptions and adds optional metrics array', () => {
    const config: EvaluatorConfig = {
      mode: 'hybrid',
      thresholds: { faithfulness: 0.8 },
      metrics: ['faithfulness', 'answerRelevance', 'contextPrecision'],
    };
    assertType<EvaluatorConfig>(config);
    expect(config.metrics).toHaveLength(3);
    expect(config.mode).toBe('hybrid');
  });

  it('is fully optional', () => {
    const config: EvaluatorConfig = {};
    assertType<EvaluatorConfig>(config);
    expect(config).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Evaluator interface — can be mock-implemented
// ---------------------------------------------------------------------------
describe('Evaluator', () => {
  it('can be mock-implemented with evaluate, evaluateBatch, and config', () => {
    const mockEvalResult: EvalResult = {
      sample: { question: 'Q?', answer: 'A.', contexts: [] },
      metrics: {} as Record<MetricId, MetricResult>,
      compositeScore: null,
      passed: false,
      cost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      durationMs: 1,
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };

    const mockBatchResult: BatchEvalResult = {
      results: [],
      aggregates: {} as Record<MetricId, MetricAggregate>,
      compositeAggregate: { mean: 0, median: 0, min: 0, max: 0, stdDev: 0, passRate: 0 },
      passed: false,
      totalCost: { llmCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, parseFailures: 0 },
      totalDurationMs: 0,
      evaluatedAt: '2026-03-21T00:00:00.000Z',
    };

    const mockEvaluator: Evaluator = {
      config: { mode: 'heuristic' },
      evaluate: async (_sample, _metrics?, _options?) => mockEvalResult,
      evaluateBatch: async (_samples, _metrics?, _options?) => mockBatchResult,
    };

    assertType<Evaluator>(mockEvaluator);
    expect(typeof mockEvaluator.evaluate).toBe('function');
    expect(typeof mockEvaluator.evaluateBatch).toBe('function');
    expect(mockEvaluator.config.mode).toBe('heuristic');
  });
});

// ---------------------------------------------------------------------------
// JudgeFn
// ---------------------------------------------------------------------------
describe('JudgeFn', () => {
  it('is a function that takes a string and returns Promise<string>', async () => {
    const judge: JudgeFn = async (prompt) => `Response to: ${prompt}`;
    assertType<JudgeFn>(judge);
    const result = await judge('test prompt');
    expect(result).toBe('Response to: test prompt');
  });
});

// ---------------------------------------------------------------------------
// PromptOverrides
// ---------------------------------------------------------------------------
describe('PromptOverrides', () => {
  it('is a partial record of MetricId to string', () => {
    const overrides: PromptOverrides = {
      faithfulness: 'Custom faithfulness prompt',
      contextPrecision: 'Custom context precision prompt',
    };
    assertType<PromptOverrides>(overrides);
    expect(overrides.faithfulness).toBe('Custom faithfulness prompt');
    expect(overrides.answerRelevance).toBeUndefined();
  });

  it('can be empty', () => {
    const overrides: PromptOverrides = {};
    assertType<PromptOverrides>(overrides);
    expect(overrides).toEqual({});
  });
});
