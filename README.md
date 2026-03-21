# rag-eval-node-ts

Lightweight RAG evaluation metrics for CI/CD pipelines. Provides seven metrics for measuring RAG pipeline quality, with heuristic, LLM-as-judge, and hybrid evaluation modes.

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

### LLM-as-judge mode

```ts
import { evaluate } from 'rag-eval-node-ts';
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';
import OpenAI from 'openai';

const judge = createOpenAIJudge({ client: new OpenAI() });

const result = await evaluate(
  {
    question: 'What is RAG?',
    answer: 'RAG stands for Retrieval-Augmented Generation.',
    contexts: ['RAG is a technique that combines retrieval with generation.'],
  },
  undefined,
  { mode: 'llm', judge },
);
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

## Exports

All 17 types are exported from the main entry point:

| Type | Description |
|------|-------------|
| `MetricId` | Union of the 7 metric identifier strings |
| `EvaluationMode` | `'heuristic' \| 'llm' \| 'hybrid'` |
| `EvalSample` | Input sample: question, answer, contexts, optional groundTruth |
| `EvalSignal` | A specific finding detected during metric computation |
| `MetricResult` | Result of computing one metric on one sample |
| `CostTracker` | LLM call and token usage tracking |
| `EvalResult` | Result of evaluating a single sample |
| `MetricAggregate` | Per-metric aggregate statistics across a batch |
| `MetricRegression` | Regression comparison for a single metric against a baseline |
| `BatchEvalResult` | Result of evaluating a batch of samples |
| `JudgeFn` | `(prompt: string) => Promise<string>` |
| `PromptOverrides` | Per-metric prompt template overrides |
| `MetricThresholds` | Per-metric pass/fail thresholds |
| `HeuristicOptions` | Tuning parameters for heuristic mode |
| `EvaluateOptions` | Options for a single evaluate() call |
| `BatchEvaluateOptions` | Options for evaluateBatch() including concurrency and regression |
| `EvaluatorConfig` | Configuration for createEvaluator() |
| `Evaluator` | Pre-configured evaluator instance interface |

## Supported Metrics

| Metric | Description | Requires groundTruth |
|--------|-------------|---------------------|
| `answerRelevance` | How well the answer addresses the question | No |
| `contextPrecision` | Ranking quality of retrieved context chunks | Optional |
| `contextRecall` | Coverage of ground truth by retrieved contexts | Yes |
| `faithfulness` | Whether answer claims are supported by context | No |
| `answerCorrectness` | Similarity between answer and ground truth | Yes |
| `chunkAttribution` | Alias for context-level faithfulness attribution | No |
| `chunkUtilization` | Fraction of context chunks actually used in the answer | No |

## Evaluation Modes

| Mode | Description | LLM Cost |
|------|-------------|----------|
| `heuristic` | Deterministic text-overlap and keyword heuristics | None |
| `llm` | LLM-as-judge via a pluggable `JudgeFn` | Per-call |
| `hybrid` | Routes each metric to heuristic or LLM based on configuration | Partial |

Heuristic mode is designed for CI/CD pipelines where cost and determinism matter. LLM mode provides higher accuracy for release gates and A/B testing. Hybrid mode balances cost and accuracy by routing semantic metrics to LLM and simpler metrics to heuristics.

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
