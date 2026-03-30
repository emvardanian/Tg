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

  it('drops low-score items when queue overflows', () => {
    const publishFn = vi.fn().mockResolvedValue(1);
    const queue = new PublishQueue(publishFn, { minIntervalMs: 100, maxPerHour: 15, maxQueueSize: 3 });

    queue.enqueue({ id: 1, score: 10 } as any);
    queue.enqueue({ id: 2, score: 1 } as any);
    queue.enqueue({ id: 3, score: 5 } as any);
    queue.enqueue({ id: 4, score: 8 } as any); // should push out id:2

    expect(queue.size).toBe(3);
  });
});
