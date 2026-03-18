# rag-eval-node-ts -- Specification

## 1. Overview

`rag-eval-node-ts` is a RAG (Retrieval-Augmented Generation) evaluation library for Node.js that measures the quality of RAG pipeline outputs using a comprehensive set of metrics: faithfulness, answer relevance, context precision, context recall, context relevance, answer correctness, and hallucination rate. It is designed for CI/CD quality gates, regression detection, A/B testing between pipeline configurations, and batch offline evaluation. It supports two evaluation modes -- deterministic heuristic evaluation (zero LLM cost) and LLM-as-judge evaluation (higher accuracy, uses a pluggable judge function) -- and a hybrid mode that routes each metric to the appropriate mode based on configuration.

The gap this package fills is specific and well-defined. RAGAS (RAG Assessment) is the gold standard for RAG evaluation in Python. It provides faithfulness, answer relevance, context precision, context recall, and context relevance metrics computed with a combination of heuristics and LLM-as-judge calls. It is widely used, well-documented, and the reference implementation that the research community benchmarks against. In JavaScript and TypeScript, there is nothing comparable. The only npm package that attempts a RAGAS port is a seventeen-day-old v0.1.0 package with zero dependents, no documentation, and no maintained tests. The major evaluation frameworks -- DeepEval, TruLens, Arize Phoenix -- are all Python-first. `deepeval` has a JavaScript SDK, but its RAG-specific metrics are thin wrappers over LLM calls with no heuristic fallback. There is no package on npm that provides the full set of RAGAS metrics, a heuristic mode for cost-free CI evaluation, and first-class TypeScript types.

The adjacent packages in this monorepo address narrower problems: `rag-cite` extracts and verifies citations in RAG responses; `output-grade` scores LLM output quality with zero-cost heuristics; `hallucinate-check` detects hallucination indicators; `rag-prompt-builder` composes RAG prompts with context chunks. `rag-eval-node-ts` is the comprehensive evaluation layer that sits above all of these -- it runs a full evaluation suite across an `EvalSample` (question, answer, contexts, optional ground truth) and returns a structured `EvalResult` with per-metric scores, explanations, aggregate statistics, and pass/fail determination against configurable thresholds.

The design philosophy is: heuristic-first, LLM-optional. Most CI pipelines cannot afford to call an LLM judge on every commit. `rag-eval-node-ts` provides meaningful, fast, deterministic heuristic scores for all seven metrics so that evaluation can run in CI without API keys or per-evaluation cost. When higher accuracy is needed -- for thorough release-gate evaluation, A/B comparisons, or building evaluation datasets -- users switch to LLM mode or hybrid mode by providing a judge function. The same API, the same types, the same configuration surface covers both modes. Switching from heuristic to LLM mode is a single configuration change.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `evaluate(sample, metrics?, options?)` function that accepts an `EvalSample` and returns an `EvalResult` containing per-metric scores, signals, explanations, and a pass/fail determination.
- Provide a `evaluateBatch(samples, metrics?, options?)` function that evaluates an array of `EvalSample` objects, returning a `BatchEvalResult` with per-sample results and aggregate statistics (mean, median, min, max, standard deviation) across the dataset.
- Implement seven evaluation metrics as first-class, individually invocable functions: `faithfulness`, `answerRelevance`, `contextPrecision`, `contextRecall`, `contextRelevance`, `answerCorrectness`, and `hallucinationRate`. Each function accepts an `EvalSample` and returns a `MetricResult`.
- Support three evaluation modes: `heuristic` (deterministic, zero LLM cost, uses text-overlap and keyword heuristics), `llm` (LLM-as-judge, higher accuracy, uses a pluggable judge function), and `hybrid` (routes each metric to the mode best suited for it, defaulting to heuristic for simple metrics and LLM for semantic metrics).
- Provide a pluggable `JudgeFn` interface: `(prompt: string) => Promise<string>`. Users supply their own LLM call using any provider. Built-in adapters for OpenAI and Anthropic are provided as optional imports.
- Provide threshold-based pass/fail determination per metric and composite, with configurable thresholds. Produce a non-zero exit code from the CLI when any metric fails its threshold.
- Provide a CLI (`rag-eval`) that reads evaluation datasets from JSON or JSONL files, runs evaluation, and outputs reports as human-readable text or JSON. The CLI exits with code 0 if all thresholds pass, code 1 if any metric fails, code 2 for configuration errors.
- Track cost: count LLM calls made and estimated tokens consumed per evaluation run. Report cost in `EvalResult` and `BatchEvalResult`.
- Support regression detection: accept a baseline `BatchEvalResult` JSON file and flag metrics where the new scores are significantly worse than the baseline (configurable regression threshold).
- Produce a JUnit XML report for integration with test runners and CI systems that consume JUnit format (GitHub Actions, Jenkins, CircleCI).
- Provide `createEvaluator(config)` factory for creating a reusable, pre-configured evaluator instance that avoids repeating configuration on every call.
- Ship complete TypeScript type definitions. Zero runtime type assertions. All public types are exported.
- Keep runtime dependencies minimal. Core heuristic evaluation uses only built-in Node.js APIs. LLM adapter imports (`openai`, `@anthropic-ai/sdk`) are peer dependencies, only required if those adapters are used.

### Non-Goals

- **Not a complete RAGAS Python port.** This package implements the same metric definitions and scoring philosophies as RAGAS, but does not guarantee identical scores on the same inputs. RAGAS uses specific LLM prompts, NLI models, and sentence transformers that produce specific numbers. This package produces directionally equivalent scores using different algorithms (heuristics in heuristic mode, LLM-as-judge with different prompts in LLM mode). The goal is comparable evaluation quality, not numerical parity.
- **Not an embedding-based evaluator.** This package does not compute text embeddings or cosine similarity using embedding models. Semantic similarity in heuristic mode uses n-gram overlap and TF-IDF, not dense vectors. Users who need embedding-based similarity can use `embed-cache` and pass embeddings to a custom metric.
- **Not a retrieval evaluator.** This package evaluates the quality of retrieved context relative to questions and answers, but does not perform retrieval itself. It does not call vector stores, run BM25 search, or manage document corpora. It operates post-retrieval on already-fetched context chunks.
- **Not a complete LLM evaluation framework.** This package evaluates RAG-specific quality dimensions. It does not cover general LLM evaluation dimensions like instruction following, code quality, reasoning quality, or safety. Use `output-grade` for general LLM output quality and `ai-output-assert` for test-suite assertions.
- **Not a benchmark runner.** This package runs evaluation on user-provided datasets. It does not ship evaluation datasets, benchmarks (like BEIR, MS-MARCO, or TriviaQA), or tooling for dataset construction. For dataset construction and few-shot example generation, use `eval-dataset` and `fewshot-gen` from this monorepo.
- **Not a continuous monitoring daemon.** This package performs point-in-time batch evaluation. For real-time per-request monitoring in production, run `evaluate(sample)` per request and pipe results to your telemetry system. This package does not manage scheduling, sampling rates, or telemetry sinks.
- **Not a judge model.** This package is a client of LLM APIs; it does not host or serve any model. The judge function is provided by the user.

---

## 3. Target Users and Use Cases

### RAG Pipeline Developers Building CI Quality Gates

Teams who have built a RAG pipeline (document ingestion, chunking, embedding, retrieval, response generation) and need automated quality checks that run on every pull request. Without a quality gate, prompt changes, chunking parameter changes, retrieval threshold changes, or embedding model upgrades can silently degrade RAG quality. `rag-eval-node-ts` runs as a CI step: load an evaluation dataset, run heuristic evaluation (zero cost, deterministic, fast), check that all metric scores exceed configured thresholds, fail the build if they do not. No LLM API keys required in CI.

### Platform Engineers Running Release-Gate Evaluation

Teams who need a higher-confidence quality check before major releases -- new model versions, new retrieval configurations, production prompt changes. They use LLM mode or hybrid mode with a small evaluation dataset (50-200 samples) to get accurate faithfulness and relevance scores. If any metric shows a statistically significant regression from the baseline, the release is blocked. The baseline is a `BatchEvalResult` JSON file committed to the repository and updated with each approved release.

### RAG Researchers and Engineers A/B Testing Pipeline Configurations

Teams comparing two pipeline variants: does re-ranking improve context precision? Does a different chunking strategy improve context recall? Does prompt template A produce more faithful answers than template B? They run `evaluateBatch` on the same evaluation dataset against both pipeline variants and compare the resulting `BatchEvalResult` objects. `rag-eval-node-ts` provides the consistent measurement methodology that makes these comparisons meaningful.

### Developers Building Evaluation Infrastructure

Engineers building evaluation tooling on top of -- using `rag-eval-node-ts` as the metric computation layer while adding their own dataset management, result storage, visualization, and alerting layers. The `createEvaluator` factory and typed output format make this integration straightforward. The JUnit XML output enables integration with existing test reporting infrastructure.

### Individual Developers Debugging RAG Quality Issues

A developer notices that their RAG chatbot is hallucinating. They construct a small set of `EvalSample` objects from recent conversations where the issue occurred, run `evaluate` with LLM mode enabled, and inspect the `faithfulness` and `hallucinationRate` metric results to understand whether the issue is the LLM generating claims not in the context, or the retrieval returning irrelevant context. The per-metric explanations and signal lists pinpoint the issue.

### Teams Integrating with the npm-master Ecosystem

Developers using `rag-cite` for citation verification, `hallucinate-check` for production hallucination detection, `rag-prompt-builder` for prompt composition, or `chunk-smart` for document chunking. `rag-eval-node-ts` is the evaluation layer that measures how well the full stack performs. It can consume `rag-cite`'s `CitationReport` as input to the faithfulness metric (the citation grounding score maps to faithfulness), and its per-metric thresholds can gate `llm-retry`'s retry logic (re-query if faithfulness is below 0.7).

---

## 4. Core Concepts

### Evaluation Sample

An evaluation sample (`EvalSample`) is the atomic unit of RAG evaluation. It represents one question-and-answer exchange in the RAG pipeline and contains all the information needed to compute every supported metric:

- `question` (required): The user's question or query that was passed to the RAG pipeline.
- `answer` (required): The answer generated by the LLM using the retrieved contexts.
- `contexts` (required): The list of retrieved context chunks that were provided to the LLM. Each context is a string. The order of contexts matters for context precision: earlier entries are assumed to be ranked higher (more relevant) by the retrieval system.
- `groundTruth` (optional): The reference answer, used by `contextPrecision`, `contextRecall`, and `answerCorrectness`. If not provided, metrics that require a ground truth answer return `null` scores.
- `id` (optional): A unique identifier for this sample, used in reports and regression tracking.
- `metadata` (optional): Arbitrary key-value pairs for grouping, filtering, or annotating samples in batch results.

### Metric

A metric is a named, scored quality dimension of RAG system behavior. Each metric produces a score in the range [0, 1] where higher is better, except `hallucinationRate` where lower is better (though it is normalized to [0, 1] as well, with 1.0 meaning zero hallucinations). Each metric has a well-defined definition, algorithm (separate for heuristic and LLM modes), applicable inputs, and interpretation guide.

### Evaluation Mode

The evaluation mode controls which algorithm is used to compute metrics. The three modes are:

