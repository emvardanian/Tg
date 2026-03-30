import Parser from 'rss-parser';
import type { Collector, CollectedItem } from './base.collector.js';
import { extractLinks, estimateWordCount } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const parser = new Parser();

export class RssCollector implements Collector {
  name = 'rss';

  async collect(source: Source, _signal?: AbortSignal): Promise<CollectedItem[]> {
    const feed = await parser.parseURL(source.url);
    const items: CollectedItem[] = [];

    for (const entry of feed.items ?? []) {
      const id = entry.guid ?? entry.link ?? '';
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
