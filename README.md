# rag-eval-node-ts

Lightweight RAG evaluation metrics for CI/CD pipelines. Provides seven metrics for measuring RAG pipeline quality, with heuristic evaluation mode (zero LLM cost) and a pluggable LLM-as-judge interface for hybrid or full LLM modes.

## Installation

```bash
npm install rag-eval-node-ts
```

For LLM-as-judge mode, install optional peer dependencies:

```bash
# OpenAI
npm install openai

# Anthropic
npm install @anthropic-ai/sdk
```

## Quick Start

### Heuristic mode (zero LLM cost)

```ts
import { evaluate } from 'rag-eval-node-ts';

const result = await evaluate({
  question: 'What is retrieval-augmented generation?',
  answer: 'RAG combines retrieval with generation to produce grounded answers.',
  contexts: [
    'Retrieval-augmented generation (RAG) is a technique that combines information retrieval with text generation.',
  ],
  groundTruth: 'RAG is a method that retrieves relevant documents and uses them to generate accurate responses.',
});

console.log(result.compositeScore); // 0.0 - 1.0
console.log(result.passed);        // true if all metrics pass thresholds
```

### Pre-configured evaluator

```ts
import { createEvaluator } from 'rag-eval-node-ts';

const evaluator = createEvaluator({
  mode: 'heuristic',
  metrics: ['faithfulness', 'answerRelevance', 'contextPrecision'],
  thresholds: { faithfulness: 0.8 },
  compositeThreshold: 0.7,
});

const result = await evaluator.evaluate(sample);
const batchResult = await evaluator.evaluateBatch(samples);
```

### Batch evaluation

```ts
import { evaluateBatch } from 'rag-eval-node-ts';

const batchResult = await evaluateBatch(samples, undefined, {
  concurrency: 8,
  onProgress: (completed, total) => console.log(`${completed}/${total}`),
});

console.log(batchResult.aggregates.faithfulness.mean);
console.log(batchResult.compositeAggregate.passRate);
```

### Regression detection

```ts
const baseline = await evaluateBatch(baselineSamples);
const current = await evaluateBatch(currentSamples, undefined, {
  baselineResult: baseline,
  regressionThreshold: 0.05,
});

for (const r of current.regressions ?? []) {
  if (r.regressed) {
    console.warn(`${r.metricId}: dropped by ${Math.abs(r.delta).toFixed(3)}`);
  }
}
```

## API

### `evaluate(sample, metrics?, options?): Promise<EvalResult>`

Evaluates a single `EvalSample` and returns an `EvalResult`.

- `sample` — the input (question, answer, contexts, optional groundTruth)
- `metrics` — subset of `MetricId[]` to compute (default: all 7)
- `options` — `EvaluateOptions` (thresholds, compositeThreshold, compositeWeights, heuristic tuning)

### `evaluateBatch(samples, metrics?, options?): Promise<BatchEvalResult>`

Evaluates a batch of samples with concurrency control and optional regression detection.

- `options.concurrency` — max parallel evaluations (default: 4)
- `options.onProgress` — progress callback
- `options.baselineResult` — prior `BatchEvalResult` for regression comparison
- `options.regressionThreshold` — minimum mean drop to flag a regression (default: 0.05)

### `createEvaluator(config): Evaluator`

Returns a pre-configured `Evaluator` instance. Config is merged with per-call options; per-call options win on conflict.

```ts
const evaluator = createEvaluator({
  mode: 'heuristic',
  metrics: ['faithfulness', 'answerRelevance'],
  thresholds: { faithfulness: 0.8 },
  compositeThreshold: 0.65,
  heuristic: { claimSupportThreshold: 0.2 },
});

// evaluate() and evaluateBatch() are bound to this config
const result = await evaluator.evaluate(sample);
```

## Metrics

All 7 metrics operate in heuristic mode using text overlap, TF-IDF similarity, and token-level F1.

