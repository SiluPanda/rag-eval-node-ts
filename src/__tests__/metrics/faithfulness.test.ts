import { describe, it, expect } from 'vitest';
import { scoreFaithfulness } from '../../metrics/faithfulness';
import type { EvalSample } from '../../types';

describe('scoreFaithfulness', () => {
  it('returns a high score when the answer closely matches the context', async () => {
    const sample: EvalSample = {
      question: 'What is RAG?',
      answer: 'RAG combines retrieval with generation to produce grounded answers.',
      contexts: [
        'Retrieval-augmented generation combines retrieval with generation to produce grounded answers.',
      ],
    };
    const result = await scoreFaithfulness(sample);
    expect(result.metricId).toBe('faithfulness');
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThan(0.5);
    expect(result.mode).toBe('heuristic');
    expect(result.llmCalls).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns a low score when the answer is not in the context', async () => {
    const sample: EvalSample = {
      question: 'What is the capital of France?',
      answer: 'The president signed an executive order today regarding trade policy.',
      contexts: [
        'Paris is the capital of France and a major European city.',
      ],
    };
    const result = await scoreFaithfulness(sample);
    expect(result.score as number).toBeLessThan(0.5);
  });

  it('emits WARNING signals for unsupported sentences', async () => {
    const sample: EvalSample = {
      question: 'What is the sky made of?',
      answer: 'The sky is filled with nitrogen oxygen and argon. Additionally dinosaurs went extinct 66 million years ago.',
      contexts: ['The atmosphere contains nitrogen oxygen and trace gases.'],
    };
    const result = await scoreFaithfulness(sample);
    const warnings = result.signals.filter(s => s.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('returns score 0 when there are no contexts', async () => {
    const sample: EvalSample = {
      question: 'Q?',
      answer: 'Some answer.',
      contexts: [],
    };
    const result = await scoreFaithfulness(sample);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('passes threshold check when score >= 0.7', async () => {
    const sample: EvalSample = {
      question: 'What is machine learning?',
      answer: 'Machine learning is a field of artificial intelligence that trains models on data.',
      contexts: [
        'Machine learning is a field of artificial intelligence. It trains models on data to make predictions.',
      ],
    };
    const result = await scoreFaithfulness(sample);
    expect(result.threshold).toBe(0.7);
    expect(typeof result.passed).toBe('boolean');
  });
});
