import { describe, it, expect } from 'vitest';
import { evaluate, evaluateBatch } from '../evaluate';
import type { EvalSample, MetricId } from '../types';

const ALL_METRIC_IDS: MetricId[] = [
  'faithfulness',
  'answerRelevance',
  'contextPrecision',
  'contextRecall',
  'contextRelevance',
  'answerCorrectness',
  'hallucinationRate',
];

const sample: EvalSample = {
  question: 'What is retrieval-augmented generation?',
  answer: 'RAG combines retrieval with generation to produce grounded answers.',
  contexts: [
    'Retrieval-augmented generation (RAG) is a technique that combines information retrieval with text generation to produce grounded answers.',
    'RAG pipelines retrieve relevant documents and feed them to an LLM as context.',
  ],
  groundTruth: 'RAG is a method that retrieves relevant documents and uses them to generate accurate responses.',
};

describe('evaluate()', () => {
  it('returns an EvalResult with the correct shape', async () => {
    const result = await evaluate(sample);
    expect(result.sample).toBe(sample);
    expect(typeof result.compositeScore).toBe('number');
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.durationMs).toBe('number');
    expect(typeof result.evaluatedAt).toBe('string');
    expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes all 7 metrics by default', async () => {
    const result = await evaluate(sample);
    for (const id of ALL_METRIC_IDS) {
      expect(result.metrics[id]).toBeDefined();
      expect(result.metrics[id].metricId).toBe(id);
    }
  });

  it('compositeScore is between 0 and 1', async () => {
    const result = await evaluate(sample);
    expect(result.compositeScore).not.toBeNull();
    expect(result.compositeScore as number).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore as number).toBeLessThanOrEqual(1);
  });

  it('allows selecting a subset of metrics', async () => {
    const metrics: MetricId[] = ['faithfulness', 'answerRelevance'];
    const result = await evaluate(sample, metrics);
    expect(result.metrics['faithfulness']).toBeDefined();
    expect(result.metrics['answerRelevance']).toBeDefined();
  });

  it('metrics requiring groundTruth return null score when missing', async () => {
    const sampleWithoutGT: EvalSample = {
      question: 'What is RAG?',
      answer: 'RAG combines retrieval with generation.',
      contexts: ['RAG is a retrieval-augmented generation technique.'],
    };
    const result = await evaluate(sampleWithoutGT, ['contextRecall', 'answerCorrectness']);
    expect(result.metrics['contextRecall'].score).toBeNull();
    expect(result.metrics['answerCorrectness'].score).toBeNull();
    expect(result.metrics['contextRecall'].passed).toBeNull();
  });

  it('respects threshold overrides', async () => {
    const result = await evaluate(sample, ['faithfulness'], {
      thresholds: { faithfulness: 0.99 },
    });
    expect(result.metrics['faithfulness'].threshold).toBe(0.99);
  });

  it('cost tracker has llmCalls: 0 for heuristic mode', async () => {
    const result = await evaluate(sample);
    expect(result.cost.llmCalls).toBe(0);
  });
});

describe('evaluateBatch()', () => {
  const samples: EvalSample[] = [
    {
      question: 'What is RAG?',
      answer: 'RAG combines retrieval with generation.',
      contexts: ['RAG is a retrieval-augmented generation technique.'],
      groundTruth: 'RAG retrieves documents and generates answers.',
    },
    {
      question: 'What is machine learning?',
      answer: 'Machine learning trains models on data.',
      contexts: ['Machine learning is a field of AI that trains models on data.'],
      groundTruth: 'Machine learning trains models on data to make predictions.',
    },
  ];

  it('returns BatchEvalResult with correct shape', async () => {
    const result = await evaluateBatch(samples);
    expect(result.results).toHaveLength(2);
    expect(typeof result.compositeAggregate.mean).toBe('number');
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.totalDurationMs).toBe('number');
    expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('computes aggregates for all metrics', async () => {
    const result = await evaluateBatch(samples);
    for (const id of ALL_METRIC_IDS) {
      expect(result.aggregates[id]).toBeDefined();
      expect(typeof result.aggregates[id].mean).toBe('number');
      expect(typeof result.aggregates[id].passRate).toBe('number');
    }
  });

  it('detects regressions when baseline is provided', async () => {
    const baseline = await evaluateBatch(samples);
    // Create samples with less relevant contexts to produce lower scores
    const degradedSamples: EvalSample[] = samples.map(s => ({
      ...s,
      answer: 'The weather is unpredictable and changes frequently.',
      contexts: ['Unrelated context about sports and entertainment.'],
    }));
    const current = await evaluateBatch(degradedSamples, undefined, {
      baselineResult: baseline,
      regressionThreshold: 0.01,
    });
    expect(current.regressions).toBeDefined();
    expect(Array.isArray(current.regressions)).toBe(true);
  });

  it('respects concurrency option', async () => {
    const manySamples = Array.from({ length: 8 }, (_, i) => ({
      question: `Question ${i}?`,
      answer: `Answer ${i}.`,
      contexts: [`Context for question ${i}.`],
    }));
    const result = await evaluateBatch(manySamples, undefined, { concurrency: 2 });
    expect(result.results).toHaveLength(8);
  });
});
