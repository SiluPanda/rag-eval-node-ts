// ── Input Types ──────────────────────────────────────────────────────

/** The atomic unit of RAG evaluation. All metrics operate on this structure. */
export interface EvalSample {
  /** The user's question or query. */
  question: string;

  /** The generated answer from the RAG pipeline. */
  answer: string;

  /**
   * The retrieved context chunks provided to the LLM.
   * Order matters for contextPrecision: index 0 is the highest-ranked chunk.
   */
  contexts: string[];

  /**
   * The reference (ground truth) answer.
   * Required for: contextPrecision, contextRecall, answerCorrectness.
   * Optional for all other metrics.
   */
  groundTruth?: string;

  /** Optional identifier for tracking in batch results and reports. */
  id?: string;

  /** Optional metadata for grouping, filtering, or annotation. */
  metadata?: Record<string, unknown>;
}

// ── Metric Types ──────────────────────────────────────────────────────

export type MetricId =
  | 'faithfulness'
  | 'answerRelevance'
  | 'contextPrecision'
  | 'contextRecall'
  | 'contextRelevance'
  | 'answerCorrectness'
  | 'hallucinationRate';

export type EvaluationMode = 'heuristic' | 'llm' | 'hybrid';

/** A specific finding detected during metric computation. */
export interface EvalSignal {
  /** Machine-readable identifier for this signal type. */
  id: string;

  /** Which metric produced this signal. */
  metricId: MetricId;

  /** Severity level of the signal. */
  severity: 'info' | 'warning' | 'critical';

  /** Human-readable description of the finding. */
  message: string;

  /**
   * The specific text (claim, sentence, context chunk excerpt) that triggered this signal.
   */
  evidence?: string;

  /** Index of the context chunk involved, if applicable. */
  contextChunkIndex?: number;
}

/** The result of computing one metric on one EvalSample. */
export interface MetricResult {
  metricId: MetricId;

  /**
   * The 0-1 score. null if the metric could not be computed
   * (missing required inputs, all LLM calls failed).
   */
  score: number | null;

  /** The mode used to compute this metric (heuristic or llm, not hybrid). */
  mode: 'heuristic' | 'llm';

  /** Whether the score meets the configured threshold. null if score is null. */
  passed: boolean | null;

  /** The configured threshold used for pass/fail. */
  threshold: number;

  /** Human-readable explanation of how the score was determined. */
  explanation: string;

  /** Specific findings supporting the score. */
  signals: EvalSignal[];

  /** Number of LLM judge calls made for this metric. */
  llmCalls: number;

  /** Wall-clock duration in milliseconds. */
  durationMs: number;
}

// ── Result Types ──────────────────────────────────────────────────────

/** Cost tracking for an evaluation run. */
export interface CostTracker {
  llmCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  parseFailures: number;
}

/** The result of evaluating a single EvalSample. */
export interface EvalResult {
  sample: EvalSample;
  metrics: Record<MetricId, MetricResult>;

  /**
   * Weighted average of all computed metric scores.
   * null if no metrics were successfully computed.
   */
  compositeScore: number | null;

  /** true if all computed metrics passed their thresholds and composite score passes compositeThreshold. */
  passed: boolean;

  cost: CostTracker;
  durationMs: number;
  evaluatedAt: string; // ISO 8601 timestamp
}

/** Per-metric aggregate statistics across a batch. */
export interface MetricAggregate {
  metricId: MetricId;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  passRate: number;  // fraction of samples where this metric passed its threshold
  nullRate: number;  // fraction of samples where score was null (could not be computed)
}

/** Regression comparison for a single metric against a baseline. */
export interface MetricRegression {
  metricId: MetricId;
  baselineMean: number;
  currentMean: number;
  delta: number;       // currentMean - baselineMean (negative = regression)
  regressed: boolean;  // true if delta < -regressionThreshold
}

/** The result of evaluating a batch of EvalSamples. */
export interface BatchEvalResult {
  results: EvalResult[];
  aggregates: Record<MetricId, MetricAggregate>;
  compositeAggregate: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
    passRate: number;
  };
  passed: boolean;
  totalCost: CostTracker;
  totalDurationMs: number;
  regressions?: MetricRegression[];  // present if baseline was provided
  evaluatedAt: string;
}

// ── Configuration Types ──────────────────────────────────────────────

export type JudgeFn = (prompt: string) => Promise<string>;

export type PromptOverrides = Partial<Record<MetricId, string>>;

export interface MetricThresholds {
  faithfulness?: number;          // default: 0.7
  answerRelevance?: number;       // default: 0.7
  contextPrecision?: number;      // default: 0.7
  contextRecall?: number;         // default: 0.7
  contextRelevance?: number;      // default: 0.6
  answerCorrectness?: number;     // default: 0.6
  hallucinationRate?: number;     // default: 0.7
}

export interface HeuristicOptions {
  claimSupportThreshold?: number;
  chunkRelevanceThreshold?: number;
  sentenceCoverageThreshold?: number;
  ngramWeight?: number;
  tfidfWeight?: number;
  ngramSizes?: number[];
  ngramWeights?: number[];
}

export interface EvaluateOptions {
  mode?: EvaluationMode;          // default: 'heuristic'
  judge?: JudgeFn;                // required when mode is 'llm' or 'hybrid'
  thresholds?: MetricThresholds;
  metricModes?: Partial<Record<MetricId, 'heuristic' | 'llm'>>;
  compositeThreshold?: number;    // default: 0.7
  compositeWeights?: Partial<Record<MetricId, number>>; // default: equal weights
  heuristic?: HeuristicOptions;
  promptOverrides?: PromptOverrides;
}

export interface BatchEvaluateOptions extends EvaluateOptions {
  concurrency?: number;           // default: 4
  onProgress?: (completed: number, total: number) => void;
  baselineResult?: BatchEvalResult;
  regressionThreshold?: number;   // default: 0.05 (5-point drop triggers regression flag)
}

export interface EvaluatorConfig extends EvaluateOptions {
  metrics?: MetricId[];           // which metrics to compute by default
}

/** A pre-configured evaluator instance. */
export interface Evaluator {
  evaluate(sample: EvalSample, metrics?: MetricId[], options?: EvaluateOptions): Promise<EvalResult>;
  evaluateBatch(samples: EvalSample[], metrics?: MetricId[], options?: BatchEvaluateOptions): Promise<BatchEvalResult>;
  readonly config: EvaluatorConfig;
}