- `heuristic`: All metrics are computed using deterministic text-analysis algorithms -- n-gram overlap, keyword matching, TF-IDF similarity, sentence coverage. No LLM calls. Fast (sub-100ms per sample), reproducible, zero cost. Suitable for CI/CD pipelines and high-volume batch evaluation.
- `llm`: All metrics that support LLM-as-judge are computed using LLM calls via a user-provided judge function. The LLM is given structured prompts that ask it to perform specific evaluation tasks (extract claims, verify attribution, judge relevance). More accurate for semantic evaluation tasks, but slower and has per-call cost.
- `hybrid`: Each metric is assigned to the mode best suited for it. Metrics that have strong heuristic algorithms (context precision, context recall in simple cases) use heuristic mode. Metrics that depend heavily on semantic understanding (faithfulness, answer relevance) use LLM mode. Per-metric mode can be overridden in configuration.

### Judge Function

The judge function is the integration point between `rag-eval-node-ts` and any LLM provider. It is a simple async function with the signature `(prompt: string) => Promise<string>`. When LLM mode is active, `rag-eval-node-ts` calls this function with structured evaluation prompts and parses the response. The user is responsible for authentication, rate limiting, retries, and choosing the model. Built-in adapters (`createOpenAIJudge`, `createAnthropicJudge`) construct the judge function from provider credentials and model configuration.

### Metric Result

A `MetricResult` is the output of computing one metric on one sample. It contains:

- `metricId`: The metric identifier (e.g., `'faithfulness'`).
- `score`: The 0-1 score, or `null` if the metric could not be computed (missing required inputs, LLM call failed).
- `mode`: Which mode was used (`'heuristic'` or `'llm'`).
- `passed`: Whether the score meets the configured threshold.
- `explanation`: A human-readable explanation of how the score was computed, identifying what contributed positively or negatively.
- `signals`: A list of specific findings (claim-level, sentence-level, or context-level) that support the score.
- `llmCalls`: Number of LLM calls made for this metric (0 in heuristic mode).
- `durationMs`: Time taken to compute this metric.

### Evaluation Result

An `EvalResult` is the output of `evaluate(sample)`. It contains the `EvalSample`, a `MetricResult` for each computed metric, a composite `score` (weighted average of metric scores), a `passed` flag (all metrics above threshold), cost tracking (total LLM calls and estimated tokens), and total duration.

### Batch Evaluation Result

A `BatchEvalResult` is the output of `evaluateBatch(samples)`. It contains an `EvalResult` for each sample plus aggregate statistics per metric: mean, median, min, max, standard deviation, and the pass rate (fraction of samples where the metric passed its threshold). It also contains a dataset-level `passed` flag (all per-metric aggregate scores above threshold) and total cost.

### Regression Detection

Regression detection compares a new `BatchEvalResult` against a baseline `BatchEvalResult`. For each metric, it computes the change in mean score (delta). If any metric's mean score drops by more than the configured regression threshold (default: 0.05, i.e., a 5-point drop in the 0-1 scale), the result is flagged as a regression for that metric. The regression report identifies which metrics regressed, by how much, and which samples contributed most to the regression.

### Evaluation Report

An evaluation report is the human-readable or machine-readable output of an evaluation run. It exists in three formats:
- **Console output**: Colored text with per-metric scores, pass/fail icons, and a summary table.
- **JSON**: The full `BatchEvalResult` serialized to JSON, suitable for storage and downstream processing.
- **JUnit XML**: A standard XML report where each metric is a test case and failed thresholds are test failures, consumable by CI systems.

---

## 5. Metrics Catalog

### 5.1 Faithfulness

**Metric ID**: `faithfulness`

**What it measures**: Whether the answer contains only claims that are supported by the provided contexts. A faithful answer does not introduce information that cannot be found in the contexts -- it does not fabricate facts, does not use parametric knowledge that contradicts the context, and does not make claims that go beyond what the sources say. Faithfulness measures the absence of hallucination relative to the retrieved context. This is distinct from factual accuracy: a faithful answer might be factually incorrect if the retrieved context contains incorrect information, but it is still faithful because it accurately reflects those sources.

**Score range**: 0.0 to 1.0. 1.0 means every claim in the answer is supported by the context. 0.0 means no claims are supported.

**Required inputs**: `question`, `answer`, `contexts`.

**Heuristic algorithm**:

1. Segment the answer into sentences using rule-based sentence boundary detection (handling abbreviations, decimal numbers, URLs, list items).
2. Filter non-factual sentences: questions, meta-commentary, greetings, hedging-only sentences, and transition phrases are excluded from claim verification (they cannot be "unsupported" because they make no factual assertion).
3. For each factual sentence (candidate claim), compute its best match score against the full context corpus:
   a. Concatenate all context chunks into a single context document (preserving chunk boundaries).
   b. Compute n-gram overlap (Jaccard similarity on word unigrams, bigrams, and trigrams) between the sentence and each context chunk.
   c. Compute TF-IDF cosine similarity between the sentence and each context chunk.
   d. Take the maximum score across all context chunks for each similarity measure.
   e. Compute a composite support score: `0.4 * ngram_similarity + 0.6 * tfidf_similarity`. Claims with composite support score above the support threshold (default: 0.25) are considered supported.
4. `faithfulness = supported_claims / total_factual_claims`. If zero factual claims are found, return 1.0 (trivially faithful).

**LLM algorithm**:

1. Segment the answer into sentences (same as heuristic).
2. Filter non-factual sentences (same as heuristic).
3. Construct a claim extraction prompt asking the LLM to list all factual claims in the answer as a numbered JSON array of strings.
4. For each extracted claim, construct a claim verification prompt providing the claim and the full context, asking the LLM to output `{ "supported": true/false, "reason": "..." }`.
5. `faithfulness = count_supported / count_total_claims`. Parse JSON from each LLM response; handle malformed responses by attempting lenient JSON extraction (look for `true`/`false` in the response text when JSON parsing fails).
6. Aggregate explanations from per-claim `reason` fields into the `MetricResult.explanation`.

**When to use heuristic mode**: CI/CD pipelines, high-volume batch evaluation, pre-screening large datasets before expensive LLM evaluation, systems without LLM API access.

**When to use LLM mode**: Release gate evaluation, building labeled evaluation datasets, debugging specific faithfulness failures, any case where the accuracy difference matters (typical heuristic Pearson r with LLM mode: ~0.65-0.75; heuristic is a reasonable proxy, not a perfect substitute).

**Score interpretation**:
- 0.9-1.0: Highly faithful. Nearly every claim in the answer is grounded in the context.
- 0.7-0.89: Mostly faithful. A few claims lack clear context support; likely minor hallucinations or use of implicit background knowledge.
- 0.5-0.69: Partially faithful. Multiple claims lack context support. The answer mixes grounded claims with ungrounded content.
- 0.3-0.49: Low faithfulness. More than half the claims are unsupported. The LLM is using substantial parametric knowledge or fabricating.
- 0.0-0.29: Very low faithfulness. The answer is largely ungrounded in the provided context.

**Default threshold**: 0.7.

**Hybrid mode assignment**: LLM (faithfulness is semantically complex; heuristic mode underestimates faithful paraphrases and over-penalizes reworded content).

---

### 5.2 Answer Relevance

**Metric ID**: `answerRelevance`

**What it measures**: Whether the answer addresses the question that was asked. A relevant answer directly responds to the question -- it does not go off-topic, does not answer a different question, and does not produce a generic response that could apply to many different questions. Answer relevance is independent of faithfulness: an answer can be highly faithful (grounded in context) but irrelevant (answering a different question than what was asked), or irrelevant but unfaithful (off-topic and also hallucinating).

**Score range**: 0.0 to 1.0. 1.0 means the answer directly and completely addresses the question. 0.0 means the answer is entirely unrelated to the question.

**Required inputs**: `question`, `answer`.

**Heuristic algorithm**:

1. Tokenize the question and answer into word sets (lowercase, remove punctuation, remove stopwords).
2. Extract question keywords: content words in the question (nouns, verbs, adjectives) after stopword removal.
3. Compute keyword coverage: fraction of question keywords that appear in the answer text (exact or stemmed match).
4. Compute inverse generic penalty: detect generic answer patterns that suggest the model gave a non-answer (`"I'm sorry, I cannot..."`, `"I don't have information about..."`, `"Based on the provided context, I cannot determine..."` when the context does contain relevant information). Each generic pattern detected reduces the score by 0.15.
5. Compute question-type alignment: extract the question type (who, what, when, where, why, how, yes/no) and check whether the answer structure aligns. A "when" question should contain a date or time reference; a "who" question should contain a named entity or person descriptor; a "yes/no" question should contain an affirmative or negative response. Misalignment deducts 0.15.
6. `answerRelevance = (keyword_coverage * 0.6 + (1 - generic_penalty) * 0.2 + question_type_alignment * 0.2)`, clamped to [0, 1].

**LLM algorithm**:

1. Construct a question-generation prompt providing the answer (without the original question) and asking the LLM to generate 3-5 questions that the answer would be a good response to. Request output as a JSON array of question strings.
2. For each generated question, compute the semantic similarity to the original question using n-gram Jaccard similarity (no embedding model required -- the questions are short enough that n-gram overlap is a reasonable proxy for semantic similarity at this stage).
3. `answerRelevance = mean(similarities between generated questions and original question)`. High similarity means the generated questions are close to the original, meaning the answer is directly addressing the original question.
4. If LLM call fails, fall back to heuristic algorithm.

**Score interpretation**:
- 0.9-1.0: Highly relevant. The answer directly and specifically addresses the question.
- 0.7-0.89: Mostly relevant. The answer addresses the question but may include some tangential content.
- 0.5-0.69: Partially relevant. The answer touches on the topic but does not clearly address what was asked.
- 0.3-0.49: Weakly relevant. The answer is loosely related to the question's topic but does not address it.
- 0.0-0.29: Not relevant. The answer does not address the question.

**Default threshold**: 0.7.

**Hybrid mode assignment**: LLM (the question-generation reverse approach is significantly more accurate than keyword overlap for capturing semantic relevance; keyword overlap misses paraphrase and rewording).

---

### 5.3 Context Precision

**Metric ID**: `contextPrecision`

**What it measures**: Whether the retrieved context chunks that are relevant to the question are ranked higher than irrelevant chunks. In a retrieval system, lower-indexed contexts (earlier in the list) are assumed to be ranked more relevant by the retriever. Context precision measures whether this ranking is accurate -- are the useful chunks appearing early, or are they buried behind noise? High context precision means the retriever is doing a good job; low context precision means the retriever is returning relevant chunks but ranking them poorly.

Context precision is a ranking metric. It uses the ground truth answer (or the generated answer if no ground truth is provided) to determine which context chunks are relevant, then evaluates whether those relevant chunks appear in higher-ranked positions.

**Score range**: 0.0 to 1.0. 1.0 means all relevant chunks are ranked above all irrelevant chunks.

**Required inputs**: `question`, `answer` or `groundTruth`, `contexts`.

**Algorithm** (same in both heuristic and LLM modes for relevance determination; the difference is in how chunk relevance is classified):

The scoring formula is the average precision at k (AP@K), a standard IR metric:

