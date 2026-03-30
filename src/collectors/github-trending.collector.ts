import * as cheerio from 'cheerio';
import type { Collector, CollectedItem } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

export class GitHubTrendingCollector implements Collector {
  name = 'github-trending';

  async collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]> {
    const res = await fetch('https://github.com/trending?since=daily', { signal });
    const html = await res.text();
    const $ = cheerio.load(html);

    const items: CollectedItem[] = [];

    $('article.Box-row').each((_, el) => {
      const repoPath = $(el).find('h2 a').attr('href')?.trim();
      if (!repoPath) return;

      const name = repoPath.replace(/^\//, '');
      const description = $(el).find('p').first().text().trim();
      const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();

      // Extract star count — find link to stargazers
      const starText = $(el).find('a[href$="/stargazers"]').text().trim().replace(/,/g, '');
      const stars = parseInt(starText, 10) || 0;

      items.push({
        externalId: name,
        url: `https://github.com${repoPath}`,
        title: `${name}${language ? ` (${language})` : ''}`,
        contentSnippet: description || undefined,
        meta: { stars },
      });
    });

    return items;
  }
}
