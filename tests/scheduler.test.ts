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
        findByTitle: vi.fn().mockReturnValue(null),
        findByNormalizedUrl: vi.fn().mockReturnValue(null),
        updateClassification: vi.fn(),
        savePipelineResult: vi.fn(),
        getUnpublished: vi.fn().mockReturnValue([]),
        markPublished: vi.fn(),
      },
      linksRepo: {},
      usageRepo: {},
      feedbackRepo: { getSourceScores: vi.fn().mockReturnValue([]) },
      collectors: new Map(),
      heuristicClassifier: new HeuristicClassifier(),
      pipelineService: {
        process: vi.fn().mockResolvedValue({
          telegramPost: 'post text',
          captionText: null,
          imageUrl: null,
          compositeScore: 3.5,
          category: 'ai_ml',
          shouldPin: false,
        }),
      },
      publishQueue: { enqueue: vi.fn(), updateSourceScores: vi.fn() },
      publisher: { sendNotification: vi.fn() },
      discoveryDigest: { sendWeeklyDigest: vi.fn() },
      adminChatId: '123',
      digestMode: 'realtime',
      dbPath: ':memory:',
    };
  });

  it('saves pipeline result when pipeline succeeds', async () => {
    const mockCollector = {
      name: 'rss',
      collect: vi.fn().mockResolvedValue([{
        externalId: '1', url: 'https://a.com/1', title: 'Test',
        contentSnippet: 'Content', meta: {},
      }]),
    };
    mockDeps.collectors.set('rss', mockCollector);
    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).runCollector('rss');

    expect(mockDeps.pipelineService.process).toHaveBeenCalled();
    expect(mockDeps.itemsRepo.savePipelineResult).toHaveBeenCalledWith(
      1, 'post text', 3.5 / 5, 'ai_ml', false, null, null,
    );
  });

  it('falls back to heuristic when pipeline returns null', async () => {
    mockDeps.pipelineService.process.mockResolvedValue(null);
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

    expect(mockDeps.itemsRepo.updateClassification).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ classifiedBy: 'heuristic' }),
    );
  });

  it('records fetch error when pipeline throws', async () => {
    mockDeps.pipelineService.process.mockRejectedValue(new Error('API error'));
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

    expect(mockDeps.sourcesRepo.recordFetchError).toHaveBeenCalledWith(1);
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

  it('processes item through pipeline with correct input', async () => {
    const collected = {
      externalId: 'pipe-1',
      url: 'https://example.com/article',
      title: 'Pipeline Test',
      contentSnippet: 'snippet text here',
      meta: {},
    } as any;
    const source = { id: 1, name: 'Test', type: 'rss', category: 'it' } as any;

    scheduler = new Scheduler(mockDeps);
    await (scheduler as any).processItem(1, collected, source);

    expect(mockDeps.pipelineService.process).toHaveBeenCalledWith({
      url: 'https://example.com/article',
      title: 'Pipeline Test',
      snippet: 'snippet text here',
      sourceType: 'rss',
      author: 'Test',
    });
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
