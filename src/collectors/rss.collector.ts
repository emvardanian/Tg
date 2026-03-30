import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import type { Collector, CollectedItem } from './base.collector.js';
import { extractLinks, estimateWordCount } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const parser = new Parser({ customFields: { item: ['content:encoded'] } });

const MAX_SNIPPET = 3500;

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, ' ').trim();
}

export class RssCollector implements Collector {
  name = 'rss';

  async collect(source: Source, _signal?: AbortSignal): Promise<CollectedItem[]> {
    const feed = await parser.parseURL(source.url);
    const items: CollectedItem[] = [];

    for (const entry of feed.items ?? []) {
      const id = entry.guid ?? entry.link ?? '';
      if (!entry.link || !entry.title) continue;

      const rawHtml = entry['content:encoded'] ?? entry.content ?? '';
      const links = extractLinks(rawHtml);
      const fullText = rawHtml ? stripHtml(rawHtml) : (entry.contentSnippet ?? '');
      const snippet = fullText.slice(0, MAX_SNIPPET) || undefined;

      items.push({
        externalId: id,
        url: entry.link,
        title: entry.title,
        contentSnippet: snippet,
        wordCount: estimateWordCount(fullText),
        publishedAt: entry.isoDate,
        meta: { links },
      });
    }

    return items;
  }
}
