import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublishQueue } from '../../src/publisher/queue.js';

describe('PublishQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes items with delay between them', async () => {
    const publishFn = vi.fn().mockResolvedValue(12345);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15 });

    queue.enqueue({ id: 1, score: 5 } as any);
    queue.enqueue({ id: 2, score: 3 } as any);

    queue.start();

    // First item publishes immediately
    await vi.advanceTimersByTimeAsync(10);
    expect(publishFn).toHaveBeenCalledTimes(1);

    // Second item publishes after delay
    await vi.advanceTimersByTimeAsync(100);
    expect(publishFn).toHaveBeenCalledTimes(2);

    queue.stop();
  });

  it('respects max per hour limit', async () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 10, maxPerHour: 2 });

    queue.enqueue({ id: 1, score: 1 } as any);
    queue.enqueue({ id: 2, score: 1 } as any);
    queue.enqueue({ id: 3, score: 1 } as any);

    queue.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(publishFn).toHaveBeenCalledTimes(2);
    queue.stop();
  });

  it('ignores duplicate enqueue of same item', () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15 });

    const item = { id: 1, score: 5 } as any;
    queue.enqueue(item);
    queue.enqueue(item); // duplicate

    expect(queue.size).toBe(1);
  });

  it('drops low-score items when queue overflows', () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15, maxQueueSize: 3 });

    queue.enqueue({ id: 1, score: 10 } as any);
    queue.enqueue({ id: 2, score: 1 } as any);
    queue.enqueue({ id: 3, score: 5 } as any);
    queue.enqueue({ id: 4, score: 8 } as any); // should push out id:2

    expect(queue.size).toBe(3);
  });

  it('boosts items from well-rated sources', () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const sourceScores = new Map([[1, 0.5], [2, -0.3]]);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15 }, sourceScores);

    queue.enqueue({ id: 1, source_id: 1, score: 0.5 } as any);
    queue.enqueue({ id: 2, source_id: 2, score: 0.5 } as any);

    // Item from source 1 (avg +0.5) should rank higher
    // effectiveScore(id:1) = 0.5 + 0.5*0.2 = 0.6
    // effectiveScore(id:2) = 0.5 + (-0.3)*0.2 = 0.44
    expect((queue as any).items[0].id).toBe(1);
  });

  it('respects updated source scores on subsequent enqueue', () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15 });

    // Enqueue with no scores (both have same effective score)
    queue.enqueue({ id: 1, source_id: 1, score: 0.5 } as any);
    queue.enqueue({ id: 2, source_id: 2, score: 0.5 } as any);

    // Now update scores — source 2 becomes preferred
    queue.updateSourceScores(new Map([[1, -0.5], [2, 1.0]]));

    // Enqueue a new item — triggers re-sort via effectiveScore
    queue.enqueue({ id: 3, source_id: 2, score: 0.4 } as any);

    // id:3 from source 2 (effective=0.4+1.0*0.2=0.6) > id:1 source 1 (effective=0.5+(-0.5)*0.2=0.4)
    // id:2 was already in queue from source 2 (effective=0.5+1.0*0.2=0.7)
    expect((queue as any).items[0].id).toBe(2);
  });

  it('pauses queue and re-enqueues item on Telegram 429 error', async () => {
    class FakeGrammyError extends Error {
      error_code = 429;
      parameters = { retry_after: 1 };
      constructor() { super('Too Many Requests: retry after 1'); }
    }

    let callCount = 0;
    const publishFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new FakeGrammyError();
      return 1;
    });

    const queue = new PublishQueue(publishFn, { minIntervalMs: 10, maxPerHour: 15 });
    queue.enqueue({ id: 1, score: 5 } as any);
    queue.start();

    await vi.advanceTimersByTimeAsync(10);
    expect(publishFn).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(1); // item put back

    await vi.advanceTimersByTimeAsync(1000); // wait retry_after=1s
    expect(publishFn).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0); // successfully published

    queue.stop();
  });

  it('drops item on non-429 failure', async () => {
    const publishFn = vi.fn().mockRejectedValue(new Error('network error'));
    const queue = new PublishQueue(publishFn, { minIntervalMs: 10, maxPerHour: 15 });
    queue.enqueue({ id: 1, score: 5 } as any);
    queue.start();

    await vi.advanceTimersByTimeAsync(10);
    expect(publishFn).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0); // item dropped

    queue.stop();
  });
});
