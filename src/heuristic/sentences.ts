/**
 * Sentence segmentation utilities for heuristic evaluation.
 */

/**
 * Split text into sentences on . ! ? followed by whitespace+uppercase or end of string.
 * Filters empty strings.
 */
export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace+uppercase or end of string
  const raw = text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*$/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Keep sentences with at least 3 words (simple heuristic for factual content).
 */
export function filterFactualSentences(sentences: string[]): string[] {
  return sentences.filter(s => s.split(/\s+/).filter(w => w.length > 0).length >= 3);
}
