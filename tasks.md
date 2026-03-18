# rag-eval-node-ts — Task Breakdown

## Phase 1: Project Scaffolding & Types

- [ ] **Set up development dependencies** — Install `typescript`, `vitest`, `eslint`, `@types/node` as devDependencies. Add `openai` (^4.0.0) and `@anthropic-ai/sdk` (^0.20.0) as optional peerDependencies in package.json. | Status: not_done

- [ ] **Configure ESLint** — Add `.eslintrc` or `eslint.config` with TypeScript-aware rules matching the monorepo conventions. Ensure `npm run lint` works against `src/`. | Status: not_done

- [ ] **Add bin entry for CLI** — Add `"bin": { "rag-eval": "dist/cli/cli.js" }` to package.json. Add subpath exports for `rag-eval-node-ts/adapters/openai` and `rag-eval-node-ts/adapters/anthropic` in the `"exports"` field. | Status: not_done

- [ ] **Implement src/types.ts — Core input types** — Define `EvalSample` interface with `question`, `answer`, `contexts`, optional `groundTruth`, optional `id`, optional `metadata`. Define `MetricId` union type for all 7 metrics. Define `EvaluationMode` union type (`'heuristic' | 'llm' | 'hybrid'`). | Status: not_done

- [ ] **Implement src/types.ts — Signal and metric result types** — Define `EvalSignal` interface with `id`, `metricId`, `severity`, `message`, optional `evidence`, optional `contextChunkIndex`. Define `MetricResult` interface with `metricId`, `score` (number | null), `mode`, `passed` (boolean | null), `threshold`, `explanation`, `signals`, `llmCalls`, `durationMs`. | Status: not_done

- [ ] **Implement src/types.ts — Result types** — Define `CostTracker` interface with `llmCalls`, `estimatedInputTokens`, `estimatedOutputTokens`, `parseFailures`. Define `EvalResult` interface with `sample`, `metrics`, `compositeScore`, `passed`, `cost`, `durationMs`, `evaluatedAt`. Define `MetricAggregate` interface. Define `MetricRegression` interface. Define `BatchEvalResult` interface with `results`, `aggregates`, `compositeAggregate`, `passed`, `totalCost`, `totalDurationMs`, optional `regressions`, `evaluatedAt`. | Status: not_done

- [ ] **Implement src/types.ts — Configuration types** — Define `JudgeFn` type as `(prompt: string) => Promise<string>`. Define `MetricThresholds` interface with optional threshold for each of the 7 metrics. Define `EvaluateOptions` interface with `mode`, `judge`, `thresholds`, `metricModes`, `compositeThreshold`, `compositeWeights`. Define `BatchEvaluateOptions` extending `EvaluateOptions` with `concurrency`, `onProgress`, `baselineResult`, `regressionThreshold`. Define `EvaluatorConfig` extending `EvaluateOptions` with `metrics`. Define `HeuristicOptions` interface with `claimSupportThreshold`, `chunkRelevanceThreshold`, `sentenceCoverageThreshold`, `ngramWeight`, `tfidfWeight`, `ngramSizes`, `ngramWeights`. Define `Evaluator` interface with `evaluate` and `evaluateBatch` methods. | Status: not_done

- [ ] **Implement src/types.ts — Prompt customization types** — Define `PromptOverrides` type allowing per-metric prompt template overrides with template variables (`{{question}}`, `{{answer}}`, `{{context}}`, `{{claim}}`, `{{groundTruth}}`). Include this in `EvaluatorConfig`. | Status: not_done

- [ ] **Write src/__tests__/types.test.ts** — Write compile-time type assertion tests to ensure all public types are correctly defined, exported, and assignable. Verify that `MetricId` is a union of all 7 metric strings. Verify `EvalSample` requires `question`, `answer`, `contexts` and has optional `groundTruth`, `id`, `metadata`. | Status: not_done

---

## Phase 2: Heuristic Primitives

- [ ] **Implement src/heuristic/sentenceSegmenter.ts** — Build rule-based sentence boundary detection. Handle abbreviations (Mr., Dr., U.S., etc.), decimal numbers (3.14), URLs, list items, and ellipses. Include a `segmentSentences(text: string): string[]` function. Also implement a `filterNonFactual(sentences: string[]): { factual: string[]; filtered: string[] }` function that removes questions, meta-commentary (e.g., "Great question!"), greetings, hedging-only sentences, and transition phrases. | Status: not_done

- [ ] **Write src/__tests__/heuristic/sentenceSegmenter.test.ts** — Test sentence segmentation on 50+ curated examples: abbreviations, decimal numbers, URLs, list items, ellipses, multi-sentence paragraphs. Test non-factual filtering for questions, greetings, hedging statements, transition phrases. | Status: not_done

- [ ] **Implement src/heuristic/ngramOverlap.ts** — Implement n-gram extraction for configurable n (unigram, bigram, trigram). Implement Jaccard similarity on n-gram sets. Implement weighted composite n-gram similarity using configurable n-gram sizes `[1, 2, 3]` and weights `[0.2, 0.3, 0.5]`. Include a stopword list (common English stopwords). Tokenization: lowercase, remove punctuation, remove stopwords. | Status: not_done

