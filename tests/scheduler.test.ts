import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scheduler } from '../src/scheduler.js';
import { HeuristicClassifier } from '../src/classifier/heuristic.classifier.js';
import { RateLimitError } from '../src/collectors/base.collector.js';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}));

describe('Scheduler', () => {
  let mockDeps: any;
  let scheduler: Scheduler;

  beforeEach(() => {
    mockDeps = {
      sourcesRepo: {
        getByType: vi.fn().mockReturnValue([{ id: 1, name: 'Test', type: 'rss', category: 'it' }]),
        recordFetchSuccess: vi.fn(),
        recordFetchError: vi.fn(),
        getById: vi.fn().mockReturnValue({ id: 1, enabled: 1 }),
      },
      itemsRepo: {
        insertIfNew: vi.fn().mockReturnValue({ id: 1, title: 'New Item' }),
        updateClassification: vi.fn(),
        getUnpublished: vi.fn().mockReturnValue([]),
      },
      linksRepo: {},
      usageRepo: { canUseAI: vi.fn().mockReturnValue(true) },
      feedbackRepo: { getSourceScores: vi.fn().mockReturnValue([]) },
      collectors: new Map(),
      heuristicClassifier: new HeuristicClassifier(),
      aiClassifier: { classify: vi.fn().mockResolvedValue({ category: 'ai', contentType: 'article' }) },
      publishQueue: { enqueue: vi.fn(), updateSourceScores: vi.fn() },
      publisher: { sendNotification: vi.fn() },
      discoveryDigest: { sendWeeklyDigest: vi.fn() },
      adminChatId: '123',
      monthlyLimitUsd: 5,
    };
  });

  it('classifies with heuristic when confidence >= 0.5', async () => {
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockResolvedValue([{
        externalId: '1', url: 'https://a.com/1', title: 'Test',
        contentSnippet: 'Content', meta: {},
      }]),
    };
    mockDeps.collectors.set('rss', mockCollector);
    // Source has category 'it' → heuristic confidence = 0.7
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.itemsRepo.updateClassification).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ classifiedBy: 'heuristic' }),
    );
  });

  it('falls back to AI when heuristic confidence < 0.5', async () => {
    mockDeps.sourcesRepo.getByType.mockReturnValue([
      { id: 1, name: 'Test', type: 'rss', category: null },
    ]);
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockResolvedValue([{
        externalId: '1', url: 'https://a.com/1', title: 'A short note',
        meta: {},
      }]),
    };
    mockDeps.collectors.set('rss', mockCollector);
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.aiClassifier.classify).toHaveBeenCalled();
  });

  it('uses heuristic when AI budget exhausted', async () => {
    mockDeps.usageRepo.canUseAI.mockReturnValue(false);
    mockDeps.aiClassifier.classify.mockResolvedValue(null);
    mockDeps.sourcesRepo.getByType.mockReturnValue([
      { id: 1, name: 'Test', type: 'rss', category: null },
    ]);
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockResolvedValue([{
        externalId: '1', url: 'https://a.com/1', title: 'Short',
        meta: {},
      }]),
    };
    mockDeps.collectors.set('rss', mockCollector);
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.itemsRepo.updateClassification).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ classifiedBy: 'heuristic' }),
    );
  });

  it('increments fetch_errors on collector error', async () => {
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    mockDeps.collectors.set('rss', mockCollector);
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.sourcesRepo.recordFetchError).toHaveBeenCalledWith(1);
  });

  it('does NOT increment fetch_errors on RateLimitError', async () => {
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockRejectedValue(new RateLimitError('reddit')),
    };
    mockDeps.collectors.set('rss', mockCollector);
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.sourcesRepo.recordFetchError).not.toHaveBeenCalled();
  });

  it('updates source scores before enqueuing in publishPending', async () => {
    mockDeps.feedbackRepo = {
      getSourceScores: vi.fn().mockReturnValue([
        { source_id: 1, avg_score: 0.5, total_feedback: 15 },
      ]),
    };
    mockDeps.publishQueue.updateSourceScores = vi.fn();
    mockDeps.itemsRepo.getUnpublished.mockReturnValue([{ id: 1, score: 0.5 } as any]);

    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).publishPending();

    expect(mockDeps.feedbackRepo.getSourceScores).toHaveBeenCalled();
    expect(mockDeps.publishQueue.updateSourceScores).toHaveBeenCalledWith(
      new Map([[1, 0.5]]),
    );
    expect(mockDeps.publishQueue.enqueue).toHaveBeenCalledWith({ id: 1, score: 0.5 });
  });
});
