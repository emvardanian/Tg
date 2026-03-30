import { describe, it, expect } from 'vitest';
import { HeuristicClassifier, type ClassificationResult } from '../../src/classifier/heuristic.classifier.js';

describe('HeuristicClassifier', () => {
  const classifier = new HeuristicClassifier();

  it('uses source default category when present', () => {
    const result = classifier.classify({
      title: 'Some random post',
      contentSnippet: 'Nothing special here',
      sourceCategory: 'ai',
      sourceType: 'rss',
    });

    expect(result.category).toBe('ai');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('infers content type from source type: youtube → video', () => {
    const result = classifier.classify({
      title: 'My Video',
      sourceCategory: 'it',
      sourceType: 'youtube',
    });

    expect(result.contentType).toBe('video');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('infers content type from source type: hn → discussion', () => {
    const result = classifier.classify({
      title: 'Ask HN: Something',
      sourceCategory: 'it',
      sourceType: 'hn',
    });

    expect(result.contentType).toBe('discussion');
  });

  it('infers content type from source type: github → repo', () => {
    const result = classifier.classify({
      title: 'owner/repo (TypeScript)',
      sourceCategory: 'tools',
      sourceType: 'github',
    });

    expect(result.contentType).toBe('repo');
  });

  it('classifies AI-related keywords', () => {
    const result = classifier.classify({
      title: 'New GPT-5 model breaks benchmarks with transformer architecture',
      contentSnippet: 'OpenAI released a new large language model',
      sourceType: 'hn',
    });

    expect(result.category).toBe('ai');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('classifies business/startup keywords', () => {
    const result = classifier.classify({
      title: 'How to raise your Series A in 2026',
      contentSnippet: 'Fundraising tips from YC partners about venture capital',
      sourceType: 'rss',
    });

    expect(result.category).toBe('business');
  });

  it('returns low confidence for ambiguous items', () => {
    const result = classifier.classify({
      title: 'A short note',
      sourceType: 'rss',
    });

    expect(result.confidence).toBeLessThan(0.5);
  });
});