- [ ] **Write src/__tests__/heuristic/ngramOverlap.test.ts** — Test n-gram extraction for unigrams, bigrams, trigrams. Test Jaccard similarity with known overlap fractions (identical texts = 1.0, disjoint = 0.0, partial overlap). Test stopword removal. Test weighted composite with different n-gram sizes. | Status: not_done

- [ ] **Implement src/heuristic/tfidfSimilarity.ts** — Implement TF-IDF vector construction from a corpus of text chunks. Compute term frequency (TF) per document. Compute inverse document frequency (IDF) across the corpus. Compute cosine similarity between two TF-IDF vectors. Export `computeTfidfSimilarity(text: string, chunks: string[]): number[]` that returns per-chunk similarity scores, and `buildIdfMap(chunks: string[]): Map<string, number>` for reuse across a batch. | Status: not_done

- [ ] **Write src/__tests__/heuristic/tfidfSimilarity.test.ts** — Test IDF weighting de-emphasizes common terms. Test cosine similarity between identical documents (1.0), orthogonal documents (0.0), and partially overlapping documents. Test with a corpus of varied documents. | Status: not_done

- [ ] **Implement src/heuristic/tokenF1.ts** — Implement token-level F1 score between two texts. Tokenize both (lowercase, remove stopwords, remove punctuation). Compute precision = |intersection| / |generated_tokens|, recall = |intersection| / |ground_truth_tokens|, F1 = 2 * (precision * recall) / (precision + recall). Handle zero denominator. | Status: not_done

- [ ] **Write src/__tests__/heuristic/tokenF1.test.ts** — Test F1 with identical texts (1.0), completely different texts (0.0), partial overlap. Test edge cases: empty strings, single-word texts, texts with only stopwords. | Status: not_done

- [ ] **Implement src/heuristic/rougeL.ts** — Implement longest common subsequence (LCS) between two word sequences. Compute ROUGE-L precision, recall, and F1. Export `computeRougeL(generated: string, reference: string): { precision: number; recall: number; f1: number }`. | Status: not_done

- [ ] **Write src/__tests__/heuristic/rougeL.test.ts** — Verify against known ROUGE-L outputs. Test identical texts, completely different texts, subsequence ordering. Edge cases: empty strings, single-word texts. | Status: not_done

- [ ] **Implement src/heuristic/keywordExtractor.ts** — Extract content words (nouns, verbs, adjectives approximation) from text after stopword removal. Implement basic stemming (suffix stripping for common English suffixes: -ing, -ed, -tion, -ly, -s, -es). Export `extractKeywords(text: string): string[]` and `computeKeywordCoverage(questionKeywords: string[], targetText: string): number`. | Status: not_done

- [ ] **Write src/__tests__/heuristic/keywordExtractor.test.ts** — Test keyword extraction removes stopwords, keeps content words. Test stemmed matching. Test keyword coverage computation with known fractions. | Status: not_done

- [ ] **Implement src/heuristic/apAtK.ts** — Implement Average Precision at K (AP@K) formula: `(1/R) * sum_{k=1}^{K} [Precision@k * relevance(k)]`. Accept a boolean array of relevance judgments (ordered by rank). Return AP@K score in [0, 1]. Handle edge cases: no relevant items (return 0), all relevant (return 1), empty list (return 0). | Status: not_done

- [ ] **Write src/__tests__/heuristic/apAtK.test.ts** — Test with synthetic ranked lists: all relevant at top (1.0), all at bottom (low score), interleaved. Test edge cases: empty list, single item, all irrelevant. | Status: not_done

---

## Phase 3: Heuristic Metrics

- [ ] **Implement src/metrics/faithfulness.ts — Heuristic mode** — Segment answer into sentences, filter non-factual sentences. For each factual sentence, compute composite support score (0.4 * ngram + 0.6 * tfidf) against each context chunk, take max across chunks. Claim is supported if composite > 0.25 (configurable). Score = supported / total factual claims. Return 1.0 if zero factual claims. Populate `explanation` and `signals` (one signal per claim with support/unsupported status). Track `durationMs`. | Status: not_done

- [ ] **Implement src/metrics/answerRelevance.ts — Heuristic mode** — Tokenize question and answer, extract question keywords. Compute keyword coverage (fraction of question keywords in answer). Detect generic answer patterns ("I'm sorry, I cannot...", "I don't have information about...") with 0.15 penalty each. Extract question type (who/what/when/where/why/how/yes-no) and check answer structure alignment (date for "when", named entity for "who", etc.) with 0.15 deduction for misalignment. Score = keyword_coverage * 0.6 + (1 - generic_penalty) * 0.2 + question_type_alignment * 0.2, clamped to [0, 1]. | Status: not_done

