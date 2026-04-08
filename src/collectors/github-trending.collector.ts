import * as cheerio from 'cheerio';
import type { Collector, CollectedItem } from './base.collector.js';
import { RateLimitError } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const MIN_TOTAL_STARS = 25_000;
const MIN_STARS_TODAY = 500;

export class GitHubTrendingCollector implements Collector {
  name = 'github-trending';

  async collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]> {
    const period = source.url.includes('weekly') ? 'weekly' : 'daily';
    const res = await fetch(`https://github.com/trending?since=${period}`, { signal });
    if (!res.ok) {
      if (res.status === 429) {
        throw new RateLimitError('github-trending', 60_000);
      }
      throw new Error(`GitHub Trending error: ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const items: CollectedItem[] = [];

    $('article.Box-row').each((_, el) => {
      const repoPath = $(el).find('h2 a').attr('href')?.trim();
      if (!repoPath) return;

      const name = repoPath.replace(/^\//, '');
      const description = $(el).find('p').first().text().trim();
      const language = $(el).find('[itemprop="programmingLanguage"]').text().trim();

      const starText = $(el).find('a[href$="/stargazers"]').text().trim().replace(/,/g, '');
      const stars = parseInt(starText, 10) || 0;

      // Stars gained today/this week — last span in the footer
      const deltaText = $(el).find('span.d-inline-block.float-sm-right').text().trim().replace(/,/g, '');
      const starsToday = parseInt(deltaText, 10) || 0;

      // Include if: big repo OR rapidly growing
      if (stars < MIN_TOTAL_STARS && starsToday < MIN_STARS_TODAY) return;

      items.push({
        externalId: name,
        url: `https://github.com${repoPath}`,
        title: `${name}${language ? ` (${language})` : ''}`,
        contentSnippet: description || undefined,
        meta: { stars, starsToday },
      });
    });

    return items;
  }
}
