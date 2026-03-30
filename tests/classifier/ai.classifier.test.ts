import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiClassifier } from '../../src/classifier/ai.classifier.js';
import type { UsageRepo } from '../../src/storage/repositories/usage.repo.js';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe('AiClassifier', () => {
  let mockUsageRepo: UsageRepo;

  beforeEach(() => {
    mockCreate.mockReset();
    mockUsageRepo = {
      canUseAI: vi.fn().mockReturnValue(true),
      log: vi.fn(),
    } as unknown as UsageRepo;
  });

  it('classifies an item via Claude Haiku', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"category": "ai", "contentType": "article"}' }],
      usage: { input_tokens: 300, output_tokens: 30 },
    });

    const classifier = new AiClassifier('fake-key', mockUsageRepo, 5);
    const result = await classifier.classify({
      title: 'Training GPT models',
      sourceName: 'Some Blog',
      snippet: 'A post about training large language models',
    });

    expect(result).toEqual({ category: 'ai', contentType: 'article' });
    expect(mockUsageRepo.log).toHaveBeenCalled();
  });

  it('returns null when budget exhausted', async () => {
    (mockUsageRepo.canUseAI as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const classifier = new AiClassifier('fake-key', mockUsageRepo, 5);
    const result = await classifier.classify({
      title: 'Some Post',
      sourceName: 'Blog',
      snippet: 'Content',
    });

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns null on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));

    const classifier = new AiClassifier('fake-key', mockUsageRepo, 5);
    const result = await classifier.classify({
      title: 'Some Post',
      sourceName: 'Blog',
      snippet: 'Content',
    });

    expect(result).toBeNull();
  });
});