- [ ] **Implement src/metrics/contextPrecision.ts — Heuristic mode** — Determine relevance of each context chunk against reference text (groundTruth if available, else answer) using TF-IDF cosine similarity with threshold 0.2. Compute AP@K using the relevance binary array. Return null if groundTruth missing and answer is empty. Document limitation when using answer as proxy for ground truth. | Status: not_done

- [ ] **Implement src/metrics/contextRecall.ts — Heuristic mode** — Requires groundTruth; return null score if not provided. Segment ground truth into factual sentences. For each sentence, compute max composite support score (ngram + tfidf) across all context chunks. Sentence is covered if score > 0.25 (configurable). Score = covered / total ground truth sentences. | Status: not_done

- [ ] **Implement src/metrics/contextRelevance.ts — Heuristic mode** — Extract question keywords. For each context chunk, compute keyword coverage and TF-IDF similarity against the question (IDF computed across all provided chunks). Chunk relevance score = 0.5 * keyword_coverage + 0.5 * tfidf. Chunk is relevant if score > 0.15 (configurable). Score = relevant_chunks / total_chunks. | Status: not_done

- [ ] **Implement src/metrics/answerCorrectness.ts — Heuristic mode** — Requires groundTruth; return null score if not provided. Compute token-level F1 between answer and ground truth. Compute ROUGE-L F1 between answer and ground truth. Score = 0.6 * tokenF1 + 0.4 * rougeLF1. | Status: not_done

- [ ] **Implement src/metrics/hallucinationRate.ts — Heuristic mode** — Share claim extraction and context attribution logic with faithfulness. Raw hallucination rate = unsupported_claims / total_claims. Normalized score = 1 - raw_rate. Explanation and signals express results in terms of hallucinated claims. | Status: not_done

- [ ] **Write src/__tests__/metrics/faithfulness.test.ts** — Test score = ~1.0 when all claims are verbatim in context. Test score < 0.3 when answer has no overlap with context. Test empty answer returns 1.0 (trivially faithful). Test non-factual sentence filtering (questions, greetings, hedging). Test multiple context chunks (max across chunks). Test threshold configuration. Test signals contain per-claim evidence. | Status: not_done

- [ ] **Write src/__tests__/metrics/answerRelevance.test.ts** — Test high score when answer directly addresses question with matching keywords. Test low score for generic/non-answer responses. Test question-type alignment (when→date, who→person). Test generic penalty detection. Test clamping to [0,1]. | Status: not_done

- [ ] **Write src/__tests__/metrics/contextPrecision.test.ts** — Test AP@K with all relevant chunks ranked first (1.0). Test with relevant chunks ranked last (low score). Test with mixed ranking. Test fallback to answer when groundTruth is absent. Test with empty contexts returns null. | Status: not_done

- [ ] **Write src/__tests__/metrics/contextRecall.test.ts** — Test high score when all ground truth sentences are covered by context. Test low score when context misses ground truth information. Test null return when groundTruth is not provided. Test coverage threshold configuration. | Status: not_done

- [ ] **Write src/__tests__/metrics/contextRelevance.test.ts** — Test high score when all chunks are relevant to question. Test low score when chunks are off-topic. Test relevance threshold configuration. Test with single chunk. | Status: not_done

- [ ] **Write src/__tests__/metrics/answerCorrectness.test.ts** — Test high score when answer matches ground truth verbatim. Test partial score for partially overlapping answers. Test zero score for completely wrong answer. Test null return when groundTruth is not provided. | Status: not_done

- [ ] **Write src/__tests__/metrics/hallucinationRate.test.ts** — Test score = 1.0 (no hallucination) when all claims are in context. Test score = 0.0 when all claims are fabricated. Test complement relationship with faithfulness. Test signals contain hallucinated claim details. | Status: not_done

---

## Phase 4: Evaluate & Evaluator

- [ ] **Implement src/evaluate.ts — evaluate() function** — Accept `EvalSample`, optional `MetricId[]`, optional `EvaluateOptions`. Determine which metrics to run (default: all applicable — skip metrics needing groundTruth if not provided). Resolve per-metric mode from priority: per-call metricModes > evaluator metricModes > global mode > 'heuristic'. Run all selected metrics. Compute composite score as weighted average (default: equal weights, configurable via compositeWeights). Determine composite pass/fail against compositeThreshold. Aggregate cost tracking. Return `EvalResult` with ISO 8601 timestamp. | Status: not_done

- [ ] **Implement src/evaluate.ts — evaluateBatch() function** — Accept array of `EvalSample`, optional `MetricId[]`, optional `BatchEvaluateOptions`. Process samples with configurable concurrency (default: 4). Call `onProgress` callback after each sample completes. Compute per-metric aggregates: mean, median, min, max, stdDev, passRate, nullRate. Compute composite aggregates. Determine dataset-level pass/fail. Aggregate total cost. If `baselineResult` is provided, call regression detection. Return `BatchEvalResult`. | Status: not_done

- [ ] **Implement src/evaluate.ts — Aggregate statistics helpers** — Implement `computeMean`, `computeMedian`, `computeStdDev`, `computeMin`, `computeMax` for arrays of numbers. Handle null scores (exclude from aggregates, track nullRate). | Status: not_done

