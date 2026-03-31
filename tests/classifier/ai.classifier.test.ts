import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { AiClassifier } from '../../src/classifier/ai.classifier.js';
import type { UsageRepo } from '../../src/storage/repositories/usage.repo.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

vi.mock('@extractus/article-extractor', () => ({
  extract: vi.fn(),
}));

describe('AiClassifier', () => {
  let mockUsageRepo: UsageRepo;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUsageRepo = {
      log: vi.fn(),
    } as unknown as UsageRepo;
  });

  describe('classify', () => {
    it('parses JSON from Claude CLI and returns result', async () => {
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, '{"category":"ai","contentType":"article"}', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.classify({
        title: 'Training GPT models',
        sourceName: 'Some Blog',
        snippet: 'A post about training large language models',
      });

      expect(result).toEqual({ category: 'ai', contentType: 'article' });
      expect(mockUsageRepo.log).toHaveBeenCalledWith({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
    });

    it('returns null if Claude CLI returns invalid JSON', async () => {
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, 'Sorry, I cannot classify this.', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.classify({
        title: 'Some Post',
        sourceName: 'Blog',
        snippet: 'Content',
      });

      expect(result).toBeNull();
    });

    it('returns null if JSON has invalid enum values', async () => {
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, '{"category":"invalid","contentType":"article"}', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.classify({
        title: 'Some Post',
        sourceName: 'Blog',
        snippet: 'Content',
      });

      expect(result).toBeNull();
    });

    it('returns null if subprocess throws', async () => {
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(new Error('claude: command not found'), '', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.classify({
        title: 'Some Post',
        sourceName: 'Blog',
        snippet: 'Content',
      });

      expect(result).toBeNull();
    });

    it('parses JSON wrapped in markdown code block', async () => {
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, '```json\n{"category":"tools","contentType":"tool"}\n```', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.classify({
        title: 'A new CLI tool',
        sourceName: 'GitHub',
        snippet: 'A useful tool',
      });

      expect(result).toEqual({ category: 'tools', contentType: 'tool' });
    });
  });

  describe('generateSummary', () => {
    it('returns text from stdout', async () => {
      const { extract } = await import('@extractus/article-extractor');
      vi.mocked(extract).mockRejectedValue(new Error('Extraction failed'));

      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, 'Це резюме статті про ШІ.', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.generateSummary({
        url: 'https://example.com/article',
        snippet: 'Some snippet',
        title: 'Some title',
      });

      expect(result).toBe('Це резюме статті про ШІ.');
      expect(mockUsageRepo.log).toHaveBeenCalledWith({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
    });

    it('returns null if subprocess throws', async () => {
      const { extract } = await import('@extractus/article-extractor');
      vi.mocked(extract).mockRejectedValue(new Error('Extraction failed'));

      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(new Error('timeout'), '', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.generateSummary({
        url: 'https://example.com/article',
        snippet: 'snippet',
        title: 'title',
      });

      expect(result).toBeNull();
    });

    it('uses article content when extraction succeeds', async () => {
      const { extract } = await import('@extractus/article-extractor');
      vi.mocked(extract).mockResolvedValue({ content: 'Full article text.', url: 'https://example.com', title: 'T' } as any);

      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback: any) => {
        callback(null, 'Резюме статті.', '');
        return {} as any;
      });

      const classifier = new AiClassifier(mockUsageRepo);
      const result = await classifier.generateSummary({
        url: 'https://example.com/article',
        snippet: 'snippet',
        title: 'title',
      });

      expect(result).toBe('Резюме статті.');
    });
  });
});