```
AP@K = (1/R) * sum_{k=1}^{K} [Precision@k * relevance(k)]
```

Where:
- `K` is the total number of context chunks.
- `R` is the total number of relevant chunks.
- `Precision@k` is the fraction of the top-k chunks that are relevant: `relevant_in_top_k / k`.
- `relevance(k)` is 1 if chunk k is relevant, 0 otherwise.

This formula rewards retrievers that place relevant chunks early. A retriever that ranks all 3 relevant chunks as positions 1, 2, 3 scores 1.0. A retriever that places them at positions 4, 5, 6 (with 3 irrelevant chunks above) scores much lower.

**Heuristic relevance determination**: For each context chunk, compute its relevance score using TF-IDF cosine similarity against the reference text (ground truth if available, else generated answer). Chunks with relevance score above 0.2 are classified as relevant. This threshold is intentionally low because context chunks that contributed to a good answer should have some non-trivial overlap with that answer.

**LLM relevance determination**: For each context chunk, construct a relevance judgment prompt providing the question, the context chunk, and the reference answer, asking `{ "relevant": true/false, "reason": "..." }`. Use the LLM's binary judgment to classify each chunk.

**When ground truth is unavailable**: Use the generated answer as the reference. This is an approximation: if the answer is faithful, chunks that support the answer are truly relevant. If the answer is unfaithful, this measurement may be off. Document this limitation in the result metadata.

**Score interpretation**:
- 0.9-1.0: Excellent ranking. Relevant chunks are consistently in the top positions.
- 0.7-0.89: Good ranking. Relevant chunks are mostly well-ranked with some noise.
- 0.5-0.69: Moderate ranking. Relevant chunks are mixed throughout the list.
- 0.3-0.49: Poor ranking. Relevant chunks are not consistently ranked higher than irrelevant ones.
- 0.0-0.29: Inverted ranking. Relevant chunks tend to appear below irrelevant ones.

**Default threshold**: 0.7.