- [ ] **Implement src/evaluator.ts — createEvaluator() factory** — Accept `EvaluatorConfig`. Return an immutable `Evaluator` instance with `.evaluate()` and `.evaluateBatch()` methods. Pre-configure mode, judge, thresholds, metrics, compositeThreshold, compositeWeights, metricModes, heuristicOptions, and prompt overrides. Per-call options override evaluator-level config. Validate that judge is provided when mode is 'llm' or 'hybrid'. | Status: not_done

- [ ] **Write src/__tests__/evaluate.test.ts** — Test evaluate() with a single sample in heuristic mode returns all 7 metric results. Test metric selection: only requested metrics are computed. Test metrics requiring groundTruth return null when not provided. Test composite score is weighted average. Test pass/fail against threshold. Test cost tracking shows 0 LLM calls in heuristic mode. Test evaluatedAt is valid ISO 8601. | Status: not_done

- [ ] **Write src/__tests__/evaluateBatch.test.ts** — Test batch with multiple samples. Test aggregate statistics (mean, median, min, max, stdDev, passRate, nullRate). Test concurrency control (verify samples are processed in parallel). Test onProgress callback is called with correct counts. Test dataset-level pass/fail. Test total cost aggregation. | Status: not_done

- [ ] **Write src/__tests__/createEvaluator.test.ts** — Test factory creates evaluator with default config. Test evaluator.evaluate() uses pre-configured options. Test per-call options override evaluator config. Test evaluator is immutable (config changes after creation do not affect it). Test validation: error when mode='llm' but no judge provided. | Status: not_done

---

## Phase 5: LLM Prompt Templates & Response Parsing

- [ ] **Implement src/llm/prompts.ts** — Define all prompt template strings: claim extraction, claim verification, relevance judgment, question generation, context recall attribution, answer correctness verification. Use `{{variable}}` placeholders. Export a `buildPrompt(template: string, vars: Record<string, string>): string` function that replaces placeholders. Replace unavailable variables with `[not provided]`. Support custom prompt overrides from config. | Status: not_done

- [ ] **Write src/__tests__/llm/prompts.test.ts** — Test all prompt templates are well-formed. Test variable substitution. Test missing variable replacement with `[not provided]`. Test custom prompt overrides. | Status: not_done

- [ ] **Implement src/llm/responseParser.ts** — Implement four-strategy JSON parsing: (1) `JSON.parse(response.trim())`, (2) strip markdown code fences and retry, (3) regex extraction for boolean fields (`"supported":\s*(true|false)`), numeric fields (`"score":\s*(\d+\.?\d*)`), and array fields (find `[`...`]` boundaries), (4) fallback returns null and increments parseFailureCount. Export `parseJsonResponse<T>(response: string): T | null`, `extractBoolean(response: string, field: string): boolean | null`, `extractNumber(response: string, field: string): number | null`, `extractArray(response: string): string[] | null`. | Status: not_done

- [ ] **Write src/__tests__/llm/responseParser.test.ts** — Test clean JSON parsing. Test JSON with markdown fences (```json ... ```). Test regex extraction for booleans, numbers, arrays. Test deeply malformed responses return null. Test each strategy in isolation and combined fallback chain. | Status: not_done

---

## Phase 6: LLM Metric Implementations

- [ ] **Implement src/llm/claimExtractor.ts** — Accept answer text and JudgeFn. Construct claim extraction prompt. Call judge. Parse response as string array of claims. Track LLM call count and token estimates (4 chars ~ 1 token). Handle parse failure gracefully (return empty array, increment parseFailures). | Status: not_done

- [ ] **Write src/__tests__/llm/claimExtractor.test.ts** — Test with mock judge returning valid JSON array. Test with mock returning fenced JSON. Test with mock returning malformed response. Test cost tracking (llmCalls, estimatedInputTokens, estimatedOutputTokens). | Status: not_done

- [ ] **Implement src/llm/claimVerifier.ts** — Accept a claim, context string, and JudgeFn. Construct claim verification prompt. Call judge. Parse `{ "supported": true/false, "reason": "..." }`. Handle parse failure with lenient boolean extraction. Track costs. | Status: not_done

- [ ] **Write src/__tests__/llm/claimVerifier.test.ts** — Test with mock judge returning supported=true. Test supported=false. Test malformed JSON with lenient extraction. Test cost tracking. | Status: not_done

- [ ] **Implement src/llm/relevanceJudge.ts** — Accept question, context chunk, and JudgeFn. Construct relevance judgment prompt. Parse `{ "relevant": true/false, "relevance_score": 0-1, "reason": "..." }`. Handle parse failures. Track costs. | Status: not_done

- [ ] **Write src/__tests__/llm/relevanceJudge.test.ts** — Test relevant and irrelevant judgments. Test score extraction. Test malformed responses. | Status: not_done

