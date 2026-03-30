import 'dotenv/config';
import { loadConfig } from '/app/dist/config.js';
import { createDatabase } from '/app/dist/storage/db.js';
import { SourcesRepo } from '/app/dist/storage/repositories/sources.repo.js';
import { ItemsRepo } from '/app/dist/storage/repositories/items.repo.js';
import { LinksRepo } from '/app/dist/storage/repositories/links.repo.js';
import { UsageRepo } from '/app/dist/storage/repositories/usage.repo.js';
import { FeedbackRepo } from '/app/dist/storage/repositories/feedback.repo.js';
import { RssCollector } from '/app/dist/collectors/rss.collector.js';
import { HackerNewsCollector } from '/app/dist/collectors/hackernews.collector.js';
import { RedditCollector } from '/app/dist/collectors/reddit.collector.js';
import { GitHubTrendingCollector } from '/app/dist/collectors/github-trending.collector.js';
import { ProductHuntCollector } from '/app/dist/collectors/producthunt.collector.js';
import { HeuristicClassifier } from '/app/dist/classifier/heuristic.classifier.js';
import { AiClassifier } from '/app/dist/classifier/ai.classifier.js';
import { withTimeout, RateLimitError } from '/app/dist/collectors/base.collector.js';
import { processLinks } from '/app/dist/discovery/link-graph.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const config = loadConfig('/app/sources.config.yml');
mkdirSync(dirname(config.db.path), { recursive: true });
const db = createDatabase(config.db.path);

const sourcesRepo = new SourcesRepo(db);
const itemsRepo = new ItemsRepo(db);
const linksRepo = new LinksRepo(db);
const usageRepo = new UsageRepo(db);

for (const source of config.sources) sourcesRepo.upsertFromConfig(source);

const collectors = new Map([
  ['rss',            new RssCollector()],
  ['hackernews',     new HackerNewsCollector(100)],
  ['reddit',         new RedditCollector(50)],
  ['producthunt',    new ProductHuntCollector()],
  ['github-trending',new GitHubTrendingCollector()],
]);

const heuristic = new HeuristicClassifier();
const ai = new AiClassifier(config.anthropic.apiKey, usageRepo, config.anthropic.monthlyLimitUsd);

const typeMap = { rss:'rss', hackernews:'hn', reddit:'reddit', producthunt:'producthunt', 'github-trending':'github' };

for (const [type, collector] of collectors) {
  const sources = sourcesRepo.getByType(typeMap[type] ?? type);
  console.log(`\n▶ ${type} (${sources.length} sources)`);
  for (const source of sources) {
    try {
      const raw = await withTimeout((signal) => collector.collect(source, signal), 15_000);
      const items = raw.slice(0, 50);
      let newCount = 0;
      for (const collected of items) {
        const item = itemsRepo.insertIfNew({
          sourceId: source.id,
          externalId: collected.externalId,
          url: collected.url,
          title: collected.title,
          contentSnippet: collected.contentSnippet,
          wordCount: collected.wordCount,
        });
        if (!item) continue;
        newCount++;

        // classify
        const h = heuristic.classify({ title: collected.title, contentSnippet: collected.contentSnippet, sourceCategory: source.category, sourceType: source.type });
        if (h.confidence >= 0.5) {
          itemsRepo.updateClassification(item.id, { category: h.category, contentType: h.contentType, classifiedBy: 'heuristic', score: h.confidence });
        } else {
          const aiResult = await ai.classify({ title: collected.title, sourceName: source.name, snippet: collected.contentSnippet ?? collected.title });
          if (aiResult) {
            itemsRepo.updateClassification(item.id, { category: aiResult.category, contentType: aiResult.contentType, classifiedBy: 'ai', score: 0.8 });
          } else {
            itemsRepo.updateClassification(item.id, { category: h.category, contentType: h.contentType, classifiedBy: 'heuristic', score: h.confidence });
          }
        }

        if (collected.meta?.links?.length) processLinks(linksRepo, source.id, collected.meta.links);
      }
      if (items.length > 0) sourcesRepo.recordFetchSuccess(source.id, items[0].externalId);
      console.log(`  ✓ ${source.name}: ${items.length} total, ${newCount} new`);
    } catch (err) {
      if (err instanceof RateLimitError) { console.log(`  ⏳ ${source.name}: rate limited`); continue; }
      console.log(`  ✗ ${source.name}: ${err.message}`);
    }
  }
}

const unpublished = itemsRepo.getUnpublished(999);
console.log(`\n✅ Готово. Нових матеріалів в черзі: ${unpublished.length}`);
db.close();
