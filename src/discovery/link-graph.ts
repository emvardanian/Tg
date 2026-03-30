import type { LinksRepo } from '../storage/repositories/links.repo.js';
import { extractDomain } from '../url.js';

export const DOMAIN_STOP_LIST = new Set([
  'github.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'wikipedia.org',
  'medium.com',
  'amazon.com',
  'reddit.com',
  'news.ycombinator.com',
  'stackoverflow.com',
  'google.com',
  'facebook.com',
  'linkedin.com',
  'npmjs.com',
  'pypi.org',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cloudflare.com',
  'amazonaws.com',
  'arxiv.org',
]);

export function processLinks(linksRepo: LinksRepo, sourceId: number, links: string[]): void {
  const seenDomains = new Set<string>();

  for (const link of links) {
    try {
      const domain = extractDomain(link);

      if (DOMAIN_STOP_LIST.has(domain)) continue;
      if (seenDomains.has(domain)) continue;

      seenDomains.add(domain);
      linksRepo.addMention(sourceId, domain, link);
    } catch {
      // Skip invalid URLs
    }
  }
}