- [ ] **Implement src/llm/questionGenerator.ts** — Accept answer text and JudgeFn. Construct question generation prompt. Parse response as string array. Compute n-gram Jaccard similarity between each generated question and the original question. Return mean similarity. Track costs. | Status: not_done

- [ ] **Write src/__tests__/llm/questionGenerator.test.ts** — Test with mock returning relevant questions. Test similarity computation. Test empty or malformed response handling. | Status: not_done

- [ ] **Implement src/metrics/faithfulness.ts — LLM mode** — Use claimExtractor to extract claims. For each claim, use claimVerifier to check support against concatenated contexts. Score = supported / total. Populate signals with per-claim supported/unsupported status and reason. Handle judge failures gracefully (null score if all calls fail). | Status: not_done

- [ ] **Implement src/metrics/answerRelevance.ts — LLM mode** — Use questionGenerator to generate 3-5 questions from the answer. Compute n-gram Jaccard similarity between each generated question and the original. Score = mean(similarities). Fall back to heuristic if LLM call fails. | Status: not_done

- [ ] **Implement src/metrics/contextPrecision.ts — LLM mode** — For each context chunk, use relevanceJudge to get binary relevance. Compute AP@K with LLM-determined relevance. | Status: not_done

- [ ] **Implement src/metrics/contextRecall.ts — LLM mode** — Segment ground truth into sentences. For each sentence, construct attribution prompt with all context chunks. Parse `{ "attributed": true/false, "source_chunk_indices": [...], "reason": "..." }`. Score = attributed / total. | Status: not_done

- [ ] **Implement src/metrics/contextRelevance.ts — LLM mode** — For each context chunk, use relevanceJudge. Score = mean(relevance_score) or relevant_chunks / total. | Status: not_done

- [ ] **Implement src/metrics/answerCorrectness.ts — LLM mode** — Extract claims from generated answer and ground truth. For each generated claim, verify against ground truth claims. For each ground truth claim, check coverage in generated answer. Compute answer_precision, answer_recall, F1. | Status: not_done

- [ ] **Implement src/metrics/hallucinationRate.ts — LLM mode** — Share claim extraction with faithfulness (accept pre-extracted claims when available). Generate detailed signals for each hallucinated claim: claim text, reason unsupported, checked context chunks. Normalized score = 1 - (unsupported / total). | Status: not_done

- [ ] **Implement LLM call deduplication for faithfulness + hallucinationRate** — When both metrics are requested in the same evaluate() call, extract claims once and share the result. Track this optimization in cost counters. Implement in evaluate.ts orchestration layer. | Status: not_done

- [ ] **Write LLM mode tests for all 7 metrics** — For each metric, write tests using mock judge functions that return pre-scripted responses. Verify correct prompts are constructed (check mock.calls). Verify responses are correctly parsed. Verify cost counters are incremented. Verify judge failure degrades to null score. | Status: not_done

---

## Phase 7: LLM Adapters

- [ ] **Implement src/adapters/openai.ts** — Export `createOpenAIJudge(options)` factory. Accept `{ client, model?, temperature?, maxTokens?, systemPrompt? }`. Default model: `gpt-4o-mini`, temperature: 0, maxTokens: 500. Return a `JudgeFn` that calls `client.chat.completions.create` with the user prompt. Wrap in try/catch — rethrow with descriptive error message. | Status: not_done

- [ ] **Write src/__tests__/adapters/openai.test.ts** — Test with mocked OpenAI client. Test default parameters (model, temperature, maxTokens). Test custom parameters override defaults. Test error handling when API call fails. | Status: not_done

- [ ] **Implement src/adapters/anthropic.ts** — Export `createAnthropicJudge(options)` factory. Accept `{ client, model?, temperature?, maxTokens? }`. Default model: `claude-3-5-haiku-20241022`, temperature: 0, maxTokens: 500. Return a `JudgeFn` that calls `client.messages.create`. | Status: not_done

- [ ] **Write src/__tests__/adapters/anthropic.test.ts** — Test with mocked Anthropic client. Test default parameters. Test custom parameters. Test error handling. | Status: not_done

- [ ] **Configure subpath exports in package.json** — Add `"exports"` field mapping `"./adapters/openai"` to `"./dist/adapters/openai.js"` and `"./adapters/anthropic"` to `"./dist/adapters/anthropic.js"`. Ensure main export maps to `"./dist/index.js"`. Verify adapters are not bundled in the main import. | Status: not_done

---

## Phase 8: Hybrid Mode

- [ ] **Implement hybrid mode routing in evaluate()** — Define default hybrid mode assignments: faithfulness→llm, answerRelevance→llm, contextPrecision→heuristic, contextRecall→heuristic, contextRelevance→heuristic, answerCorrectness→heuristic, hallucinationRate→llm. Apply mode resolution priority: per-call metricModes > evaluator metricModes > hybrid defaults > global mode. | Status: not_done

- [ ] **Write hybrid mode tests** — Test default routing assigns correct modes. Test per-metric override in hybrid mode. Test that hybrid mode requires judge function. Test that heuristic-assigned metrics in hybrid mode make zero LLM calls. Test cost tracking reflects only LLM-mode metrics. | Status: not_done

