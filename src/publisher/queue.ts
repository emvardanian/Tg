import type { Item } from '../storage/repositories/items.repo.js';
import { logger } from '../logger.js';

interface QueueOptions {
  minIntervalMs: number;
  maxPerHour: number;
  maxQueueSize?: number;
}

export class PublishQueue {
  private items: Item[] = [];
  private enqueuedIds = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private publishedThisHour = 0;
  private hourStart = Date.now();

  constructor(
    private publishFn: (item: Item) => Promise<number>,
    private options: QueueOptions,
  ) {}

  get size(): number {
    return this.items.length;
  }

  enqueue(item: Item): void {
    if (this.enqueuedIds.has(item.id)) return; // already in queue
    this.enqueuedIds.add(item.id);
    this.items.push(item);
    this.items.sort((a, b) => b.score - a.score);

    const max = this.options.maxQueueSize ?? 50;
    if (this.items.length > max) {
      const dropped = this.items.splice(max);
      logger.warn(`Queue overflow: dropped ${dropped.length} low-score items`);
    }
  }

  start(): void {
    this.processNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async flush(): Promise<void> {
    while (this.items.length > 0) {
      await this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    // Reset hourly counter
    if (Date.now() - this.hourStart > 3600_000) {
      this.publishedThisHour = 0;
      this.hourStart = Date.now();
    }

    if (this.items.length === 0 || this.publishedThisHour >= this.options.maxPerHour) {
      return;
    }

    const item = this.items.shift()!;
    this.enqueuedIds.delete(item.id);
    try {
      await this.publishFn(item);
      this.publishedThisHour++;
    } catch (err) {
      logger.error('Failed to publish item', { itemId: item.id, error: (err as Error).message });
    }

    if (this.items.length > 0 && this.publishedThisHour < this.options.maxPerHour) {
      this.timer = setTimeout(() => this.processNext(), this.options.minIntervalMs);
    }
  }
}
