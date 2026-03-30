import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { loadConfig } from './config.js';
import { createDatabase } from './storage/db.js';
import { SourcesRepo } from './storage/repositories/sources.repo.js';
import { ItemsRepo } from './storage/repositories/items.repo.js';
import { FeedbackRepo } from './storage/repositories/feedback.repo.js';
import { LinksRepo } from './storage/repositories/links.repo.js';
import { UsageRepo } from './storage/repositories/usage.repo.js';
import { createBot } from './bot/bot.js';
import { registerCommands } from './bot/commands.js';
import { registerFeedback } from './bot/feedback.js';
import { RssCollector } from './collectors/rss.collector.js';
import { HackerNewsCollector } from './collectors/hackernews.collector.js';
import { RedditCollector } from './collectors/reddit.collector.js';
import { YouTubeCollector } from './collectors/youtube.collector.js';
import { ProductHuntCollector } from './collectors/producthunt.collector.js';
import { GitHubTrendingCollector } from './collectors/github-trending.collector.js';
import { HeuristicClassifier } from './classifier/heuristic.classifier.js';
import { AiClassifier } from './classifier/ai.classifier.js';
import { TelegramPublisher } from './publisher/telegram.publisher.js';
import { PublishQueue } from './publisher/queue.js';
import { DiscoveryDigest } from './discovery/discovery-digest.js';
import { Scheduler } from './scheduler.js';
import { createHealthServer } from './health.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  // Load config
  const config = loadConfig('./sources.config.yml');

  // Ensure data directory exists
  mkdirSync(dirname(config.db.path), { recursive: true });

  // Init database
  const db = createDatabase(config.db.path);
  logger.info('Database initialized', { path: config.db.path });

  // Init repositories
  const sourcesRepo = new SourcesRepo(db);
  const itemsRepo = new ItemsRepo(db);
  const feedbackRepo = new FeedbackRepo(db);
  const linksRepo = new LinksRepo(db);
  const usageRepo = new UsageRepo(db);

  // Sync sources from config
  for (const source of config.sources) {
    sourcesRepo.upsertFromConfig(source);
  }
  logger.info(`Synced ${config.sources.length} sources from config`);

  // Init bot
  const bot = createBot(config.telegram.botToken);

  // Register feedback before commands — commands middleware blocks channel updates,
  // but feedback callback queries come from channel messages and must run unrestricted.
  registerFeedback(bot, {
    db,
    feedbackRepo,
    itemsRepo,
    usageRepo,
    anthropicApiKey: config.anthropic.apiKey,
    monthlyLimitUsd: config.anthropic.monthlyLimitUsd,
  });

  registerCommands(bot, {
    db,
    sourcesRepo,
    itemsRepo,
    usageRepo,
    adminChatId: config.telegram.adminChatId,
  });

  // Init collectors
  const collectors = new Map<string, any>();
  collectors.set('rss', new RssCollector());
  collectors.set('hackernews', new HackerNewsCollector(300));
  collectors.set('reddit', new RedditCollector(50));
  collectors.set('producthunt', new ProductHuntCollector());
  collectors.set('github-trending', new GitHubTrendingCollector());

  if (config.youtube.apiKey) {
    collectors.set('youtube', new YouTubeCollector(config.youtube.apiKey));
  }

  // Init classifiers
  const heuristicClassifier = new HeuristicClassifier();
  const aiClassifier = new AiClassifier(
    config.anthropic.apiKey,
    usageRepo,
    config.anthropic.monthlyLimitUsd,
  );

  // Init publisher
  const publisher = new TelegramPublisher(
    bot,
    config.telegram.channelId,
    (id) => sourcesRepo.getById(id),
  );

  const publishQueue = new PublishQueue(
    async (item) => {
      const msgId = await publisher.publish(item);
      itemsRepo.markPublished(item.id, msgId);
      return msgId;
    },
    { minIntervalMs: 180_000, maxPerHour: 15, maxQueueSize: 50 },
  );

  // Init discovery
  const discoveryDigest = new DiscoveryDigest(
    bot,
    config.telegram.adminChatId,
    linksRepo,
    sourcesRepo,
  );
  discoveryDigest.registerCallbacks(bot);

  // Init scheduler
  const scheduler = new Scheduler({
    sourcesRepo,
    itemsRepo,
    linksRepo,
    usageRepo,
    feedbackRepo,
    collectors,
    heuristicClassifier,
    aiClassifier,
    publishQueue,
    publisher,
    discoveryDigest,
    adminChatId: config.telegram.adminChatId,
    monthlyLimitUsd: config.anthropic.monthlyLimitUsd,
    digestMode: config.digest.mode,
    dbPath: config.db.path,
  });

  // Init health server
  const healthPort = parseInt(process.env.HEALTH_PORT ?? '3000', 10);
  const healthServer = createHealthServer({
    db, sourcesRepo, usageRepo, publishQueue,
    dbPath: config.db.path, startTime: Date.now(),
  }, healthPort);

  // Start
  scheduler.start();
  publishQueue.start();
  bot.start({
    onStart: () => { logger.info('Bot started polling'); },
  });

  // Notify admin
  await publisher.sendNotification(
    config.telegram.adminChatId,
    `🔄 Бот запущено. Черга: ${publishQueue.size} елементів`,
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);

    // 1. Stop scheduler
    scheduler.stop();

    // 2. Flush publish queue
    await publishQueue.flush();

    // 3. Stop bot
    bot.stop();

    // 4. Close database
    db.close();

    // 5. Close health server
    healthServer.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