---

## Phase 9: Report & Regression Detection

- [ ] **Implement src/report/formatter.ts** — Export `formatReport(result: BatchEvalResult | EvalResult, options?: { verbose?: boolean; color?: boolean }): string`. For BatchEvalResult: render summary table with metric names, mean, median, min, max, pass rate, PASS/FAIL indicator. Include header with dataset info, mode, judge. Include footer with LLM calls, estimated tokens, duration. For verbose mode: include per-sample score table below summary. Color failed metrics in red when color is enabled. For single EvalResult: render per-metric scores with pass/fail. | Status: not_done

- [ ] **Write src/__tests__/cli/reportFormatter.test.ts** — Test console output format matches spec (Section 9.2). Test verbose mode includes per-sample data. Test no-color mode omits ANSI codes. Test single EvalResult formatting. Test BatchEvalResult formatting with aggregates. | Status: not_done

- [ ] **Implement src/report/junitExporter.ts** — Export `exportJUnit(result: BatchEvalResult): string`. Generate JUnit XML where each metric is a `<testsuite>`, each sample is a `<testcase>`. Failed thresholds produce `<failure>` elements with score, threshold, and explanation. Include XML declaration, proper escaping for special characters in messages. Match the XML structure from Section 9.4. | Status: not_done

- [ ] **Write src/__tests__/cli/junitExporter.test.ts** — Test valid XML output. Test passing samples have no failure elements. Test failing samples include failure message with score and threshold. Test XML special character escaping. Test structure matches JUnit schema. | Status: not_done

- [ ] **Implement src/report/regressionDetector.ts** — Export `detectRegressions(current: BatchEvalResult, baseline: BatchEvalResult, threshold?: number): MetricRegression[]`. For each metric, compute delta = currentMean - baselineMean. Flag regression if delta < -threshold (default -0.05). Return array of MetricRegression objects. | Status: not_done

- [ ] **Write src/__tests__/regression.test.ts** — Test regression detected when score drops beyond threshold. Test no regression when scores are stable. Test no regression when scores improve. Test configurable regression threshold. Test edge case: metric present in current but not baseline. | Status: not_done

---

## Phase 10: CLI

- [ ] **Implement src/cli/datasetLoader.ts** — Export `loadDataset(path: string): Promise<EvalSample[]>`. Support JSONL format (one JSON object per line). Support JSON array format. Validate each sample: `question` must be non-empty string, `answer` must be non-empty string, `contexts` must be non-empty array of non-empty strings, `groundTruth` if present must be non-empty string. Auto-generate `id` from index if absent. Throw descriptive errors for invalid format. | Status: not_done

- [ ] **Write src/__tests__/cli/datasetLoader.test.ts** — Test loading valid JSONL file. Test loading valid JSON array file. Test validation: missing question throws. Test missing answer throws. Test empty contexts throws. Test empty groundTruth string throws. Test auto-generated IDs. Test malformed JSON file throws. | Status: not_done

- [ ] **Implement src/cli/judgeShorthand.ts** — Export `resolveJudge(shorthand: string): JudgeFn`. Parse `openai:model-name` and `anthropic:model-name` shorthands. Read API keys from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). Throw descriptive error if API key is missing. Return configured judge function. | Status: not_done

- [ ] **Implement src/cli/cli.ts — Main CLI entry point** — Parse command-line arguments for `run` (default), `compare`, and `validate` commands. Implement all flags from Section 12.2: `--dataset`, `--mode`, `--metrics`, `--threshold`, `--thresholds`, `--output`, `--baseline`, `--regression-threshold`, `--junit`, `--format`, `--verbose`, `--concurrency`, `--judge`, `--no-color`. Read environment variable fallbacks (`RAG_EVAL_MODE`, `RAG_EVAL_DATASET`, `RAG_EVAL_THRESHOLD`, `RAG_EVAL_BASELINE`, `RAG_EVAL_CONCURRENCY`). Add `#!/usr/bin/env node` shebang. | Status: not_done

- [ ] **Implement CLI run command** — Load dataset via datasetLoader. Resolve judge if `--judge` flag is provided. Build EvaluateOptions from CLI flags. Call evaluateBatch(). Format output (human or JSON via `--format`). Write JSON to `--output` if specified. Write JUnit XML to `--junit` if specified. Compare against `--baseline` if specified. Exit code 0 if passed, 1 if failed, 2 for config errors. | Status: not_done

- [ ] **Implement CLI compare command** — Accept `--before` and `--after` paths to BatchEvalResult JSON files. Load both files. Run regression detection. Print side-by-side comparison table with deltas and regression flags. Exit code 0 if no regressions, 1 if regressions detected. | Status: not_done

- [ ] **Implement CLI validate command** — Accept `--dataset` path. Load and validate dataset format without running evaluation. Print validation results. Exit code 0 if valid, 2 if invalid. | Status: not_done