| Metric | `MetricId` | Requires `groundTruth` | Default Threshold | Description |
|--------|-----------|----------------------|-------------------|-------------|
| Faithfulness | `faithfulness` | No | 0.7 | Is the answer supported by the contexts? Scores each answer sentence against the best-matching context chunk using weighted n-gram overlap. |
| Answer Relevance | `answerRelevance` | No | 0.7 | Is the answer relevant to the question? Averages TF-IDF cosine similarity and unigram Jaccard overlap between question and answer. |
| Context Precision | `contextPrecision` | No | 0.7 | Are retrieved contexts relevant to the question? Average TF-IDF similarity of each context chunk against the question. |
| Context Recall | `contextRecall` | Yes | 0.7 | Do contexts cover the ground truth? Fraction of ground-truth sentences with unigram overlap >= 0.3 against any context chunk. |
| Context Relevance | `contextRelevance` | No | 0.6 | Stricter relevance check: fraction of context chunks with weighted n-gram overlap >= `chunkRelevanceThreshold` (default 0.2). |
| Answer Correctness | `answerCorrectness` | Yes | 0.6 | Is the answer factually correct vs ground truth? Blends token F1 (70%) and unigram Jaccard (30%). |
| Hallucination Rate | `hallucinationRate` | No | 0.7 | Does the answer contain unsupported claims? Score = 1 − (fraction of answer sentences with max context overlap < `claimSupportThreshold`). |

## Heuristic Options

Pass via `options.heuristic` or `EvaluatorConfig.heuristic`:

| Option | Default | Description |
|--------|---------|-------------|
| `claimSupportThreshold` | 0.15 | Min unigram overlap for a sentence to be considered context-supported (hallucinationRate). |
| `chunkRelevanceThreshold` | 0.2 | Min weighted n-gram overlap for a chunk to count as relevant (contextRelevance). |
| `ngramSizes` | `[1, 2]` | N-gram sizes for weighted overlap. |
| `ngramWeights` | `[0.7, 0.3]` | Weights for each n-gram size. |

## Signals

Each `MetricResult` includes a `signals` array of `EvalSignal` objects flagging specific findings:

| Severity | When emitted |
|----------|-------------|
| `warning` | Answer sentence has low context support (faithfulness), answer relevance is low, answer correctness is low |
| `info` | Context chunks with low precision score listed (contextPrecision) |
| `critical` | Specific unsupported answer sentences (hallucinationRate) |

## Exports

### Functions
- `evaluate` — single sample evaluation
- `evaluateBatch` — batch evaluation with concurrency
- `createEvaluator` — pre-configured evaluator factory

### Metric functions
- `scoreFaithfulness`, `scoreAnswerRelevance`, `scoreContextPrecision`
- `scoreContextRecall`, `scoreContextRelevance`, `scoreAnswerCorrectness`
- `scoreHallucinationRate`
- `computeMetric` — dispatch by MetricId

### Heuristic primitives
- `tokenize`, `getNgrams`, `ngramOverlap`, `weightedNgramOverlap`
- `buildTfIdfVectors`, `cosineSimilarity`, `tfidfSimilarity`
- `tokenF1`
- `splitSentences`, `filterFactualSentences`

### Types
All 18 types are exported: `MetricId`, `EvaluationMode`, `EvalSample`, `EvalSignal`, `MetricResult`, `CostTracker`, `EvalResult`, `MetricAggregate`, `MetricRegression`, `BatchEvalResult`, `JudgeFn`, `PromptOverrides`, `MetricThresholds`, `HeuristicOptions`, `EvaluateOptions`, `BatchEvaluateOptions`, `EvaluatorConfig`, `Evaluator`.

## Evaluation Modes

| Mode | Description | LLM Cost |
|------|-------------|----------|
| `heuristic` | Deterministic text-overlap and TF-IDF heuristics | None |
| `llm` | LLM-as-judge via a pluggable `JudgeFn` | Per-call |
| `hybrid` | Routes each metric to heuristic or LLM based on config | Partial |

LLM and hybrid modes are accepted by the API but currently route to heuristic; full LLM judge integration is planned.

## Adapters

LLM adapters are available as subpath imports:

```ts
// OpenAI
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';

// Anthropic
import { createAnthropicJudge } from 'rag-eval-node-ts/adapters/anthropic';
```

## License

MIT
