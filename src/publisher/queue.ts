import type { Item } from '../storage/repositories/items.repo.js';
import { logger } from '../logger.js';

interface QueueOptions {
  minIntervalMs: number;
  maxPerHour: number;
  maxQueueSize?: number;
  maxToolsPerDay?: number;
}

export class PublishQueue {
  private items: Item[] = [];
  private enqueuedIds = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private publishedThisHour = 0;
  private hourStart = Date.now();
  private toolsPublishedToday = 0;
  private toolsDayStart = this.startOfDay();

  constructor(
    private publishFn: (item: Item) => Promise<number>,
    private options: QueueOptions,
    private sourceScores: Map<number, number> = new Map(),
  ) {}

  get size(): number {
    return this.items.length;
  }

  private effectiveScore(item: Item): number {
    return item.score + (this.sourceScores.get(item.source_id) ?? 0) * 0.2;
  }

  updateSourceScores(map: Map<number, number>): void {
    this.sourceScores = map;
  }

  enqueue(item: Item): void {
    if (this.enqueuedIds.has(item.id)) return; // already in queue
    const wasEmpty = this.items.length === 0;
    this.enqueuedIds.add(item.id);
    this.items.push(item);
    this.items.sort((a, b) => this.effectiveScore(b) - this.effectiveScore(a));

    const max = this.options.maxQueueSize ?? 50;
    if (this.items.length > max) {
      const dropped = this.items.splice(max);
      for (const d of dropped) this.enqueuedIds.delete(d.id);
      logger.warn(`Queue overflow: dropped ${dropped.length} low-score items`);
    }

    if (wasEmpty && this.started && !this.timer) {
      this.processNext();
    }
  }

  start(): void {
    this.started = true;
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

  private startOfDay(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private async processNext(): Promise<void> {
    // Reset hourly counter
    if (Date.now() - this.hourStart > 3600_000) {
      this.publishedThisHour = 0;
      this.hourStart = Date.now();
    }

    // Reset daily tools counter
    const today = this.startOfDay();
    if (today !== this.toolsDayStart) {
      this.toolsPublishedToday = 0;
      this.toolsDayStart = today;
    }

    if (this.items.length === 0 || this.publishedThisHour >= this.options.maxPerHour) {
      return;
    }

    const maxTools = this.options.maxToolsPerDay ?? 2;

    // Skip tools items that exceed the daily limit
    let item: Item | undefined;
    let skippedTools: Item[] = [];
    while (this.items.length > 0) {
      const candidate = this.items.shift()!;
      this.enqueuedIds.delete(candidate.id);
      if (candidate.category === 'devtools_dx' && this.toolsPublishedToday >= maxTools) {
        skippedTools.push(candidate);
        continue;
      }
      item = candidate;
      break;
    }

    // Re-enqueue skipped tools items (they stay for tomorrow)
    for (const skipped of skippedTools) {
      this.enqueuedIds.add(skipped.id);
      this.items.push(skipped);
    }

    if (!item) return;

    try {
      await this.publishFn(item);
      this.publishedThisHour++;
      if (item.category === 'devtools_dx') this.toolsPublishedToday++;
    } catch (err) {
      const retryAfterMs = this.extractRetryAfterMs(err);
      if (retryAfterMs !== null) {
        logger.warn('Telegram rate limit hit, pausing queue', { retryAfterMs, itemId: item.id });
        this.items.unshift(item);
        this.enqueuedIds.add(item.id);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.processNext(), retryAfterMs);
        return;
      }
      logger.error('Failed to publish item', { itemId: item.id, error: (err as Error).message });
    }

    if (this.items.length > 0 && this.publishedThisHour < this.options.maxPerHour) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.processNext(), this.options.minIntervalMs);
    }
  }

  private extractRetryAfterMs(err: unknown): number | null {
    if (
      err !== null &&
      typeof err === 'object' &&
      'error_code' in err &&
      (err as any).error_code === 429
    ) {
      const retryAfter = (err as any).parameters?.retry_after;
      return typeof retryAfter === 'number' ? retryAfter * 1000 : 60_000;
    }
    return null;
  }
}
