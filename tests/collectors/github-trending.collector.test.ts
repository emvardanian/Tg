import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubTrendingCollector } from '../../src/collectors/github-trending.collector.js';
import { RateLimitError } from '../../src/collectors/base.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const fakeSource: Source = {
  id: 1, name: 'GitHub Trending', url: 'https://github.com/trending',
  domain: 'github.com', type: 'github-trending', category: 'it',
  enabled: 1, added_via: 'config', last_fetched_at: null, last_item_id: null,
  fetch_errors: 0, created_at: '2026-03-01',
};

const TRENDING_HTML = `
<html><body>
  <article class="Box-row">
    <h2><a href="/torvalds/linux">torvalds/linux</a></h2>
    <p>The Linux kernel</p>
    <span itemprop="programmingLanguage">C</span>
    <a href="/torvalds/linux/stargazers">171,000</a>
  </article>
</body></html>
`;

describe('GitHubTrendingCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => TRENDING_HTML,
    });
  });

  it('parses trending repos from HTML', async () => {
    const collector = new GitHubTrendingCollector();
    const items = await collector.collect(fakeSource);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://github.com/torvalds/linux');
    expect(items[0].title).toContain('torvalds/linux');
  });

  it('returns empty array when HTML structure changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<html><body><div>No trending repos found</div></body></html>',
    });

    const collector = new GitHubTrendingCollector();
    const items = await collector.collect(fakeSource);
    expect(items).toHaveLength(0);
  });

  it('throws RateLimitError on 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const collector = new GitHubTrendingCollector();
    await expect(collector.collect(fakeSource)).rejects.toBeInstanceOf(RateLimitError);
  });
});