**Hybrid mode assignment**: Heuristic (context precision's ranking calculation is a deterministic formula once relevance is determined; heuristic relevance determination using TF-IDF is reasonably accurate and avoids per-chunk LLM calls which would be expensive for large context sets).

---

### 5.4 Context Recall

**Metric ID**: `contextRecall`

**What it measures**: Whether the retrieved context covers all the information needed to answer the question according to the ground truth answer. A high context recall means the retrieved chunks contain the information that the ground truth answer draws on. Low context recall means important information is missing from the retrieved context -- either because the retrieval system failed to find relevant documents, or because the relevant documents were not chunked at the right granularity.

Context recall requires a ground truth answer. Without it, this metric cannot be computed and returns `null`.

**Score range**: 0.0 to 1.0. 1.0 means every claim in the ground truth answer is attributable to at least one context chunk. 0.0 means no claims in the ground truth answer are supported by the context.

**Required inputs**: `question`, `contexts`, `groundTruth`.

**Heuristic algorithm**:

1. Segment the ground truth answer into sentences (factual claims only, same filtering as faithfulness).
2. For each ground truth sentence, compute its maximum support score across all context chunks using n-gram overlap and TF-IDF cosine similarity (same composite as faithfulness heuristic).
3. A ground truth sentence is "covered" if its maximum composite support score exceeds the coverage threshold (default: 0.25).
4. `contextRecall = covered_sentences / total_ground_truth_sentences`.

**LLM algorithm**:

1. Segment the ground truth answer into sentences (same as heuristic).
2. For each ground truth sentence, construct an attribution prompt providing the sentence and all context chunks, asking: `{ "attributed": true/false, "source_chunk_indices": [0, 2], "reason": "..." }`.
3. A sentence is attributed if the LLM returns `attributed: true`.
4. `contextRecall = attributed_sentences / total_sentences`.

**Score interpretation**:
- 0.9-1.0: Excellent retrieval coverage. The context contains nearly all information needed to construct the ground truth answer.
- 0.7-0.89: Good coverage. Minor information gaps but the core facts are present.
- 0.5-0.69: Partial coverage. The retrieval system is missing a meaningful fraction of relevant information.
- 0.3-0.49: Poor coverage. More than half the ground truth information is absent from the context.
- 0.0-0.29: Very poor coverage. The retrieval system is largely failing to find relevant content.

**Default threshold**: 0.7.

**Hybrid mode assignment**: Heuristic (ground truth sentence coverage against context is a well-defined overlap problem; heuristic mode performs well when ground truth and context share vocabulary, which they typically do for factual QA).

---

### 5.5 Context Relevance

**Metric ID**: `contextRelevance`

**What it measures**: Whether the retrieved context chunks are relevant to the question, independent of the answer. While context precision measures the ranking of relevant vs. irrelevant chunks, context relevance measures what fraction of the context is relevant at all. A high context relevance means the retriever is returning on-topic chunks. Low context relevance means the retriever is returning a lot of noise -- chunks that are in the same document collection but do not address the question.

**Score range**: 0.0 to 1.0. 1.0 means every context chunk is relevant to the question. 0.0 means no context chunks are relevant.

**Required inputs**: `question`, `contexts`.

**Heuristic algorithm**:

1. Tokenize the question (lowercase, remove stopwords, remove punctuation). Extract question keywords.
2. For each context chunk, compute keyword coverage: fraction of question keywords present in the chunk (exact or stemmed match).
3. Compute TF-IDF cosine similarity between the question and each chunk, using IDF computed across all provided chunks.
4. Chunk relevance score: `0.5 * keyword_coverage + 0.5 * tfidf_similarity`.
5. A chunk is relevant if its relevance score exceeds the relevance threshold (default: 0.15 -- intentionally low to avoid false negatives when the question uses different vocabulary than the context).
6. `contextRelevance = relevant_chunks / total_chunks`.

**LLM algorithm**:

1. For each context chunk, construct a relevance judgment prompt: given the question and the context chunk, output `{ "relevant": true/false, "relevance_score": 0-1, "reason": "..." }`.
2. `contextRelevance = mean(relevance_score across all chunks)`, or alternatively `relevant_chunks / total_chunks` using the binary `relevant` field.

**Score interpretation**:
- 0.9-1.0: Highly relevant context. The retriever is returning precisely targeted chunks.
- 0.7-0.89: Mostly relevant. A small fraction of chunks are off-topic noise.
- 0.5-0.69: Mixed relevance. A substantial portion of the context is not directly related to the question.
- 0.3-0.49: Low relevance. Most context chunks are tangentially related at best.
- 0.0-0.29: Irrelevant context. The retriever is largely returning unrelated content.

**Default threshold**: 0.6.

**Hybrid mode assignment**: Heuristic (question-context keyword overlap and TF-IDF similarity are effective for relevance judgment; LLM mode can be used when query vocabulary diverges significantly from document vocabulary, such as when questions use natural language and documents use domain jargon).

---

### 5.6 Answer Correctness

**Metric ID**: `answerCorrectness`

**What it measures**: How factually accurate the generated answer is relative to the ground truth answer. Unlike faithfulness (which measures grounding in context) or answer relevance (which measures whether the answer addresses the question), answer correctness measures the factual overlap with the known-correct reference answer. It is an extrinsic metric -- it requires knowing what the right answer is.

Answer correctness requires a ground truth answer. Without it, this metric cannot be computed and returns `null`.

**Score range**: 0.0 to 1.0. 1.0 means the generated answer contains all the information in the ground truth and no incorrect information.

**Required inputs**: `question`, `answer`, `groundTruth`.

**Heuristic algorithm**:

1. Compute F1 score on word unigrams (token-level F1) between the generated answer and ground truth:
   - Tokenize both texts (lowercase, remove stopwords, remove punctuation).
   - `precision = |intersection| / |generated_tokens|`
   - `recall = |intersection| / |ground_truth_tokens|`
   - `f1 = 2 * (precision * recall) / (precision + recall)` (0 if denominator is zero)
2. Compute ROUGE-L (longest common subsequence) as a secondary score:
   - LCS length between generated and ground truth word sequences.
   - `rougeL_precision = lcs_length / generated_length`
   - `rougeL_recall = lcs_length / ground_truth_length`
   - `rougeL_f1 = 2 * (rougeL_precision * rougeL_recall) / (rougeL_precision + rougeL_recall)`
3. `answerCorrectness = 0.6 * f1 + 0.4 * rougeL_f1`.

**LLM algorithm**:

1. Extract claims from the generated answer (same claim extraction prompt as faithfulness LLM mode).
2. Extract claims from the ground truth answer using the same prompt.
3. For each generated claim, check if it is supported by any ground truth claim (micro-verification): construct a verification prompt asking whether the generated claim is entailed by the ground truth. Output: `{ "correct": true/false, "reason": "..." }`.
4. For each ground truth claim, check if it appears in the generated answer (coverage).
5. Compute:
   - `answer_precision = correct_generated_claims / total_generated_claims`
   - `answer_recall = covered_ground_truth_claims / total_ground_truth_claims`
   - `answerCorrectness = F1(answer_precision, answer_recall)`

**Score interpretation**:
- 0.9-1.0: Highly accurate. The generated answer contains the same information as the ground truth.
- 0.7-0.89: Mostly accurate. Minor omissions or phrasing differences from the ground truth.
- 0.5-0.69: Partially accurate. The answer contains some correct information but misses significant facts or includes some incorrect content.
- 0.3-0.49: Low accuracy. The answer substantially diverges from the ground truth.
- 0.0-0.29: Very low accuracy. The answer is largely incorrect or unrelated to the ground truth.

**Default threshold**: 0.6.

**Hybrid mode assignment**: Heuristic (token-level F1 and ROUGE-L are well-established reference-based metrics that perform reasonably well for factual QA; LLM mode is more accurate for answers with paraphrasing or different numerical formats).

---

### 5.7 Hallucination Rate

**Metric ID**: `hallucinationRate`

**What it measures**: The fraction of claims in the answer that are not supported by any of the provided contexts. This is the complement of faithfulness: `hallucinationRate = 1 - faithfulness` when computed using the same algorithm. However, `hallucinationRate` has different semantics in reporting: a lower score is better (less hallucination), and the threshold check is inverted (fail if above threshold rather than below). The metric is included separately because it is often more intuitive to report and threshold on "fraction of answer that is hallucinated" rather than "fraction that is faithful."

The score in `MetricResult.score` is normalized so that 1.0 means zero hallucinations (consistent with the "higher is better" convention), but the `explanation` and signals are expressed in terms of hallucinated claims and their fraction.

**Score range**: 0.0 to 1.0. 1.0 means zero hallucinated claims (no hallucination). 0.0 means all claims are hallucinated.

**Required inputs**: `question`, `answer`, `contexts`.

**Algorithm**: Shares the claim extraction and context attribution logic with faithfulness. The raw hallucination rate is `unsupported_claims / total_claims`, and the normalized score is `1 - raw_hallucination_rate`.

In LLM mode, an additional signal is generated for each hallucinated claim: the claim text, the reason it was deemed unsupported, and which context chunks were checked. This provides actionable debugging information.

**Score interpretation** (in terms of normalized score, higher = better):
- 0.9-1.0: Very low hallucination. 0-10% of claims lack context support.
- 0.7-0.89: Low hallucination. 10-30% of claims lack context support. Some parametric knowledge mixed in.
- 0.5-0.69: Moderate hallucination. 30-50% of claims are unsupported. The system is significantly mixing in information not from context.
- 0.3-0.49: High hallucination. 50-70% of claims are unsupported.
- 0.0-0.29: Very high hallucination. More than 70% of claims are not grounded in the provided context.

**Default threshold**: 0.7 (meaning at most 30% hallucination rate is acceptable before the metric fails).

**Hybrid mode assignment**: LLM (same as faithfulness -- semantic claim verification benefits significantly from LLM judgment; heuristic mode is provided as a fast proxy).

---

## 6. Evaluation Modes

### 6.1 Heuristic Mode

**Mode identifier**: `'heuristic'`

In heuristic mode, all seven metrics are computed using deterministic text-analysis algorithms with no LLM calls. The algorithms use n-gram overlap (Jaccard similarity at unigram, bigram, and trigram levels), TF-IDF cosine similarity, token-level F1, ROUGE-L, keyword extraction, and sentence boundary detection. All algorithms are implemented from scratch using built-in JavaScript/Node.js APIs with no external dependencies.

**Characteristics**:
- Zero cost: no API calls, no tokens consumed.
- Fast: typically 5-30ms per `EvalSample` depending on context length and answer length.
- Deterministic: the same input always produces the same scores.
- No configuration required beyond thresholds: no API keys, no model selection.
- Lower accuracy than LLM mode for semantically complex metrics (faithfulness, answer relevance). Typical Pearson correlation with LLM-mode scores: 0.65-0.78. Suitable as a first-pass signal or proxy, not as a ground truth.

**Best used for**:
- CI/CD pipelines where LLM evaluation would be too slow or too expensive.
- Pre-screening large datasets to identify low-quality samples before targeted LLM evaluation.
- Environments without LLM API access (air-gapped systems, local development without API keys).
- Regression detection where relative score changes matter more than absolute accuracy.

### 6.2 LLM Mode

**Mode identifier**: `'llm'`

In LLM mode, metrics that benefit from semantic understanding (faithfulness, answerRelevance, hallucinationRate by default) are computed using the pluggable judge function. Metrics that are structurally well-defined (contextPrecision, contextRecall, contextRelevance, answerCorrectness) can also be run in LLM mode for maximum accuracy.

**Characteristics**:
- Higher accuracy for semantic metrics: LLM-based claim extraction and verification captures paraphrases, implicit support, and semantic entailment that heuristics miss.
- Cost: each `EvalSample` in full LLM mode typically makes 3-15 LLM calls depending on the number of claims and context chunks. Cost is tracked and reported.
- Non-deterministic: LLM responses may vary across calls.
- Slower: LLM call latency (typically 200ms-2s per call) dominates evaluation time.
- Requires a judge function: users must provide `judge: (prompt: string) => Promise<string>`.

**LLM call structure**: Each LLM call is a structured prompt with a specific task (claim extraction, claim verification, relevance judgment) and an expected JSON output format. Prompts are designed to elicit consistent, parseable JSON. Response parsing includes lenient fallback: if JSON parsing fails, the package attempts to extract the relevant decision (`true`/`false`, a number) from free-form text.

**Best used for**:
- Release gate evaluation before major deployments.
- Building labeled evaluation datasets where accuracy matters.
- Debugging specific quality issues where per-claim LLM explanations are needed.
- A/B testing where the goal is to detect real quality differences, not just proxy signals.

### 6.3 Hybrid Mode

**Mode identifier**: `'hybrid'`

Hybrid mode assigns each metric to the most cost-effective mode that provides adequate accuracy for that metric. The default assignments:

| Metric | Default Mode | Rationale |
|---|---|---|
| `faithfulness` | `llm` | Semantic claim verification benefits strongly from LLM judgment. |
| `answerRelevance` | `llm` | The question-generation approach is substantially more accurate than keyword overlap. |
| `contextPrecision` | `heuristic` | AP@K is a deterministic formula; TF-IDF relevance classification is accurate enough. |
| `contextRecall` | `heuristic` | Ground truth sentence coverage against context is well-handled by n-gram overlap. |
| `contextRelevance` | `heuristic` | Question-context keyword overlap and TF-IDF are effective for relevance. |
| `answerCorrectness` | `heuristic` | Token-level F1 and ROUGE-L are established reference-based metrics. |
| `hallucinationRate` | `llm` | Shares computation with faithfulness in LLM mode; marginal additional cost. |

These defaults can be overridden per-metric in configuration:

```typescript
const evaluator = createEvaluator({
  mode: 'hybrid',
  metricModes: {
    contextPrecision: 'llm',      // override: use LLM for this metric
    answerCorrectness: 'heuristic', // default is already heuristic, explicit override
  },
});
```

In hybrid mode, LLM calls for faithfulness and hallucinationRate share the claim extraction step: claims are extracted once and used for both metrics. This deduplication reduces LLM call count when both metrics are requested together (the default).

### 6.4 Per-Metric Mode Override

Mode can be set globally on the evaluator and overridden per-metric. The resolution order:

1. Per-call option `metricModes` (highest priority).
2. Evaluator-level `metricModes` from `createEvaluator(config)`.
3. Global `mode` setting on the evaluator.
4. Default mode (`'heuristic'`).

---

## 7. LLM Judge Interface

### 7.1 Judge Function Contract

The judge function is the sole integration point between `rag-eval-node-ts` and any LLM provider:

```typescript
type JudgeFn = (prompt: string) => Promise<string>;
```

The function receives a complete, self-contained prompt string and must return the LLM's response as a plain string. `rag-eval-node-ts` handles all prompt construction and response parsing internally. The caller is responsible for:
- Authentication (API keys, OAuth).
- Rate limiting and retry (wrap in `llm-retry` from this monorepo for production use).
- Model selection (the judge function encapsulates the model choice).
- Logging and cost tracking at the provider level (the package tracks call counts but not provider-level details).

### 7.2 Built-In Adapters

Two built-in adapter factories are provided as optional imports. They are not in the package's dependencies -- the respective SDKs are peer dependencies, installed only if the adapters are used.

**OpenAI Adapter**:

```typescript
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';
import OpenAI from 'openai';

const judge = createOpenAIJudge({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  model: 'gpt-4o-mini',           // default
  temperature: 0,                  // default: deterministic responses
  maxTokens: 500,                  // default: sufficient for structured JSON responses
  systemPrompt: '...',             // optional: override the default system prompt
});
```

**Anthropic Adapter**:

```typescript
import { createAnthropicJudge } from 'rag-eval-node-ts/adapters/anthropic';
import Anthropic from '@anthropic-ai/sdk';

const judge = createAnthropicJudge({
  client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  model: 'claude-3-5-haiku-20241022',  // default: cost-effective for evaluation
  temperature: 0,
  maxTokens: 500,
});
```

**Custom judge function** (any provider):

```typescript
const judge: JudgeFn = async (prompt: string) => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
  });
  const data = await response.json();
  return data.response;
};
```

### 7.3 Prompt Templates

Each metric in LLM mode uses structured prompts designed to elicit consistent JSON responses. All prompts follow the same pattern: a brief task description, the input data, and an explicit JSON output schema with examples. The prompts instruct the LLM to output only JSON, with no explanation outside the JSON structure.

**Claim extraction prompt template** (used by faithfulness and hallucinationRate):

```
You are an evaluation assistant. Extract all factual claims from the following answer text.
A factual claim is a sentence or clause that makes a specific, verifiable assertion about the world.
Exclude questions, hedging statements, meta-commentary, and greetings.

Answer:
{{answer}}

Output a JSON array of claim strings. Each claim should be a self-contained factual assertion.
Example: ["Paris is the capital of France.", "The population is 2.1 million.", "The city was founded in 250 BC."]

Output only valid JSON, no other text.
```

**Claim verification prompt template** (used by faithfulness and hallucinationRate):

```
You are an evaluation assistant. Determine whether the following claim is supported by the provided context.
A claim is supported if the context contains information that entails or directly supports the claim.
A claim is NOT supported if it goes beyond what the context says, contradicts the context, or introduces information not present in the context.

Claim:
{{claim}}

Context:
{{context}}

Output JSON: {"supported": true/false, "reason": "brief explanation"}
Output only valid JSON, no other text.
```

**Relevance judgment prompt template** (used by contextRelevance and contextPrecision in LLM mode):

```
You are an evaluation assistant. Determine whether the following context chunk is relevant to answering the question.
A context chunk is relevant if it contains information that could help answer the question.

Question: {{question}}

Context chunk:
{{chunk}}

Output JSON: {"relevant": true/false, "relevance_score": 0.0-1.0, "reason": "brief explanation"}
Output only valid JSON, no other text.
```

**Question generation prompt template** (used by answerRelevance):

```
You are an evaluation assistant. Given the following answer, generate 3-5 questions that this answer would be a good response to.
The questions should be specific and reflect the actual content of the answer.

Answer:
{{answer}}

Output a JSON array of question strings.
Example: ["What is the capital of France?", "Where is Paris located?"]
Output only valid JSON, no other text.
```

### 7.4 Response Parsing and Error Handling

LLM responses are parsed with multiple fallback strategies:

1. **Primary**: `JSON.parse(response.trim())`. Handles standard JSON responses.
2. **Fence stripping**: If the response starts with `` ```json `` or `` ``` ``, strip the fences and retry JSON parse.
3. **Extraction**: If full JSON parse fails, attempt to extract the relevant field using regex:
   - For boolean fields: scan for `"supported":\s*(true|false)` or `"relevant":\s*(true|false)`.
   - For numeric fields: scan for `"relevance_score":\s*(\d+\.?\d*)` or `"score":\s*(\d+\.?\d*)`.
   - For array fields: attempt to find `[` ... `]` boundaries and parse the substring.
4. **Fallback**: If all parsing fails, log a warning, increment the `parseFailureCount` in the result, and treat the metric as `null` for this sample. The evaluation continues; it does not throw.

### 7.5 Cost Tracking

Every LLM call increments the cost counters in the evaluation result:

```typescript
interface CostTracker {
  llmCalls: number;           // total number of judge function calls
  estimatedInputTokens: number;  // estimated from prompt length (4 chars ≈ 1 token)
  estimatedOutputTokens: number; // estimated from response length
  parseFailures: number;      // calls where JSON parsing failed on all strategies
}
```

The token estimates are rough approximations for budget awareness, not billing-accurate token counts. For accurate token counts, use the provider SDK's token counting utilities in a custom judge wrapper.

---

## 8. API Surface

### 8.1 Installation

```bash
npm install rag-eval-node-ts
```

For LLM mode with OpenAI:
```bash
npm install rag-eval-node-ts openai
```

For LLM mode with Anthropic:
```bash
npm install rag-eval-node-ts @anthropic-ai/sdk
```

### 8.2 Core Functions

#### `evaluate`

```typescript
import { evaluate } from 'rag-eval-node-ts';

const result = await evaluate(sample, metrics?, options?);
```

Evaluates a single `EvalSample`. Returns an `EvalResult`.

Parameters:
- `sample: EvalSample` -- the question/answer/context tuple to evaluate.
- `metrics?: MetricId[]` -- which metrics to compute. Default: all applicable metrics (metrics requiring `groundTruth` are skipped if `groundTruth` is not provided).
- `options?: EvaluateOptions` -- mode, judge, thresholds, per-metric overrides.

#### `evaluateBatch`

```typescript
import { evaluateBatch } from 'rag-eval-node-ts';

const result = await evaluateBatch(samples, metrics?, options?);
```

Evaluates an array of `EvalSample` objects. Returns a `BatchEvalResult` with per-sample results and aggregate statistics. Samples are processed with configurable concurrency (default: 4 concurrent evaluations, configurable via `options.concurrency`).

Parameters:
- `samples: EvalSample[]` -- the dataset to evaluate.
- `metrics?: MetricId[]` -- which metrics to compute.
- `options?: BatchEvaluateOptions` -- extends `EvaluateOptions` with `concurrency`, `onProgress`, and `baselineResult` for regression detection.

#### Individual Metric Functions

Each metric is available as a standalone function:

```typescript
import {
  faithfulness,
  answerRelevance,
  contextPrecision,
  contextRecall,
  contextRelevance,
  answerCorrectness,
  hallucinationRate,
} from 'rag-eval-node-ts';

const result = await faithfulness(sample, options?);
// returns MetricResult
```

Each function accepts an `EvalSample` and optional `MetricOptions` (mode, judge, threshold).

#### `createEvaluator`

```typescript
import { createEvaluator } from 'rag-eval-node-ts';

const evaluator = createEvaluator({
  mode: 'hybrid',
  judge: myJudgeFn,
  thresholds: {
    faithfulness: 0.8,
    answerRelevance: 0.7,
    contextPrecision: 0.7,
    contextRecall: 0.6,
    contextRelevance: 0.6,
    answerCorrectness: 0.6,
    hallucinationRate: 0.75,
  },
  metrics: ['faithfulness', 'answerRelevance', 'contextPrecision'],
  compositeThreshold: 0.7,
  metricModes: {
    contextPrecision: 'llm',
  },
});

const result = await evaluator.evaluate(sample);
const batchResult = await evaluator.evaluateBatch(samples);
```

Returns an `Evaluator` instance with `.evaluate()` and `.evaluateBatch()` methods. The instance is immutable -- create a new one to change configuration.

### 8.3 Type Definitions

```typescript
// ── Input Types ──────────────────────────────────────────────────────

/** The atomic unit of RAG evaluation. All metrics operate on this structure. */
interface EvalSample {
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

type MetricId =
  | 'faithfulness'
  | 'answerRelevance'
  | 'contextPrecision'
  | 'contextRecall'
  | 'contextRelevance'
  | 'answerCorrectness'
  | 'hallucinationRate';

type EvaluationMode = 'heuristic' | 'llm' | 'hybrid';

/** A specific finding detected during metric computation. */
interface EvalSignal {
  /** Machine-readable identifier for this signal type. */
  id: string;

  /** Which metric produced this signal. */
  metricId: MetricId;

  /** 'info' | 'warning' | 'critical' */
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
interface MetricResult {
  metricId: MetricId;

  /**
   * The 0-1 score. null if the metric could not be computed
   * (missing required inputs, all LLM calls failed).
   */
  score: number | null;

  /** The mode used to compute this metric. */
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
interface CostTracker {
  llmCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  parseFailures: number;
}

/** The result of evaluating a single EvalSample. */
interface EvalResult {
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
interface MetricAggregate {
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
interface MetricRegression {
  metricId: MetricId;
  baselineMean: number;
  currentMean: number;
  delta: number;       // currentMean - baselineMean (negative = regression)
  regressed: boolean;  // true if delta < -regressionThreshold
}

/** The result of evaluating a batch of EvalSamples. */
interface BatchEvalResult {
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

type JudgeFn = (prompt: string) => Promise<string>;

interface MetricThresholds {
  faithfulness?: number;          // default: 0.7
  answerRelevance?: number;       // default: 0.7
  contextPrecision?: number;      // default: 0.7
  contextRecall?: number;         // default: 0.7
  contextRelevance?: number;      // default: 0.6
  answerCorrectness?: number;     // default: 0.6
  hallucinationRate?: number;     // default: 0.7
}

interface EvaluateOptions {
  mode?: EvaluationMode;          // default: 'heuristic'
  judge?: JudgeFn;                // required when mode is 'llm' or 'hybrid'
  thresholds?: MetricThresholds;
  metricModes?: Partial<Record<MetricId, 'heuristic' | 'llm'>>;
  compositeThreshold?: number;    // default: 0.7
  compositeWeights?: Partial<Record<MetricId, number>>; // default: equal weights
}

interface BatchEvaluateOptions extends EvaluateOptions {
  concurrency?: number;           // default: 4
  onProgress?: (completed: number, total: number) => void;
  baselineResult?: BatchEvalResult;
  regressionThreshold?: number;   // default: 0.05 (5-point drop triggers regression flag)
}

interface EvaluatorConfig extends EvaluateOptions {
  metrics?: MetricId[];           // which metrics to compute by default
}

/** A pre-configured evaluator instance. */
interface Evaluator {
  evaluate(sample: EvalSample, metrics?: MetricId[], options?: EvaluateOptions): Promise<EvalResult>;
  evaluateBatch(samples: EvalSample[], metrics?: MetricId[], options?: BatchEvaluateOptions): Promise<BatchEvalResult>;
}
```

---

## 9. Evaluation Report

### 9.1 Report Contents

Every `EvalResult` and `BatchEvalResult` contains the full evaluation data needed for reporting, debugging, and downstream processing:

**Per-sample data** (`EvalResult`):
- The original `EvalSample` (question, answer, contexts, ground truth if provided).
- A `MetricResult` for each computed metric containing: score (0-1 or null), mode used, passed flag, threshold, explanation, and signals list.
- Composite score and composite pass/fail.
- Cost tracking (LLM calls, estimated tokens).
- Duration and timestamp.

**Batch aggregate data** (additions in `BatchEvalResult`):
- Per-metric aggregates: mean, median, min, max, standard deviation, pass rate, null rate.
- Composite aggregates: same statistics for the composite score.
- Dataset-level pass/fail.
- Regression report (when baseline is provided): per-metric delta, regression flag, samples contributing most to regression.

### 9.2 Console Output Format

The CLI and `formatReport` utility produce a formatted console output:

```
RAG Evaluation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dataset: ./eval-dataset.jsonl  (42 samples)
Mode: hybrid  |  Judge: gpt-4o-mini

Metric                  Mean     Median   Min    Max    Pass Rate
────────────────────────────────────────────────────────────────────
Faithfulness            0.82     0.85     0.41   1.00   90.5%  PASS
Answer Relevance        0.76     0.78     0.52   0.98   83.3%  PASS
Context Precision       0.71     0.74     0.33   1.00   78.6%  PASS
Context Recall          0.68     0.70     0.21   0.99   71.4%  PASS
Context Relevance       0.74     0.76     0.45   1.00   88.1%  PASS
Answer Correctness      0.63     0.65     0.18   0.92   64.3%  PASS
Hallucination Rate      0.84     0.88     0.50   1.00   90.5%  PASS
────────────────────────────────────────────────────────────────────
Composite               0.74     0.76     0.42   0.97   76.2%  PASS

LLM Calls: 189  |  Est. Tokens: ~47,250  |  Duration: 34.2s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: PASS
```

Failed thresholds are highlighted in red. If `--verbose` is passed, the report includes per-sample scores as a table below the summary.

### 9.3 JSON Output

The JSON output is the serialized `BatchEvalResult` or `EvalResult`. When written to a file (`--output results.json`), this file can be committed as a baseline for regression detection in future runs.

### 9.4 JUnit XML Output

The JUnit XML output represents each metric as a test case and each sample as a test suite. Failed thresholds appear as test failures, enabling GitHub Actions, Jenkins, and CircleCI to display inline test failure annotations.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="rag-eval" tests="7" failures="0" time="34.2">
  <testsuite name="faithfulness" tests="42" failures="4" time="12.1">
    <testcase name="sample-001" classname="faithfulness" time="0.28">
      <!-- pass: no child elements -->
    </testcase>
    <testcase name="sample-007" classname="faithfulness" time="0.31">
      <failure message="faithfulness score 0.41 below threshold 0.7">
        Score: 0.41. 3/7 claims unsupported by context. Unsupported: "The company was founded in 1998."
      </failure>
    </testcase>
    ...
  </testsuite>
  ...
</testsuites>
```

---

## 10. CI/CD Integration

### 10.1 Basic CI Step

The most common CI integration runs heuristic evaluation on every PR:

```yaml
# .github/workflows/rag-eval.yml
- name: Evaluate RAG quality
  run: npx rag-eval --dataset ./eval/dataset.jsonl --mode heuristic --threshold 0.7
  env:
    # No API keys needed in heuristic mode
```

Exit codes:
- `0`: All metrics passed all thresholds.
- `1`: One or more metrics failed their thresholds.
- `2`: Configuration error (invalid dataset format, missing required option).

### 10.2 Release Gate with LLM Mode

For pre-release evaluation with LLM-as-judge:

```yaml
- name: Release gate evaluation
  run: |
    npx rag-eval \
      --dataset ./eval/golden-set.jsonl \
      --mode hybrid \
      --output ./eval/results-${{ github.sha }}.json \
      --baseline ./eval/baseline.json \
      --regression-threshold 0.05 \
      --junit ./eval/junit-report.xml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 10.3 GitHub Actions Annotations

When `--junit` output is combined with the `mikepenz/action-junit-report` action, failed metrics appear as PR check annotations pointing to the specific test cases (sample IDs):

```yaml
- uses: mikepenz/action-junit-report@v4
  with:
    report_paths: './eval/junit-report.xml'
    check_name: 'RAG Evaluation'
```

### 10.4 Regression Detection

Regression detection compares the current batch result against a baseline JSON file:

```bash
npx rag-eval \
  --dataset ./eval/dataset.jsonl \
  --baseline ./eval/baseline.json \
  --regression-threshold 0.05
```

The command outputs which metrics regressed (dropped more than 5 points) and exits with code 1 if any regression is detected:

```
REGRESSION DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metric              Baseline   Current   Delta
Context Recall      0.74       0.68      -0.06  REGRESSION (threshold: -0.05)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1 metric(s) regressed. Exit code: 1
```

### 10.5 Updating the Baseline

When a change intentionally improves or acceptably adjusts scores, update the baseline:

```bash
npx rag-eval --dataset ./eval/dataset.jsonl --output ./eval/baseline.json
git add ./eval/baseline.json
git commit -m "eval: update baseline after retrieval improvement"
```

The baseline file is a `BatchEvalResult` JSON. It is committed to the repository alongside the evaluation dataset, versioned with the codebase, and reviewed as part of PRs.

### 10.6 Cost-Aware CI

For cost management in CI, use heuristic mode for per-PR evaluation and LLM mode only for scheduled runs or release branches:

```yaml
- name: RAG eval (heuristic, every PR)
  run: npx rag-eval --dataset ./eval/dataset.jsonl --mode heuristic

- name: RAG eval (LLM, release only)
  if: github.ref == 'refs/heads/release'
  run: npx rag-eval --dataset ./eval/dataset.jsonl --mode hybrid --baseline ./eval/baseline.json
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## 11. Configuration

### 11.1 Configuration Object

All configuration is passed as a plain JavaScript object to `createEvaluator` or as `options` to individual functions. There is no global configuration state, no environment variable magic (except in CLI), no singleton. Configuration is explicit and local.

```typescript
const config: EvaluatorConfig = {
  // Evaluation mode: 'heuristic' | 'llm' | 'hybrid'
  // Default: 'heuristic'
  mode: 'hybrid',

  // The judge function. Required when mode is 'llm' or 'hybrid'.
  judge: myJudgeFn,

  // Which metrics to compute. Default: all applicable given inputs.
  metrics: ['faithfulness', 'answerRelevance', 'contextPrecision'],

  // Per-metric pass/fail thresholds.
  thresholds: {
    faithfulness: 0.8,          // default: 0.7
    answerRelevance: 0.7,       // default: 0.7
    contextPrecision: 0.75,     // default: 0.7
    contextRecall: 0.7,         // default: 0.7
    contextRelevance: 0.65,     // default: 0.6
    answerCorrectness: 0.65,    // default: 0.6
    hallucinationRate: 0.8,     // default: 0.7
  },

  // Composite score threshold. Default: 0.7
  compositeThreshold: 0.75,

  // Custom weights for composite score. Default: equal weights.
  compositeWeights: {
    faithfulness: 2.0,         // double weight for faithfulness
    answerRelevance: 1.5,
    contextPrecision: 1.0,
    contextRecall: 1.0,
    contextRelevance: 1.0,
    answerCorrectness: 1.0,
    hallucinationRate: 1.5,
  },

  // Per-metric mode overrides (for hybrid mode or when mode is unset per metric).
  metricModes: {
    contextPrecision: 'llm',   // override default heuristic for this metric
  },
};
```

### 11.2 Heuristic Algorithm Tuning

Heuristic algorithms expose tuning parameters under `heuristicOptions`:

```typescript
const config: EvaluatorConfig = {
  mode: 'heuristic',
  heuristicOptions: {
    // Minimum composite similarity score for a claim to be "supported" (faithfulness, hallucinationRate)
    claimSupportThreshold: 0.25,  // default: 0.25

    // Minimum relevance score for a context chunk to be "relevant" (contextRelevance)
    chunkRelevanceThreshold: 0.15,  // default: 0.15

    // Minimum score for a ground truth sentence to be "covered" (contextRecall)
    sentenceCoverageThreshold: 0.25,  // default: 0.25

    // Weights for composite similarity (n-gram + TF-IDF)
    ngramWeight: 0.4,   // default: 0.4
    tfidfWeight: 0.6,   // default: 0.6

    // N-gram sizes to use (1 = unigram, 2 = bigram, 3 = trigram)
    ngramSizes: [1, 2, 3],  // default: [1, 2, 3]

    // N-gram weights (must correspond to ngramSizes)
    ngramWeights: [0.2, 0.3, 0.5],  // default: [0.2, 0.3, 0.5]
  },
};
```

### 11.3 LLM Prompt Customization

Prompt templates can be overridden per-metric for domain customization:

```typescript
const config: EvaluatorConfig = {
  mode: 'llm',
  judge: myJudgeFn,
  prompts: {
    faithfulness: {
      claimExtraction: 'Custom claim extraction prompt for {{answer}}...',
      claimVerification: 'Custom verification prompt for claim: {{claim}}\nContext: {{context}}...',
    },
    answerRelevance: {
      questionGeneration: 'Custom question generation prompt for {{answer}}...',
    },
  },
};
```

Template variables are `{{question}}`, `{{answer}}`, `{{context}}`, `{{claim}}`, `{{groundTruth}}`. Any variable in the template that is not available for the current sample is replaced with `[not provided]`.

---

## 12. CLI

### 12.1 Installation and Invocation

```bash
npm install -g rag-eval-node-ts
rag-eval --help
```

Or without global install:
```bash
npx rag-eval --help
```

### 12.2 Commands

**`rag-eval run`** (default command):

```bash
rag-eval run [options]
# or: rag-eval [options]  (run is the default command)
```

Options:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--dataset <path>` | string | required | Path to JSONL or JSON evaluation dataset. |
| `--mode <mode>` | string | `heuristic` | Evaluation mode: `heuristic`, `llm`, `hybrid`. |
| `--metrics <list>` | string | all | Comma-separated list of metric IDs to compute. |
| `--threshold <number>` | number | 0.7 | Global threshold for all metrics (overridden by per-metric thresholds). |
| `--thresholds <json>` | json | see defaults | JSON object of per-metric thresholds. |
| `--output <path>` | string | none | Write JSON results to file. |
| `--baseline <path>` | string | none | Baseline `BatchEvalResult` JSON for regression detection. |
| `--regression-threshold <n>` | number | 0.05 | Minimum score drop to flag as regression. |
| `--junit <path>` | string | none | Write JUnit XML report to file. |
| `--format <format>` | string | `human` | Output format: `human`, `json`. |
| `--verbose` | boolean | false | Include per-sample scores in console output. |
| `--concurrency <n>` | number | 4 | Concurrent sample evaluations. |
| `--judge <model>` | string | none | Shorthand: `openai:gpt-4o-mini` or `anthropic:claude-3-5-haiku-20241022`. Reads API key from env. |
| `--no-color` | boolean | false | Disable colored console output. |

Environment variables for LLM mode (when `--judge` shorthand is used):
- `OPENAI_API_KEY`: API key for OpenAI judge adapter.
- `ANTHROPIC_API_KEY`: API key for Anthropic judge adapter.

**`rag-eval compare`**:

```bash
rag-eval compare --before results-v1.json --after results-v2.json
```

Prints a side-by-side comparison of two `BatchEvalResult` JSON files. Highlights metric deltas, regression flags, and sample-level changes. Exits with code 1 if any metric regresses past the regression threshold.

**`rag-eval validate`**:

```bash
rag-eval validate --dataset ./eval/dataset.jsonl
```

Validates the dataset format without running evaluation. Checks that all required fields are present, contexts is a non-empty array, and the file is valid JSON/JSONL. Exits with code 0 if valid, code 2 if invalid.

### 12.3 Environment Variable Fallbacks

The CLI reads the following environment variables as fallbacks when flags are not provided:

| Variable | Corresponding Flag |
|---|---|
| `RAG_EVAL_MODE` | `--mode` |
| `RAG_EVAL_DATASET` | `--dataset` |
| `RAG_EVAL_THRESHOLD` | `--threshold` |
| `RAG_EVAL_BASELINE` | `--baseline` |
| `RAG_EVAL_CONCURRENCY` | `--concurrency` |
| `OPENAI_API_KEY` | Used by `openai:*` judge shorthand |
| `ANTHROPIC_API_KEY` | Used by `anthropic:*` judge shorthand |

---

## 13. Dataset Format

### 13.1 JSONL Format (Recommended)

Each line is a JSON object representing one `EvalSample`:

```jsonl
{"id": "q001", "question": "What is the capital of France?", "answer": "The capital of France is Paris.", "contexts": ["France is a country in Western Europe. Its capital city is Paris, which is also the largest city in the country.", "Paris has been the capital of France since the 10th century."], "groundTruth": "Paris is the capital of France."}
{"id": "q002", "question": "When was the Eiffel Tower built?", "answer": "The Eiffel Tower was built between 1887 and 1889 as the entrance arch for the 1889 World's Fair.", "contexts": ["The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris. It was constructed from 1887 to 1889 as the centerpiece of the 1889 World's Fair.", "Gustave Eiffel's company built the structure over two years."], "groundTruth": "The Eiffel Tower was constructed from 1887 to 1889."}
```

### 13.2 JSON Array Format

An alternative JSON array format is also accepted:

```json
[
  {
    "id": "q001",
    "question": "What is the capital of France?",
    "answer": "The capital of France is Paris.",
    "contexts": [
      "France is a country in Western Europe. Its capital city is Paris.",
      "Paris has been the capital of France since the 10th century."
    ],
    "groundTruth": "Paris is the capital of France."
  }
]
```

### 13.3 Required and Optional Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `question` | string | Yes | The input query. |
| `answer` | string | Yes | The RAG pipeline's generated answer. |
| `contexts` | string[] | Yes | Retrieved context chunks, ordered by retrieval rank. |
| `groundTruth` | string | No | Reference answer. Required for contextPrecision, contextRecall, answerCorrectness. |
| `id` | string | No | Unique identifier for tracking. Auto-generated from index if absent. |
| `metadata` | object | No | Arbitrary key-value pairs. |

### 13.4 Validation Rules

- `question` must be a non-empty string.
- `answer` must be a non-empty string.
- `contexts` must be a non-empty array of non-empty strings. An empty `contexts` array causes context-dependent metrics (contextPrecision, contextRecall, contextRelevance) to return `null`.
- `groundTruth`, if provided, must be a non-empty string.
- Maximum supported context length per chunk: 10,000 characters. Longer chunks are supported but will be truncated in LLM mode prompts that have token constraints (the first 2,000 characters of each chunk are used in LLM prompts; the full chunk is used in heuristic computations).

---

## 14. Integration with the npm-master Ecosystem

### rag-cite

`rag-cite` and `rag-eval-node-ts` address adjacent problems. `rag-cite` focuses on citation extraction and verification -- which claims in the response are cited, and are those citations accurate. `rag-eval-node-ts` focuses on RAG quality metrics -- faithfulness, relevance, precision, recall.

Integration pattern: run `rag-cite` first to get a `CitationReport`, then feed the grounding score and unattributed claims into `rag-eval-node-ts` as pre-computed faithfulness evidence:

```typescript
import { cite } from 'rag-cite';
import { evaluate } from 'rag-eval-node-ts';

const citationReport = cite(answer, contextChunks);

// rag-cite's grounding score maps to faithfulness
// Pass it as a pre-computed signal to avoid redundant computation
const evalResult = await evaluate(sample, ['answerRelevance', 'contextPrecision'], {
  precomputedMetrics: {
    faithfulness: citationReport.groundingScore,
  },
});
```

### output-grade

`output-grade` provides a zero-cost heuristic quality score for any LLM output, including hallucination risk signals, coherence, and format compliance. `rag-eval-node-ts` provides RAG-specific metrics that require context and ground truth. They compose naturally:

```typescript
import { grade } from 'output-grade';
import { evaluate } from 'rag-eval-node-ts';

const [gradeReport, evalResult] = await Promise.all([
  grade(answer, { prompt: question }),
  evaluate(sample, ['faithfulness', 'contextPrecision']),
]);

const overallQuality = (gradeReport.score + evalResult.compositeScore) / 2;
```

### hallucinate-check

`hallucinate-check` provides pattern-based hallucination detection (hedging phrases, fabricated URLs, implausible dates) without context. `rag-eval-node-ts`'s `hallucinationRate` metric checks context-grounded hallucination -- whether claims are supported by the retrieved context. The two are complementary: `hallucinate-check` catches structural hallucination indicators; `rag-eval-node-ts` catches context-grounding failures.

### rag-prompt-builder

`rag-prompt-builder` composes RAG prompts from a question, context chunks, and prompt templates. The `contexts` field in `rag-eval-node-ts`'s `EvalSample` should contain exactly the same chunks that `rag-prompt-builder` injected into the LLM prompt. If the chunks were modified (truncated, reformatted) by `rag-prompt-builder`, the modified versions should be used in the evaluation sample to ensure consistency.

### llm-retry

`llm-retry` retries LLM calls based on validation failures. Integrate with `rag-eval-node-ts` to trigger retries on low RAG quality:

```typescript
import { retry } from 'llm-retry';
import { evaluate } from 'rag-eval-node-ts';

const answer = await retry(
  () => llm.generate(ragPrompt),
  async (answer) => {
    const result = await evaluate({ question, answer, contexts }, ['faithfulness'], {
      mode: 'heuristic',
    });
    return result.metrics.faithfulness.score > 0.6;
  },
  { maxAttempts: 3 },
);
```

### eval-dataset

`eval-dataset` (in this monorepo) handles evaluation dataset construction, management, and versioning. It produces `EvalSample`-compatible output in the JSONL format that `rag-eval-node-ts`'s CLI consumes directly.

---

## 15. Testing Strategy

### 15.1 Test File Structure

```
src/
  __tests__/
    metrics/
      faithfulness.test.ts
      answerRelevance.test.ts
      contextPrecision.test.ts
      contextRecall.test.ts
      contextRelevance.test.ts
      answerCorrectness.test.ts
      hallucinationRate.test.ts
    evaluate.test.ts
    evaluateBatch.test.ts
    createEvaluator.test.ts
    heuristic/
      ngramOverlap.test.ts
      tfidfSimilarity.test.ts
      sentenceSegmenter.test.ts
      apAtK.test.ts
    llm/
      claimExtractor.test.ts
      claimVerifier.test.ts
      responseParser.test.ts
      prompts.test.ts
    cli/
      cli.test.ts
      datasetLoader.test.ts
      reportFormatter.test.ts
      junitExporter.test.ts
    adapters/
      openai.test.ts
      anthropic.test.ts
    regression.test.ts
    types.test.ts
```

### 15.2 Heuristic Metric Testing

Heuristic metrics are fully deterministic and are tested with curated `(sample, expected_score)` pairs:

```typescript
// faithfulness.test.ts
describe('faithfulness heuristic', () => {
  it('scores 1.0 when all claims are verbatim in context', async () => {
    const sample: EvalSample = {
      question: 'What is the capital of France?',
      answer: 'Paris is the capital of France.',
      contexts: ['Paris is the capital of France. It is the largest city.'],
    };
    const result = await faithfulness(sample, { mode: 'heuristic' });
    expect(result.score).toBeGreaterThan(0.9);
  });

  it('scores 0.0 when answer has no overlap with context', async () => {
    const sample: EvalSample = {
      question: 'What is the capital of France?',
      answer: 'The answer is completely fabricated and unrelated.',
      contexts: ['Paris is the capital of France.'],
    };
    const result = await faithfulness(sample, { mode: 'heuristic' });
    expect(result.score).toBeLessThan(0.3);
  });

  it('handles empty answer gracefully', async () => {
    const sample: EvalSample = {
      question: 'What?',
      answer: '',
      contexts: ['Some context.'],
    };
    const result = await faithfulness(sample, { mode: 'heuristic' });
    expect(result.score).toBe(1.0); // no factual claims to verify
    expect(result.passed).toBe(true);
  });

  it('filters non-factual sentences from claim extraction', async () => {
    const sample: EvalSample = {
      question: 'What is the capital?',
      answer: 'Great question! I think Paris might be the capital. Let me explain.',
      contexts: ['Paris is the capital.'],
    };
    const result = await faithfulness(sample, { mode: 'heuristic' });
    // Only "Paris might be the capital" is a factual claim (filtered hedging)
    expect(result.signals.some(s => s.id === 'hedging-filtered')).toBe(true);
  });
});
```

### 15.3 LLM Metric Testing

LLM metrics are tested with a mock judge function that returns pre-scripted responses:

```typescript
const mockJudge: JudgeFn = jest.fn(async (prompt: string) => {
  if (prompt.includes('Extract all factual claims')) {
    return JSON.stringify(['Paris is the capital of France.', 'It has 2.1 million people.']);
  }
  if (prompt.includes('supported')) {
    return JSON.stringify({ supported: true, reason: 'Context explicitly states this.' });
  }
  return '{}';
});
```

Tests verify:
- Correct prompts are constructed (check `mockJudge.mock.calls`).
- Responses are correctly parsed.
- Fallback parsing handles malformed JSON.
- Cost counters are incremented correctly.
- LLM call failures (rejected promise) degrade gracefully to `null` score.

### 15.4 Integration Tests

Integration tests run the full `evaluate` and `evaluateBatch` pipeline with realistic samples:

```typescript
const goldenSamples: EvalSample[] = [
  /* 20 curated samples with known expected score ranges */
];

describe('evaluate integration (heuristic)', () => {
  it('scores 20 golden samples within expected ranges', async () => {
    const results = await Promise.all(
      goldenSamples.map(s => evaluate(s, undefined, { mode: 'heuristic' }))
    );
    // At least 17/20 samples should pass composite threshold of 0.6
    const passCount = results.filter(r => r.passed).length;
    expect(passCount).toBeGreaterThanOrEqual(17);
  });
});
```

### 15.5 CLI Tests

CLI tests use `child_process.execFile` to invoke the compiled CLI binary with test dataset files and capture stdout, stderr, and exit codes:

```typescript
it('exits 0 with valid dataset and passing scores', async () => {
  const { stdout, exitCode } = await runCLI(['--dataset', './test/fixtures/passing-dataset.jsonl', '--mode', 'heuristic']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('PASS');
});

it('exits 1 when a metric fails threshold', async () => {
  const { exitCode } = await runCLI(['--dataset', './test/fixtures/failing-dataset.jsonl', '--threshold', '0.95']);
  expect(exitCode).toBe(1);
});
```

### 15.6 Regression Detection Tests

```typescript
it('flags regression when score drops beyond threshold', () => {
  const baseline = buildBatchResult({ faithfulness: { mean: 0.80 } });
  const current = buildBatchResult({ faithfulness: { mean: 0.73 } });
  const regressions = detectRegressions(current, baseline, 0.05);
  expect(regressions).toHaveLength(1);
  expect(regressions[0].metricId).toBe('faithfulness');
  expect(regressions[0].delta).toBeCloseTo(-0.07);
  expect(regressions[0].regressed).toBe(true);
});
```

---

## 16. Performance

### 16.1 Heuristic Mode Latency Targets

| Operation | Target | Notes |
|---|---|---|
| Single `evaluate` call (7 metrics) | < 50ms | For typical samples (answer < 500 words, 5 contexts < 500 words each) |
| `evaluateBatch` (100 samples) | < 3s | With default concurrency of 4 |
| `evaluateBatch` (1,000 samples) | < 30s | Linear scaling with sample count |

The TF-IDF IDF vector is computed once per `evaluateBatch` call (across all contexts in the batch). For `evaluate` with a single sample, IDF is computed from that sample's contexts.

### 16.2 LLM Mode Latency

LLM mode latency is dominated by the judge function's network latency and model throughput. With GPT-4o-mini at ~300ms/call and ~10 LLM calls per sample in full LLM mode:

- Single `evaluate`: 2-5 seconds (varies by network and model throughput).
- `evaluateBatch` (100 samples, concurrency 4): 1-3 minutes.

Concurrency is the primary lever for batch throughput. Increase `concurrency` up to the provider's rate limit; `llm-retry` handles rate limit errors (429) with exponential backoff.

### 16.3 LLM Call Deduplication

In hybrid mode, when both `faithfulness` and `hallucinationRate` are requested, the claim extraction LLM call is made once and the result reused for both metrics. This reduces LLM calls from ~6 (3 for faithfulness + 3 for hallucinationRate) to ~4 for a typical sample.

### 16.4 Memory

In `evaluateBatch`, results are accumulated in memory. For very large datasets (10,000+ samples), use streaming evaluation: process samples in batches of 100-500 and write results incrementally using the `onProgress` callback and a custom writer rather than accumulating the full `BatchEvalResult`.

---

## 17. Dependencies

### Runtime Dependencies

| Package | Version | Purpose | Condition |
|---|---|---|---|
| None | — | Core heuristic evaluation uses only Node.js built-ins | Always |

The heuristic evaluation engine (n-gram overlap, TF-IDF, sentence segmentation, JSON parsing, XML generation) is implemented using only built-in JavaScript and Node.js APIs. There are zero runtime dependencies for the core package.

### Peer Dependencies (Optional)

| Package | Version | Purpose | When Required |
|---|---|---|---|
| `openai` | `^4.0.0` | OpenAI judge adapter | When using `createOpenAIJudge` |
| `@anthropic-ai/sdk` | `^0.20.0` | Anthropic judge adapter | When using `createAnthropicJudge` |

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | Compilation |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

---

## 18. File Structure

```
rag-eval-node-ts/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                   # Public API exports
│   ├── types.ts                   # All TypeScript type definitions
│   ├── evaluate.ts                # evaluate() and evaluateBatch() implementations
│   ├── evaluator.ts               # createEvaluator() factory
│   ├── metrics/
│   │   ├── faithfulness.ts        # Faithfulness metric
│   │   ├── answerRelevance.ts     # Answer relevance metric
│   │   ├── contextPrecision.ts    # Context precision metric
│   │   ├── contextRecall.ts       # Context recall metric
│   │   ├── contextRelevance.ts    # Context relevance metric
│   │   ├── answerCorrectness.ts   # Answer correctness metric
│   │   └── hallucinationRate.ts   # Hallucination rate metric
│   ├── heuristic/
│   │   ├── ngramOverlap.ts        # N-gram Jaccard similarity
│   │   ├── tfidfSimilarity.ts     # TF-IDF cosine similarity
│   │   ├── rougeL.ts              # ROUGE-L LCS computation
│   │   ├── tokenF1.ts             # Token-level F1 score
│   │   ├── sentenceSegmenter.ts   # Rule-based sentence boundary detection
│   │   ├── keywordExtractor.ts    # Question/text keyword extraction
│   │   └── apAtK.ts               # Average precision at K for context precision
│   ├── llm/
│   │   ├── claimExtractor.ts      # LLM-based claim extraction
│   │   ├── claimVerifier.ts       # LLM-based claim verification
│   │   ├── relevanceJudge.ts      # LLM-based relevance judgment
│   │   ├── questionGenerator.ts   # LLM-based question generation (answer relevance)
│   │   ├── responseParser.ts      # JSON response parsing with fallbacks
│   │   └── prompts.ts             # All LLM prompt templates
│   ├── adapters/
│   │   ├── openai.ts              # createOpenAIJudge adapter
│   │   └── anthropic.ts           # createAnthropicJudge adapter
│   ├── report/
│   │   ├── formatter.ts           # Console output formatting
│   │   ├── junitExporter.ts       # JUnit XML generation
│   │   └── regressionDetector.ts  # Baseline comparison logic
│   └── cli/
│       ├── cli.ts                 # CLI entry point
│       ├── datasetLoader.ts       # JSONL/JSON dataset loading and validation
│       └── judgeShorthand.ts      # --judge openai:model shorthand resolution
├── dist/                          # Compiled output (gitignored)
└── src/__tests__/                 # Test files (mirrors src/ structure)
```

The `src/index.ts` exports:

```typescript
// Core functions
export { evaluate } from './evaluate';
export { evaluateBatch } from './evaluate';
export { createEvaluator } from './evaluator';

// Individual metric functions
export { faithfulness } from './metrics/faithfulness';
export { answerRelevance } from './metrics/answerRelevance';
export { contextPrecision } from './metrics/contextPrecision';
export { contextRecall } from './metrics/contextRecall';
export { contextRelevance } from './metrics/contextRelevance';
export { answerCorrectness } from './metrics/answerCorrectness';
export { hallucinationRate } from './metrics/hallucinationRate';

// Types
export type {
  EvalSample,
  MetricId,
  EvaluationMode,
  EvalSignal,
  MetricResult,
  EvalResult,
  BatchEvalResult,
  MetricAggregate,
  MetricRegression,
  CostTracker,
  JudgeFn,
  MetricThresholds,
  EvaluateOptions,
  BatchEvaluateOptions,
  EvaluatorConfig,
  Evaluator,
} from './types';

// Report utilities
export { formatReport } from './report/formatter';
export { exportJUnit } from './report/junitExporter';
export { detectRegressions } from './report/regressionDetector';
```

Adapter imports are subpath exports, not part of the main bundle:

```typescript
// Not exported from index.ts -- separate subpath:
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';
import { createAnthropicJudge } from 'rag-eval-node-ts/adapters/anthropic';
```

---

## 19. Implementation Roadmap

### Phase 1: Heuristic Core (v0.1.0 → v0.2.0)

Deliverables: all seven metrics in heuristic mode, `evaluate`, `evaluateBatch`, `createEvaluator`, complete TypeScript types, full test coverage for heuristic algorithms.

1. Implement `sentenceSegmenter`: rule-based sentence boundary detection with abbreviation handling, list item detection, and non-factual sentence filtering. Test on 50+ curated examples.
2. Implement `ngramOverlap`: Jaccard similarity for n-gram sets with configurable n-gram sizes and weights. Include stopword list. Test with known overlap fractions.
3. Implement `tfidfSimilarity`: TF-IDF vector construction and cosine similarity. Test with corpus of varied documents. Verify IDF weighting de-emphasizes common terms.
4. Implement `tokenF1` and `rougeL`: standard reference-based metrics. Verify against known ROUGE-L outputs.
5. Implement `apAtK`: average precision formula. Test with synthetic ranked lists.
6. Implement all seven metrics using the heuristic algorithms from Section 5, using the above primitives.
7. Implement `evaluate` and `evaluateBatch` with concurrency control.
8. Implement `createEvaluator` factory.
9. Implement `datasetLoader` with JSONL and JSON array support and field validation.
10. Write integration tests with 20+ golden samples with expected score ranges.

### Phase 2: LLM Mode and CLI (v0.2.0 → v0.3.0)

Deliverables: all seven metrics in LLM mode, OpenAI and Anthropic adapters, cost tracking, CLI, JUnit export.

1. Implement `prompts.ts` with all prompt templates from Section 7.3.
2. Implement `responseParser.ts` with the four-strategy JSON parsing fallback.
3. Implement `claimExtractor`, `claimVerifier`, `relevanceJudge`, `questionGenerator` using the judge function interface.
4. Implement LLM mode for each metric, sharing claim extraction between faithfulness and hallucinationRate.
5. Implement `createOpenAIJudge` and `createAnthropicJudge` adapters.
6. Add cost tracking to `EvalResult` and `BatchEvalResult`.
7. Implement `cli.ts` with all flags from Section 12.2.
8. Implement `formatter.ts` for console output.
9. Implement `junitExporter.ts` for JUnit XML.
10. Implement LLM mode tests with mock judge functions.
11. Implement CLI tests with fixture datasets.

### Phase 3: Regression Detection and Hybrid Mode (v0.3.0 → v1.0.0)

Deliverables: hybrid mode, regression detection, `rag-eval compare` command, baseline management.

1. Implement hybrid mode routing in `evaluate` and `evaluateBatch`.
2. Implement LLM call deduplication for faithfulness + hallucinationRate in hybrid mode.
3. Implement `regressionDetector.ts` with the comparison algorithm.
4. Implement `rag-eval compare` CLI command.
5. Write regression detection tests with synthetic baseline/current pairs.
6. Document integration patterns with `rag-cite`, `output-grade`, `hallucinate-check`, and `llm-retry`.
7. Run calibration study: compare heuristic scores vs. LLM-mode scores on 200 samples. Document typical Pearson correlation per metric. Use findings to tune heuristic thresholds and weights.
8. Performance testing: verify batch evaluation targets from Section 16.

---

## 20. Example Use Cases

### 20.1 CI/CD Quality Gate (Heuristic Mode, No API Keys)

Every PR to a RAG-powered application runs this check in GitHub Actions:

```typescript
// eval/run-ci.ts
import { evaluateBatch } from 'rag-eval-node-ts';
import { loadDataset } from 'rag-eval-node-ts/cli/datasetLoader';

const samples = await loadDataset('./eval/golden-set.jsonl');

const result = await evaluateBatch(samples, undefined, {
  mode: 'heuristic',
  thresholds: {
    faithfulness: 0.65,
    answerRelevance: 0.65,
    contextPrecision: 0.60,
  },
  metrics: ['faithfulness', 'answerRelevance', 'contextPrecision'],
});

if (!result.passed) {
  console.error('RAG quality gate failed:');
  for (const [metricId, agg] of Object.entries(result.aggregates)) {
    if (agg.mean < result.thresholds[metricId]) {
      console.error(`  ${metricId}: ${agg.mean.toFixed(3)} < ${result.thresholds[metricId]}`);
    }
  }
  process.exit(1);
}

console.log(`RAG quality gate passed. Composite: ${result.compositeAggregate.mean.toFixed(3)}`);
process.exit(0);
```

Total evaluation time: ~1s for 100 samples in heuristic mode. No API keys. Deterministic.

### 20.2 Release Gate with Regression Detection (Hybrid Mode)

Before deploying a new chunking strategy, run a higher-confidence evaluation with regression detection:

```typescript
// eval/run-release-gate.ts
import { evaluateBatch } from 'rag-eval-node-ts';
import { createAnthropicJudge } from 'rag-eval-node-ts/adapters/anthropic';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';

const baseline: BatchEvalResult = JSON.parse(
  await readFile('./eval/baseline.json', 'utf-8')
);

const judge = createAnthropicJudge({
  client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  model: 'claude-3-5-haiku-20241022',
  temperature: 0,
});

const result = await evaluateBatch(samples, undefined, {
  mode: 'hybrid',
  judge,
  baselineResult: baseline,
  regressionThreshold: 0.05,
  concurrency: 8,
});

if (result.regressions?.some(r => r.regressed)) {
  console.error('Regression detected -- blocking release');
  process.exit(1);
}

// Save new baseline if this is a release commit
await writeFile('./eval/baseline.json', JSON.stringify(result, null, 2));
process.exit(0);
```

### 20.3 A/B Comparison Between Pipeline Variants

Compare two retrieval strategies (dense vs. sparse) on the same evaluation dataset:

```typescript
import { evaluateBatch } from 'rag-eval-node-ts';

const [denseResults, sparseResults] = await Promise.all([
  evaluateBatch(denseSamples, undefined, { mode: 'heuristic' }),
  evaluateBatch(sparseSamples, undefined, { mode: 'heuristic' }),
]);

console.log('Metric comparison: Dense vs. Sparse retrieval');
for (const metricId of ['contextPrecision', 'contextRecall', 'contextRelevance', 'faithfulness']) {
  const denseScore = denseResults.aggregates[metricId]?.mean;
  const sparseScore = sparseResults.aggregates[metricId]?.mean;
  const delta = (denseScore - sparseScore).toFixed(3);
  const winner = denseScore > sparseScore ? 'Dense' : 'Sparse';
  console.log(`  ${metricId}: Dense=${denseScore.toFixed(3)} Sparse=${sparseScore.toFixed(3)} (${delta}) → ${winner}`);
}
```

### 20.4 Single-Sample Debugging with LLM Explanations

A developer notices a specific response where faithfulness seems low and wants per-claim explanations:

```typescript
import { faithfulness, hallucinationRate } from 'rag-eval-node-ts';
import { createOpenAIJudge } from 'rag-eval-node-ts/adapters/openai';
import OpenAI from 'openai';

const judge = createOpenAIJudge({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  model: 'gpt-4o',    // use the stronger model for debugging
  temperature: 0,
});

const sample: EvalSample = {
  question: 'What were the Q3 revenue figures?',
  answer: 'Revenue in Q3 was $4.2B, up 18% year-over-year. The growth was driven by cloud services.',
  contexts: [
    'Q3 2024 Results: Total revenue was $3.9B, representing 12% growth over Q3 2023.',
    'Cloud segment revenue grew 34% to $1.8B in Q3.',
  ],
};

const [faithScore, hallucinationScore] = await Promise.all([
  faithfulness(sample, { mode: 'llm', judge }),
  hallucinationRate(sample, { mode: 'llm', judge }),
]);

console.log(`Faithfulness: ${faithScore.score.toFixed(3)}`);
console.log(`Explanation: ${faithScore.explanation}`);
console.log('Unsupported claims:');
faithScore.signals
  .filter(s => s.id === 'unsupported-claim')
  .forEach(s => console.log(`  - "${s.evidence}" (${s.message})`));
```

Output:
```
Faithfulness: 0.333
Explanation: 2 of 3 claims verified. 1 unsupported: the stated revenue figure ($4.2B) differs from context ($3.9B).
Unsupported claims:
  - "Revenue in Q3 was $4.2B" (Context states $3.9B, not $4.2B)
  - "up 18% year-over-year" (Context states 12% growth, not 18%)
```

### 20.5 Programmatic Threshold Configuration per Use Case

Different parts of a product may have different quality requirements:

```typescript
import { createEvaluator } from 'rag-eval-node-ts';

// Strict evaluator for customer-facing responses
const strictEvaluator = createEvaluator({
  mode: 'hybrid',
  judge,
  thresholds: {
    faithfulness: 0.85,
    hallucinationRate: 0.85,
    answerRelevance: 0.75,
  },
  compositeThreshold: 0.80,
});

// Lenient evaluator for internal draft generation
const draftEvaluator = createEvaluator({
  mode: 'heuristic',
  thresholds: {
    faithfulness: 0.5,
    answerRelevance: 0.5,
  },
  compositeThreshold: 0.5,
});

const response = await rag.generate(question);
const sample = { question, answer: response, contexts };

const isCustomerFacing = routeToCustomer(question);
const evaluator = isCustomerFacing ? strictEvaluator : draftEvaluator;
const result = await evaluator.evaluate(sample);

if (!result.passed) {
  await rag.regenerate(question, { temperature: 0.3 });
}
```