- [ ] **Write src/__tests__/cli/cli.test.ts** — Test using child_process.execFile to invoke compiled CLI binary. Test `run` with valid dataset and passing scores exits 0 with PASS output. Test `run` with high threshold exits 1. Test `--format json` outputs valid JSON. Test `--output` writes file. Test `--junit` writes valid XML. Test `--baseline` triggers regression detection. Test `validate` with valid dataset exits 0. Test `validate` with invalid dataset exits 2. Test `compare` with two result files. Test missing `--dataset` exits 2. Test environment variable fallbacks. | Status: not_done

---

## Phase 11: Cost Tracking

- [ ] **Implement cost tracking in LLM call wrappers** — Every LLM call (claimExtractor, claimVerifier, relevanceJudge, questionGenerator) must increment `llmCalls`, estimate `inputTokens` from prompt length (4 chars ~ 1 token), estimate `outputTokens` from response length. Track `parseFailures` count. Aggregate costs from individual metrics into EvalResult.cost and BatchEvalResult.totalCost. | Status: not_done

- [ ] **Write cost tracking tests** — Verify llmCalls count matches expected calls per metric. Verify token estimates are reasonable (within 20% of 4-chars-per-token rule). Verify parseFailures are tracked on malformed responses. Verify aggregation in evaluateBatch totalCost. | Status: not_done

---

## Phase 12: Pre-computed Metrics Integration

- [ ] **Implement precomputedMetrics option** — Add `precomputedMetrics?: Partial<Record<MetricId, number>>` to `EvaluateOptions`. When a metric has a pre-computed score, skip computation and use the provided score directly. Create a MetricResult with mode='heuristic', 0 llmCalls, and explanation noting pre-computed source. This enables integration with rag-cite's grounding score. | Status: not_done

- [ ] **Write precomputedMetrics tests** — Test that pre-computed metric score is used without running the metric algorithm. Test that non-pre-computed metrics still run normally. Test that pre-computed score is subject to threshold checking. | Status: not_done

---

## Phase 13: Integration Tests

- [ ] **Create test fixtures** — Create 20+ curated golden EvalSample objects with known expected score ranges for heuristic mode. Include samples covering: high faithfulness, low faithfulness, generic answers, precise context ranking, poor context recall, exact answer correctness, partial correctness. Include samples with and without groundTruth. Store as JSON fixtures. | Status: not_done

- [ ] **Write integration test — evaluate() heuristic mode** — Run evaluate() on all golden samples in heuristic mode. Verify scores fall within expected ranges. Verify at least 85% of samples pass composite threshold of 0.6. Verify no unexpected null scores. Verify deterministic: running twice produces identical results. | Status: not_done

- [ ] **Write integration test — evaluateBatch() heuristic mode** — Run evaluateBatch() on golden samples. Verify aggregate statistics are reasonable. Verify passRate matches expected distribution. Verify concurrency works (complete in reasonable time). Verify onProgress callback is called for each sample. | Status: not_done

- [ ] **Write integration test — createEvaluator end-to-end** — Create evaluator with custom config. Run evaluate and evaluateBatch through evaluator. Verify pre-configured options are applied. Verify per-call overrides work. | Status: not_done

- [ ] **Write integration test — LLM mode with mock judge** — Run full evaluate pipeline in LLM mode with a comprehensive mock judge that handles all prompt types. Verify end-to-end flow: claim extraction, verification, scoring. Verify cost tracking is accurate across the pipeline. | Status: not_done

---

## Phase 14: Performance

- [ ] **Write performance benchmarks** — Benchmark single evaluate() call with 7 metrics in heuristic mode. Target: < 50ms for typical samples (answer < 500 words, 5 contexts < 500 words each). Benchmark evaluateBatch() for 100 samples. Target: < 3s. Benchmark evaluateBatch() for 1,000 samples. Target: < 30s. Verify linear scaling. | Status: not_done

- [ ] **Optimize TF-IDF IDF computation** — In evaluateBatch(), compute the IDF map once across all contexts in the batch and pass it to individual metric computations. Avoid recomputing IDF per sample. | Status: not_done

---

## Phase 15: Heuristic Options Configurability

- [ ] **Wire heuristicOptions through the full stack** — Ensure `heuristicOptions` from `EvaluatorConfig` and `EvaluateOptions` flows into each metric's heuristic algorithm. Support: `claimSupportThreshold` (faithfulness, hallucinationRate), `chunkRelevanceThreshold` (contextRelevance), `sentenceCoverageThreshold` (contextRecall), `ngramWeight`/`tfidfWeight`, `ngramSizes`/`ngramWeights`. | Status: not_done

- [ ] **Write heuristicOptions tests** — Test that changing `claimSupportThreshold` affects faithfulness score. Test `chunkRelevanceThreshold` affects contextRelevance. Test `ngramWeight`/`tfidfWeight` changes composite similarity. Test custom `ngramSizes` and `ngramWeights`. | Status: not_done

---

## Phase 16: LLM Prompt Customization

