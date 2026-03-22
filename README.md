# rag-eval-node-ts

Lightweight RAG evaluation metrics for Node.js -- seven metrics, heuristic-first, zero LLM cost in CI.

[![npm version](https://img.shields.io/npm/v/rag-eval-node-ts)](https://www.npmjs.com/package/rag-eval-node-ts)
[![license](https://img.shields.io/npm/l/rag-eval-node-ts)](https://github.com/SiluPanda/rag-eval-node-ts/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/rag-eval-node-ts)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Description

`rag-eval-node-ts` is a RAG (Retrieval-Augmented Generation) evaluation library that measures the quality of RAG pipeline outputs using seven metrics: faithfulness, answer relevance, context precision, context recall, context relevance, answer correctness, and hallucination rate.

The library is designed for CI/CD quality gates, regression detection, and A/B testing between pipeline configurations. All metrics run in deterministic heuristic mode by default -- no LLM API keys, no per-evaluation cost, sub-100ms per sample. When higher accuracy is needed, a pluggable `JudgeFn` interface allows switching to LLM-as-judge or hybrid evaluation with a single configuration change.

Key design principles:

- **Heuristic-first**: Every metric works out of the box using n-gram overlap, TF-IDF cosine similarity, and token-level F1. No external API calls required.
- **LLM-optional**: Provide a `JudgeFn` to enable LLM-as-judge mode for higher accuracy when needed.
- **CI-ready**: Threshold-based pass/fail, regression detection against baselines, batch evaluation with concurrency control, and structured output for downstream processing.
- **Fully typed**: All 18 public types are exported. Zero runtime type assertions.
- **Zero runtime dependencies**: Core heuristic evaluation uses only built-in Node.js APIs. LLM provider SDKs are optional peer dependencies.

---

## Installation

```bash
npm install rag-eval-node-ts
```

For LLM-as-judge mode, install the optional peer dependency for your provider:

```bash
# OpenAI
npm install openai

# Anthropic
npm install @anthropic-ai/sdk
```

---

## Quick Start

### Evaluate a single sample

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

console.log(result.compositeScore);  // 0.0 - 1.0
console.log(result.passed);          // true if all metrics pass thresholds
console.log(result.metrics.faithfulness.score);
console.log(result.metrics.faithfulness.explanation);
```

### Evaluate a batch with progress tracking

```ts
import { evaluateBatch } from 'rag-eval-node-ts';

const batchResult = await evaluateBatch(samples, undefined, {
  concurrency: 8,
  onProgress: (completed, total) => console.log(`${completed}/${total}`),
});

console.log(batchResult.aggregates.faithfulness.mean);
console.log(batchResult.compositeAggregate.passRate);
```

### Use a pre-configured evaluator

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

### Detect regressions against a baseline

```ts
import { evaluateBatch } from 'rag-eval-node-ts';

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

---

## Features

- **Seven RAG-specific metrics** covering faithfulness, relevance, precision, recall, correctness, and hallucination detection.
- **Heuristic evaluation mode** using n-gram overlap, TF-IDF cosine similarity, token-level F1, and sentence segmentation. Deterministic, fast, zero cost.
- **LLM-as-judge mode** via a pluggable `JudgeFn` interface (`(prompt: string) => Promise<string>`). Bring your own model and provider.
- **Hybrid mode** that routes each metric to heuristic or LLM based on per-metric configuration.
- **Batch evaluation** with configurable concurrency and progress callbacks.
- **Regression detection** comparing current results against a baseline `BatchEvalResult`, flagging metrics where the mean score drops below a configurable threshold.
- **Aggregate statistics** per metric across a batch: mean, median, min, max, standard deviation, pass rate, null rate.
- **Threshold-based pass/fail** per metric and composite, with configurable thresholds and composite weights.
- **Detailed signals** identifying specific findings (unsupported claims, low-relevance chunks, hallucinated sentences) with severity levels and evidence excerpts.
- **Pre-configured evaluator factory** via `createEvaluator()` for reusable evaluation configurations.
- **Exported heuristic primitives** for building custom metrics: tokenization, n-gram overlap, TF-IDF vectors, cosine similarity, token F1, sentence splitting.
- **Full TypeScript support** with 18 exported types covering inputs, outputs, configuration, and results.

---

## API Reference

### `evaluate(sample, metrics?, options?)`

Evaluate a single sample against the requested metrics.

**Signature:**

```ts
function evaluate(
  sample: EvalSample,
  metrics?: MetricId[],
  options?: EvaluateOptions,
): Promise<EvalResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sample` | `EvalSample` | The evaluation sample containing question, answer, contexts, and optional groundTruth. |
| `metrics` | `MetricId[]` | Which metrics to compute. Defaults to all seven. |
| `options` | `EvaluateOptions` | Thresholds, composite configuration, heuristic tuning. |

**Returns:** `Promise<EvalResult>` -- contains per-metric results, composite score, pass/fail, cost tracking, and timestamp.

**Example:**

```ts
import { evaluate } from 'rag-eval-node-ts';

const result = await evaluate(
  {
    question: 'What is machine learning?',
    answer: 'Machine learning trains models on data to make predictions.',
    contexts: ['Machine learning is a field of AI that trains models on data.'],
    groundTruth: 'Machine learning trains models on data to make predictions.',
  },
  ['faithfulness', 'answerRelevance'],
  { thresholds: { faithfulness: 0.8 }, compositeThreshold: 0.7 },
);

console.log(result.compositeScore);
console.log(result.metrics.faithfulness.score);
console.log(result.metrics.faithfulness.passed);
console.log(result.metrics.faithfulness.explanation);
console.log(result.metrics.faithfulness.signals);
```

---

### `evaluateBatch(samples, metrics?, options?)`

Evaluate a batch of samples with concurrency control and optional regression detection.

**Signature:**

```ts
function evaluateBatch(
  samples: EvalSample[],
  metrics?: MetricId[],
  options?: BatchEvaluateOptions,
): Promise<BatchEvalResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `samples` | `EvalSample[]` | Array of evaluation samples. |
| `metrics` | `MetricId[]` | Which metrics to compute. Defaults to all seven. |
| `options` | `BatchEvaluateOptions` | Extends `EvaluateOptions` with batch-specific settings. |

**Batch-specific options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `4` | Maximum number of parallel evaluations. |
| `onProgress` | `(completed: number, total: number) => void` | -- | Called after each sample completes. |
| `baselineResult` | `BatchEvalResult` | -- | Prior batch result for regression comparison. |
| `regressionThreshold` | `number` | `0.05` | Minimum mean score drop to flag a regression. |

**Returns:** `Promise<BatchEvalResult>` -- contains per-sample results, per-metric aggregates (mean, median, min, max, stdDev, passRate, nullRate), composite aggregates, pass/fail, cost, and optional regression flags.

**Example:**

```ts
import { evaluateBatch } from 'rag-eval-node-ts';

const result = await evaluateBatch(samples, ['faithfulness', 'contextPrecision'], {
  concurrency: 8,
  onProgress: (done, total) => process.stdout.write(`\r${done}/${total}`),
  baselineResult: previousResult,
  regressionThreshold: 0.03,
});

console.log(result.aggregates.faithfulness.mean);
console.log(result.aggregates.faithfulness.passRate);
console.log(result.compositeAggregate.stdDev);
console.log(result.passed);

if (result.regressions) {
  for (const reg of result.regressions) {
    if (reg.regressed) {
      console.warn(`Regression: ${reg.metricId} dropped ${Math.abs(reg.delta).toFixed(3)}`);
    }
  }
}
```

---

### `createEvaluator(config)`

Create a pre-configured evaluator instance. Configuration is merged with per-call options, with per-call options taking precedence on conflict.

**Signature:**

```ts
function createEvaluator(config: EvaluatorConfig): Evaluator
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `EvaluatorConfig` | Default configuration for all evaluations run through this instance. |

**Returns:** `Evaluator` -- an object with `evaluate()`, `evaluateBatch()`, and a read-only `config` property.

**`Evaluator` interface:**

```ts
interface Evaluator {
  evaluate(sample: EvalSample, metrics?: MetricId[], options?: EvaluateOptions): Promise<EvalResult>;
  evaluateBatch(samples: EvalSample[], metrics?: MetricId[], options?: BatchEvaluateOptions): Promise<BatchEvalResult>;
  readonly config: EvaluatorConfig;
}
```

**Example:**

```ts
import { createEvaluator } from 'rag-eval-node-ts';

const evaluator = createEvaluator({
  mode: 'heuristic',
  metrics: ['faithfulness', 'answerRelevance'],
  thresholds: { faithfulness: 0.8, answerRelevance: 0.7 },
  compositeThreshold: 0.65,
  compositeWeights: { faithfulness: 2.0, answerRelevance: 1.0 },
  heuristic: { ngramSizes: [1, 2], ngramWeights: [0.7, 0.3] },
});

// Per-call metrics override config defaults
const result = await evaluator.evaluate(sample, ['contextPrecision']);

// Per-call thresholds override config thresholds
const strict = await evaluator.evaluate(sample, undefined, {
  thresholds: { faithfulness: 0.95 },
});
```

---

### Individual Metric Functions

Each metric is available as a standalone async function. All accept an `EvalSample` and optional `HeuristicOptions`, and return a `Promise<MetricResult>`.

#### `scoreFaithfulness(sample, options?)`

Measures whether the answer is supported by the retrieved contexts. Scores each answer sentence against the best-matching context chunk using weighted n-gram overlap. Returns the average max-context overlap across all answer sentences.

- **Requires:** `question`, `answer`, `contexts`
- **Default threshold:** 0.7
- **Signals:** Emits `warning` signals for answer sentences with low context support (overlap < 0.3).

```ts
import { scoreFaithfulness } from 'rag-eval-node-ts';

const result = await scoreFaithfulness({
  question: 'What is RAG?',
  answer: 'RAG combines retrieval with generation.',
  contexts: ['RAG is a retrieval-augmented generation technique.'],
});
// result.score: number (0-1)
// result.signals: EvalSignal[] (warnings for unsupported sentences)
```

#### `scoreAnswerRelevance(sample, options?)`

Measures whether the answer addresses the question. Averages TF-IDF cosine similarity and unigram Jaccard overlap between question and answer.

- **Requires:** `question`, `answer`
- **Default threshold:** 0.7
- **Signals:** Emits `warning` when score is below 0.5.

```ts
import { scoreAnswerRelevance } from 'rag-eval-node-ts';

const result = await scoreAnswerRelevance({
  question: 'What is machine learning?',
  answer: 'Machine learning trains models on data.',
  contexts: [],
});
```

#### `scoreContextPrecision(sample, options?)`

Measures whether the retrieved contexts are relevant to the question. Computes the average TF-IDF similarity of each context chunk against the question.

- **Requires:** `question`, `contexts`
- **Default threshold:** 0.7
- **Signals:** Emits `info` listing context chunk indices with low relevance (< 0.3).

```ts
import { scoreContextPrecision } from 'rag-eval-node-ts';

const result = await scoreContextPrecision({
  question: 'What is RAG?',
  answer: 'RAG combines retrieval with generation.',
  contexts: [
    'RAG is a retrieval-augmented generation technique.',
    'The weather is sunny today.',
  ],
});
```

#### `scoreContextRecall(sample, options?)`

Measures whether the contexts cover the ground truth. Computes the fraction of ground-truth sentences that have unigram overlap >= 0.3 against any context chunk.

- **Requires:** `question`, `contexts`, `groundTruth` (returns `null` score if missing)
- **Default threshold:** 0.7

```ts
import { scoreContextRecall } from 'rag-eval-node-ts';

const result = await scoreContextRecall({
  question: 'What is RAG?',
  answer: 'RAG combines retrieval with generation.',
  contexts: ['RAG retrieves documents and generates answers.'],
  groundTruth: 'RAG retrieves relevant documents and uses them to generate answers.',
});
// result.score: number | null
```

#### `scoreContextRelevance(sample, options?)`

Stricter relevance check: computes the fraction of context chunks with weighted n-gram overlap above `chunkRelevanceThreshold` (default: 0.2) against the question.

- **Requires:** `question`, `contexts`
- **Default threshold:** 0.6
- **Configurable:** `chunkRelevanceThreshold`, `ngramSizes`, `ngramWeights` via `HeuristicOptions`.

```ts
import { scoreContextRelevance } from 'rag-eval-node-ts';

const result = await scoreContextRelevance(
  {
    question: 'What is RAG?',
    answer: 'RAG combines retrieval with generation.',
    contexts: ['RAG is a technique.', 'Unrelated content about sports.'],
  },
  { chunkRelevanceThreshold: 0.15 },
);
```

#### `scoreAnswerCorrectness(sample, options?)`

Measures factual correctness of the answer against the ground truth. Blends token F1 (70%) and unigram Jaccard overlap (30%).

- **Requires:** `question`, `answer`, `groundTruth` (returns `null` score if missing)
- **Default threshold:** 0.6
- **Signals:** Emits `warning` when score is below 0.5.

```ts
import { scoreAnswerCorrectness } from 'rag-eval-node-ts';

const result = await scoreAnswerCorrectness({
  question: 'What is RAG?',
  answer: 'RAG combines retrieval with generation.',
  contexts: [],
  groundTruth: 'RAG retrieves documents and uses them to generate answers.',
});
```

#### `scoreHallucinationRate(sample, options?)`

Detects unsupported claims in the answer. Score = 1 - (fraction of answer sentences with max context unigram overlap below `claimSupportThreshold`). Higher score means fewer hallucinations.

- **Requires:** `question`, `answer`, `contexts`
- **Default threshold:** 0.7
- **Default `claimSupportThreshold`:** 0.15
- **Signals:** Emits `critical` signals for each unsupported answer sentence with evidence.

```ts
import { scoreHallucinationRate } from 'rag-eval-node-ts';

const result = await scoreHallucinationRate(
  {
    question: 'What is RAG?',
    answer: 'RAG combines retrieval with generation. Dinosaurs are extinct.',
    contexts: ['RAG is a retrieval-augmented generation technique.'],
  },
  { claimSupportThreshold: 0.2 },
);
// result.signals: critical signals for "Dinosaurs are extinct."
```

#### `computeMetric(metricId, sample, options?)`

Dispatch function that routes a `MetricId` to the corresponding scoring function.

```ts
import { computeMetric } from 'rag-eval-node-ts';

const result = await computeMetric('faithfulness', sample);
```

---

### Heuristic Primitives

Low-level text analysis utilities exported for building custom metrics or integrating with other evaluation logic.

#### Sentence Utilities

```ts
import { splitSentences, filterFactualSentences } from 'rag-eval-node-ts';

const sentences = splitSentences('First sentence. Second sentence! Third?');
// ['First sentence.', 'Second sentence!', 'Third?']

const factual = filterFactualSentences(sentences);
// Filters to sentences with >= 3 words
```

- `splitSentences(text: string): string[]` -- splits on `.`, `!`, `?` followed by whitespace and uppercase letter or end of string.
- `filterFactualSentences(sentences: string[]): string[]` -- keeps sentences with at least 3 words.

#### N-gram Utilities

```ts
import { tokenize, getNgrams, ngramOverlap, weightedNgramOverlap } from 'rag-eval-node-ts';

const tokens = tokenize('Hello, World!');
// ['hello', 'world']

const bigrams = getNgrams(tokens, 2);
// ['hello world']

const overlap = ngramOverlap('the cat sat', 'the cat ran', 1);
// Jaccard similarity on unigrams: |{the,cat}| / |{the,cat,sat,ran}| = 0.5

const weighted = weightedNgramOverlap('the cat sat', 'the cat ran', [1, 2], [0.7, 0.3]);
// Weighted average of unigram and bigram overlap
```

- `tokenize(text: string): string[]` -- lowercases, splits on whitespace and punctuation, filters empty tokens.
- `getNgrams(tokens: string[], n: number): string[]` -- returns n-grams as joined strings.
- `ngramOverlap(a: string, b: string, n?: number): number` -- Jaccard similarity on n-gram sets. Default `n=1`.
- `weightedNgramOverlap(a: string, b: string, ngramSizes?: number[], weights?: number[]): number` -- weighted average of `ngramOverlap` for multiple n-gram sizes. Defaults: `ngramSizes=[1,2]`, `weights=[0.7, 0.3]`.

#### TF-IDF Utilities

```ts
import { buildTfIdfVectors, cosineSimilarity, tfidfSimilarity } from 'rag-eval-node-ts';

// Quick similarity between two texts
const sim = tfidfSimilarity('retrieval augmented generation', 'RAG combines retrieval with generation');

// Full control: build vectors, compute similarity manually
const { queryVec, docVecs } = buildTfIdfVectors('search query', ['doc one', 'doc two']);
const score = cosineSimilarity(queryVec, docVecs[0]);
```

- `tfidfSimilarity(query: string, document: string): number` -- convenience function returning TF-IDF cosine similarity between two texts.
- `buildTfIdfVectors(query: string, documents: string[]): { queryVec: Map<string, number>; docVecs: Map<string, number>[] }` -- builds TF-IDF vectors using sklearn-style smooth IDF: `log((N+1)/(df+1)) + 1`.
- `cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number` -- cosine similarity between two sparse vectors represented as Maps.

#### Token F1

```ts
import { tokenF1 } from 'rag-eval-node-ts';

const f1 = tokenF1('the cat sat on the mat', 'the cat sat on a rug');
// Multiset intersection F1 between tokenized reference and hypothesis
```

- `tokenF1(reference: string, hypothesis: string): number` -- token-level F1 score using multiset intersection. Returns 0 if either input is empty.

---

## Configuration

### `EvaluateOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'heuristic' \| 'llm' \| 'hybrid'` | `'heuristic'` | Evaluation mode. |
| `judge` | `JudgeFn` | -- | Required when mode is `'llm'` or `'hybrid'`. Signature: `(prompt: string) => Promise<string>`. |
| `thresholds` | `MetricThresholds` | See below | Per-metric pass/fail thresholds. |
| `metricModes` | `Partial<Record<MetricId, 'heuristic' \| 'llm'>>` | -- | Override evaluation mode per metric. |
| `compositeThreshold` | `number` | `0.6` | Minimum composite score to pass. |
| `compositeWeights` | `Partial<Record<MetricId, number>>` | Equal weights (1.0) | Weights for composite score calculation. |
| `heuristic` | `HeuristicOptions` | See below | Tuning parameters for heuristic algorithms. |
| `promptOverrides` | `PromptOverrides` | -- | Custom prompt templates per metric for LLM mode. |

### `MetricThresholds` (defaults)

| Metric | Default Threshold |
|--------|-------------------|
| `faithfulness` | 0.7 |
| `answerRelevance` | 0.7 |
| `contextPrecision` | 0.7 |
| `contextRecall` | 0.7 |
| `contextRelevance` | 0.6 |
| `answerCorrectness` | 0.6 |
| `hallucinationRate` | 0.7 |

### `HeuristicOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `claimSupportThreshold` | `number` | `0.15` | Minimum unigram overlap for a sentence to be considered context-supported (used by `hallucinationRate`). |
| `chunkRelevanceThreshold` | `number` | `0.2` | Minimum weighted n-gram overlap for a context chunk to count as relevant (used by `contextRelevance`). |
| `sentenceCoverageThreshold` | `number` | -- | Override for sentence coverage matching threshold. |
| `ngramWeight` | `number` | -- | Weight for n-gram similarity in composite scoring. |
| `tfidfWeight` | `number` | -- | Weight for TF-IDF similarity in composite scoring. |
| `ngramSizes` | `number[]` | `[1, 2]` | N-gram sizes for weighted overlap calculations. |
| `ngramWeights` | `number[]` | `[0.7, 0.3]` | Corresponding weights for each n-gram size. |

### `EvaluatorConfig`

Extends `EvaluateOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metrics` | `MetricId[]` | All seven | Which metrics to compute by default when none specified per-call. |

---

## Error Handling

### Missing `groundTruth`

Metrics that require `groundTruth` (`contextRecall`, `answerCorrectness`) return a `MetricResult` with `score: null` and `passed: null` when `groundTruth` is not provided. These null scores are excluded from the composite score calculation and tracked via `nullRate` in batch aggregates.

```ts
const result = await evaluate({
  question: 'What is RAG?',
  answer: 'RAG combines retrieval with generation.',
  contexts: ['RAG is a technique.'],
  // no groundTruth
});

console.log(result.metrics.contextRecall.score);   // null
console.log(result.metrics.contextRecall.passed);   // null
console.log(result.metrics.contextRecall.explanation);
// "groundTruth is required for contextRecall but was not provided."
```

### Empty contexts

When `contexts` is an empty array, metrics that depend on context (`faithfulness`, `contextPrecision`, `contextRelevance`, `hallucinationRate`) return a score of 0 with `passed: false`.

### Empty answer

When the answer produces no sentences after splitting, `faithfulness` and `hallucinationRate` handle the edge case explicitly (score 0 for faithfulness, score 1 for hallucinationRate if contexts exist).

### Composite score

If no metrics produce a non-null score, `compositeScore` is `null` and `passed` is `false`.

---

## Advanced Usage

### Custom composite weights

Weight specific metrics more heavily in the composite score:

```ts
const result = await evaluate(sample, undefined, {
  compositeWeights: {
    faithfulness: 3.0,
    hallucinationRate: 2.0,
    answerRelevance: 1.0,
    contextPrecision: 1.0,
    contextRecall: 1.0,
    contextRelevance: 1.0,
    answerCorrectness: 1.0,
  },
  compositeThreshold: 0.75,
});
```

### Per-metric mode overrides

In hybrid mode, override the evaluation mode for individual metrics:

```ts
const evaluator = createEvaluator({
  mode: 'hybrid',
  judge: myJudgeFn,
  metricModes: {
    faithfulness: 'llm',
    answerRelevance: 'llm',
    contextPrecision: 'heuristic',
    contextRecall: 'heuristic',
  },
});
```

### Regression detection in CI

Store a baseline result and compare on each run:

```ts
import { evaluateBatch } from 'rag-eval-node-ts';
import { readFileSync, writeFileSync } from 'node:fs';

// Load baseline from a committed JSON file
const baseline = JSON.parse(readFileSync('eval-baseline.json', 'utf-8'));

const current = await evaluateBatch(samples, undefined, {
  baselineResult: baseline,
  regressionThreshold: 0.03,
});

// Check for regressions
const regressions = (current.regressions ?? []).filter(r => r.regressed);
if (regressions.length > 0) {
  console.error('Regressions detected:');
  for (const r of regressions) {
    console.error(`  ${r.metricId}: ${r.baselineMean.toFixed(3)} -> ${r.currentMean.toFixed(3)} (delta: ${r.delta.toFixed(3)})`);
  }
  process.exit(1);
}

// Update baseline if all checks pass
writeFileSync('eval-baseline.json', JSON.stringify(current, null, 2));
```

### Inspecting signals

Signals provide fine-grained diagnostic information about each metric result:

```ts
const result = await evaluate(sample, ['faithfulness', 'hallucinationRate']);

for (const signal of result.metrics.faithfulness.signals) {
  console.log(`[${signal.severity}] ${signal.message}`);
  if (signal.evidence) {
    console.log(`  Evidence: "${signal.evidence}"`);
  }
}

for (const signal of result.metrics.hallucinationRate.signals) {
  if (signal.severity === 'critical') {
    console.error(`Hallucinated: "${signal.evidence}"`);
  }
}
```

### Tuning heuristic sensitivity

Adjust n-gram sizes and weights for different text characteristics:

```ts
const evaluator = createEvaluator({
  mode: 'heuristic',
  heuristic: {
    ngramSizes: [1, 2, 3],
    ngramWeights: [0.5, 0.3, 0.2],
    claimSupportThreshold: 0.2,
    chunkRelevanceThreshold: 0.15,
  },
});
```

### LLM adapter subpath imports

LLM adapters for OpenAI and Anthropic are available as subpath imports:

```ts
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';
import { createAnthropicJudge } from 'rag-eval-node-ts/adapters/anthropic';
```

---

## TypeScript

All public types are exported from the package root. The library ships with declaration files and declaration maps.

```ts
import type {
  // Input types
  EvalSample,
  MetricId,
  EvaluationMode,

  // Signal and result types
  EvalSignal,
  MetricResult,
  CostTracker,
  EvalResult,
  MetricAggregate,
  MetricRegression,
  BatchEvalResult,

  // Configuration types
  JudgeFn,
  PromptOverrides,
  MetricThresholds,
  HeuristicOptions,
  EvaluateOptions,
  BatchEvaluateOptions,
  EvaluatorConfig,
  Evaluator,
} from 'rag-eval-node-ts';
```

### Key type definitions

```ts
interface EvalSample {
  question: string;
  answer: string;
  contexts: string[];
  groundTruth?: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

type MetricId =
  | 'faithfulness'
  | 'answerRelevance'
  | 'contextPrecision'
  | 'contextRecall'
  | 'contextRelevance'
  | 'answerCorrectness'
  | 'hallucinationRate';

type EvaluationMode = 'heuristic' | 'llm' | 'hybrid';

type JudgeFn = (prompt: string) => Promise<string>;
```

---

## Evaluation Modes

| Mode | Algorithm | LLM Cost | Use Case |
|------|-----------|----------|----------|
| `heuristic` | Deterministic text-overlap, TF-IDF, token F1 | None | CI/CD pipelines, high-volume batch evaluation |
| `llm` | LLM-as-judge via pluggable `JudgeFn` | Per-call | Release gates, building evaluation datasets |
| `hybrid` | Routes each metric to heuristic or LLM per config | Partial | Balanced accuracy and cost |

The heuristic mode is fully implemented and production-ready. LLM and hybrid modes accept configuration through the API and route to heuristic evaluation; full LLM judge integration is planned for a future release.

---

## Metrics Reference

| Metric | `MetricId` | Requires `groundTruth` | Default Threshold | Algorithm |
|--------|-----------|----------------------|-------------------|-----------|
| Faithfulness | `faithfulness` | No | 0.7 | Weighted n-gram overlap of each answer sentence against best-matching context chunk |
| Answer Relevance | `answerRelevance` | No | 0.7 | Average of TF-IDF cosine similarity and unigram Jaccard overlap between question and answer |
| Context Precision | `contextPrecision` | No | 0.7 | Average TF-IDF similarity of each context chunk against the question |
| Context Recall | `contextRecall` | Yes | 0.7 | Fraction of ground-truth sentences with unigram overlap >= 0.3 against any context chunk |
| Context Relevance | `contextRelevance` | No | 0.6 | Fraction of context chunks with weighted n-gram overlap >= chunkRelevanceThreshold (default 0.2) |
| Answer Correctness | `answerCorrectness` | Yes | 0.6 | 70% token F1 + 30% unigram Jaccard overlap between answer and ground truth |
| Hallucination Rate | `hallucinationRate` | No | 0.7 | 1 - (fraction of answer sentences with max context unigram overlap below claimSupportThreshold) |

---

## License

MIT
