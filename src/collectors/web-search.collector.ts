import { createHash } from 'crypto';
import type { Collector, CollectedItem } from './base.collector.js';
import { estimateWordCount } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';
import type { SearchService } from '../search/search.service.js';

export class WebSearchCollector implements Collector {
  name = 'web-search';

  constructor(private searchService: SearchService) {}

  async collect(source: Source): Promise<CollectedItem[]> {
    const results = await this.searchService.search(source.url, 10);

    return results.map((r) => ({
      externalId: createHash('sha1').update(r.url).digest('hex').slice(0, 32),
      url: r.url,
      title: r.title,
      contentSnippet: r.snippet || undefined,
      wordCount: estimateWordCount(r.snippet),
      publishedAt: r.publishedAt,
      meta: {},
    }));
  }
}