- [ ] **Wire prompt overrides through the full stack** — Ensure `prompts` field from `EvaluatorConfig` flows into LLM metric implementations. Support per-metric prompt template overrides for: faithfulness (claimExtraction, claimVerification), answerRelevance (questionGeneration), contextRelevance/contextPrecision (relevanceJudgment), contextRecall (attribution), answerCorrectness (verification). | Status: not_done

- [ ] **Write prompt override tests** — Test that custom prompt templates are used when provided. Test that default templates are used when no override is given. Test template variable substitution in custom prompts. | Status: not_done

---

## Phase 17: src/index.ts Exports

- [ ] **Implement src/index.ts — Public API exports** — Export all core functions: `evaluate`, `evaluateBatch`, `createEvaluator`. Export all 7 individual metric functions. Export all public types (EvalSample, MetricId, EvaluationMode, EvalSignal, MetricResult, EvalResult, BatchEvalResult, MetricAggregate, MetricRegression, CostTracker, JudgeFn, MetricThresholds, EvaluateOptions, BatchEvaluateOptions, EvaluatorConfig, Evaluator). Export report utilities: `formatReport`, `exportJUnit`, `detectRegressions`. Do NOT export adapters from main index (they use subpath exports). | Status: not_done

---

## Phase 18: Edge Cases & Error Handling

- [ ] **Handle empty answer** — Across all metrics, define behavior when `answer` is empty string. Faithfulness and hallucinationRate: return 1.0 (no claims to verify). AnswerRelevance: return 0.0 (no answer to judge). AnswerCorrectness: return 0.0 (no match). | Status: not_done

- [ ] **Handle empty contexts array** — Context-dependent metrics (contextPrecision, contextRecall, contextRelevance, faithfulness, hallucinationRate) should handle empty contexts gracefully. Faithfulness with no contexts: return 0.0 (no supporting evidence). ContextPrecision/Recall/Relevance: return null. | Status: not_done

- [ ] **Handle missing groundTruth** — Metrics requiring groundTruth (contextPrecision partial, contextRecall, answerCorrectness): return null score, passed=null, explanation noting missing ground truth. Other metrics should compute normally without groundTruth. | Status: not_done

- [ ] **Handle LLM judge function rejection** — When judge function throws or rejects, catch the error. Log a warning. Set metric score to null. Set appropriate explanation. Do not throw from evaluate(). Continue with remaining metrics. | Status: not_done

- [ ] **Handle very long texts** — In LLM mode, truncate context chunks to first 2,000 characters in prompts (full chunks used in heuristic). Document this behavior. Handle answers and questions that exceed reasonable length. | Status: not_done

- [ ] **Validate EvalSample at entry points** — In evaluate(), evaluateBatch(), and individual metric functions, validate that `question` is non-empty string, `answer` is non-empty string, `contexts` is a non-empty array of non-empty strings. Throw descriptive TypeError for invalid inputs. | Status: not_done

- [ ] **Write edge case tests** — Test all empty string scenarios. Test null/undefined inputs are caught with TypeError. Test very long texts (10,000+ char contexts). Test contexts with single chunk. Test all metrics with minimal valid input. Test judge rejection handling. | Status: not_done

---

## Phase 19: Documentation

- [ ] **Create README.md** — Write comprehensive README covering: package description, installation (with peer deps for LLM mode), quick start example for heuristic mode, quick start for LLM mode, API reference for evaluate/evaluateBatch/createEvaluator, individual metric function usage, CLI usage with all flags, dataset format (JSONL and JSON), configuration reference, threshold configuration, heuristic options, prompt customization, adapter setup (OpenAI and Anthropic), CI/CD integration examples (GitHub Actions), regression detection usage, JUnit output, score interpretation guide for all 7 metrics. | Status: not_done

- [ ] **Add JSDoc comments to all public exports** — Add JSDoc comments to every exported function, interface, and type in types.ts, index.ts, and all metric files. Include `@param`, `@returns`, `@example` tags. | Status: not_done

---

## Phase 20: Build, Lint, Test & Publish Prep

- [ ] **Verify npm run build succeeds** — Run `tsc` and ensure zero compilation errors. Verify dist/ output contains all expected files including adapters subdirectory. | Status: not_done

- [ ] **Verify npm run lint passes** — Run eslint against src/ with zero errors and zero warnings. | Status: not_done

- [ ] **Verify npm run test passes** — Run full vitest suite. All tests must pass. Verify coverage is adequate across all metrics, modes, and edge cases. | Status: not_done

- [ ] **Bump version in package.json** — Bump version from 0.1.0 to appropriate version based on completed phase (0.2.0 for Phase 1-4, 0.3.0 for Phase 5-10, 1.0.0 for all phases complete). | Status: not_done

- [ ] **Verify package.json metadata** — Ensure `description`, `keywords`, `author`, `repository`, `homepage`, `bugs` fields are properly filled. Add relevant keywords: `rag`, `evaluation`, `metrics`, `faithfulness`, `hallucination`, `context-precision`, `llm`, `ragas`, `ci-cd`. | Status: not_done
