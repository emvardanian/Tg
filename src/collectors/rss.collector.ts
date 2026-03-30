import Parser from 'rss-parser';
import type { Collector, CollectedItem } from './base.collector.js';
import { extractLinks, estimateWordCount } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const parser = new Parser();

export class RssCollector implements Collector {
  name = 'rss';

  async collect(source: Source): Promise<CollectedItem[]> {
    const feed = await parser.parseURL(source.url);
    const items: CollectedItem[] = [];

    let seenCursor = false;

    for (const entry of feed.items ?? []) {
      const id = entry.guid ?? entry.link ?? '';

      // Skip items up to and including the cursor
      if (source.last_item_id) {
        if (id === source.last_item_id) {
          seenCursor = true;
          continue;
        }
        if (!seenCursor) continue;
      }

      if (!entry.link || !entry.title) continue;

      const links = extractLinks(entry.content ?? entry['content:encoded'] ?? '');

      items.push({
        externalId: id,
        url: entry.link,
        title: entry.title,
        contentSnippet: entry.contentSnippet?.slice(0, 500),
        wordCount: estimateWordCount(entry.contentSnippet),
        publishedAt: entry.isoDate,
        meta: { links },
      });
    }

    return items;
  }
}
