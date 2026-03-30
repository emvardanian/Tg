import cron from 'node-cron';
import type { SourcesRepo, Source } from './storage/repositories/sources.repo.js';
import type { ItemsRepo } from './storage/repositories/items.repo.js';
import type { LinksRepo } from './storage/repositories/links.repo.js';
import type { UsageRepo } from './storage/repositories/usage.repo.js';
import type { Collector, CollectedItem } from './collectors/base.collector.js';
import { withTimeout } from './collectors/base.collector.js';
import { HeuristicClassifier } from './classifier/heuristic.classifier.js';
import type { AiClassifier } from './classifier/ai.classifier.js';
import type { PublishQueue } from './publisher/queue.js';
import type { TelegramPublisher } from './publisher/telegram.publisher.js';
import type { DiscoveryDigest } from './discovery/discovery-digest.js';
import { processLinks } from './discovery/link-graph.js';
import { logger } from './logger.js';

interface SchedulerDeps {
  sourcesRepo: SourcesRepo;
  itemsRepo: ItemsRepo;
  linksRepo: LinksRepo;
  usageRepo: UsageRepo;
  collectors: Map<string, Collector>;
  heuristicClassifier: HeuristicClassifier;
  aiClassifier: AiClassifier;
  publishQueue: PublishQueue;
  publisher: TelegramPublisher;
  discoveryDigest: DiscoveryDigest;
  adminChatId: string;
  monthlyLimitUsd: number;
}

export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];

  constructor(private deps: SchedulerDeps) {}

  start(): void {
    const { collectors } = this.deps;

    // RSS: every 2h at :00
    if (collectors.has('rss')) {
      this.tasks.push(cron.schedule('0 */2 * * *', () => this.runCollector('rss')));
    }

    // HN: every 2h at :15
    if (collectors.has('hackernews')) {
      this.tasks.push(cron.schedule('15 */2 * * *', () => this.runCollector('hackernews')));
    }

    // Reddit: every 2h at :30
    if (collectors.has('reddit')) {
      this.tasks.push(cron.schedule('30 */2 * * *', () => this.runCollector('reddit')));
    }

    // YouTube: daily at 08:00
    if (collectors.has('youtube')) {
      this.tasks.push(cron.schedule('0 8 * * *', () => this.runCollector('youtube')));
    }

    // ProductHunt: daily at 09:00
    if (collectors.has('producthunt')) {
      this.tasks.push(cron.schedule('0 9 * * *', () => this.runCollector('producthunt')));
    }

    // GitHub Trending: daily at 10:00
    if (collectors.has('github-trending')) {
      this.tasks.push(cron.schedule('0 10 * * *', () => this.runCollector('github-trending')));
    }

    // Discovery digest: Sunday at 18:00
    this.tasks.push(cron.schedule('0 18 * * 0', () => this.deps.discoveryDigest.sendWeeklyDigest()));

    // Cost report: Friday at 20:00
    this.tasks.push(cron.schedule('0 20 * * 5', () => this.sendCostReport()));

    // Publish queue: every 5 minutes
    this.tasks.push(cron.schedule('*/5 * * * *', () => this.publishPending()));

    logger.info('Scheduler started');
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    logger.info('Scheduler stopped');
  }

  private async runCollector(type: string): Promise<void> {
    const collector = this.deps.collectors.get(type);
    if (!collector) return;

    const sourceTypeMap: Record<string, string> = {
      rss: 'rss',
      hackernews: 'hn',
      reddit: 'reddit',
      youtube: 'youtube',
      producthunt: 'producthunt',
      'github-trending': 'github',
    };

    const sources = this.deps.sourcesRepo.getByType(sourceTypeMap[type] ?? type);

    for (const source of sources) {
      try {
        const MAX_ITEMS_PER_SOURCE = 50;

        const rawItems = await withTimeout((signal) => collector.collect(source, signal), 15_000);
        const items = rawItems.slice(0, MAX_ITEMS_PER_SOURCE);
        if (rawItems.length > MAX_ITEMS_PER_SOURCE) {
          logger.warn(`Truncated ${source.name}: ${rawItems.length} → ${MAX_ITEMS_PER_SOURCE} items`);
        }

        let newCount = 0;
        for (const collected of items) {
          const item = this.deps.itemsRepo.insertIfNew({
            sourceId: source.id,
            externalId: collected.externalId,
            url: collected.url,
            title: collected.title,
            contentSnippet: collected.contentSnippet,
            wordCount: collected.wordCount,
          });

          if (!item) continue; // duplicate
          newCount++;

          // Classify
          await this.classifyItem(item.id, collected, source);

          // Process links for discovery
          if (collected.meta.links?.length) {
            processLinks(this.deps.linksRepo, source.id, collected.meta.links);
          }
        }

        if (items.length > 0) {
          this.deps.sourcesRepo.recordFetchSuccess(source.id, items[0].externalId);
        }

        logger.info(`Collected from ${source.name}`, { type, total: items.length, new: newCount });
      } catch (err) {
        this.deps.sourcesRepo.recordFetchError(source.id);
        logger.error(`Collector failed for ${source.name}`, { type, error: (err as Error).message });

        // Check if source got disabled
        const updated = this.deps.sourcesRepo.getById(source.id);
        if (updated && updated.enabled === 0) {
          await this.deps.publisher.sendNotification(
            this.deps.adminChatId,
            `⚠️ ${source.name} вимкнено після 5 помилок. /unmute щоб увімкнути`,
          );
        }
      }
    }
  }

  private async classifyItem(
    itemId: number,
    collected: CollectedItem,
    source: Source,
  ): Promise<void> {
    const heuristic = this.deps.heuristicClassifier.classify({
      title: collected.title,
      contentSnippet: collected.contentSnippet,
      sourceCategory: source.category ?? undefined,
      sourceType: source.type,
    });

    if (heuristic.confidence >= 0.5) {
      this.deps.itemsRepo.updateClassification(itemId, {
        category: heuristic.category,
        contentType: heuristic.contentType,
        classifiedBy: 'heuristic',
        score: heuristic.confidence,
      });
      return;
    }

    // Fallback to AI
    const aiResult = await this.deps.aiClassifier.classify({
      title: collected.title,
      sourceName: source.name,
      snippet: collected.contentSnippet ?? collected.title,
    });

    if (aiResult) {
      this.deps.itemsRepo.updateClassification(itemId, {
        category: aiResult.category,
        contentType: aiResult.contentType,
        classifiedBy: 'ai',
        score: 0.8,
      });
    } else {
      // AI unavailable — use heuristic even with low confidence
      this.deps.itemsRepo.updateClassification(itemId, {
        category: heuristic.category,
        contentType: heuristic.contentType,
        classifiedBy: 'heuristic',
        score: heuristic.confidence,
      });
    }
  }

  private async publishPending(): Promise<void> {
    const items = this.deps.itemsRepo.getUnpublished(10);
    for (const item of items) {
      this.deps.publishQueue.enqueue(item);
    }
  }

  private async sendCostReport(): Promise<void> {
    const stats = this.deps.usageRepo.getWeeklyStats();
    const monthly = this.deps.usageRepo.getMonthlySpend();

    await this.deps.publisher.sendNotification(
      this.deps.adminChatId,
      `📊 Тижневий звіт:\n` +
      `• AI виклики: ${stats.totalCalls}\n` +
      `• Витрати за тиждень: $${stats.totalCostUsd.toFixed(4)}\n` +
      `• Витрати за місяць: $${monthly.toFixed(4)} / $${this.deps.monthlyLimitUsd}`,
    );
  }
}
