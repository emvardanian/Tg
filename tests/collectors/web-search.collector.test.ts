import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSearchCollector } from '../../src/collectors/web-search.collector.js';
import type { SearchService } from '../../src/search/search.service.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

const fakeSource: Source = {
  id: 10,
  name: 'AI Search',
  url: 'artificial intelligence machine learning',
  domain: 'artificial intelligence machine learning',
  type: 'search',
  category: 'ai',
  enabled: 1,
  added_via: 'config',
  last_fetched_at: null,
  last_item_id: null,
  fetch_errors: 0,
  created_at: '2026-03-31',
};

describe('WebSearchCollector', () => {
  let mockSearchService: SearchService;

  beforeEach(() => {
    mockSearchService = {
      search: vi.fn(),
    } as unknown as SearchService;
  });

  it('returns CollectedItems from search results', async () => {
    vi.mocked(mockSearchService.search).mockResolvedValue([
      {
        title: 'AI Article',
        url: 'https://example.com/ai',
        snippet: 'About AI.',
        publishedAt: '2026-03-31',
      },
    ]);

    const collector = new WebSearchCollector(mockSearchService);
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('AI Article');
    expect(items[0].url).toBe('https://example.com/ai');
    expect(items[0].contentSnippet).toBe('About AI.');
    expect(items[0].publishedAt).toBe('2026-03-31');
    expect(items[0].externalId).toBeTruthy();
    expect(mockSearchService.search).toHaveBeenCalledWith(
      'artificial intelligence machine learning',
      10,
      undefined,
    );
  });

  it('returns empty array when search returns no results', async () => {
    vi.mocked(mockSearchService.search).mockResolvedValue([]);

    const collector = new WebSearchCollector(mockSearchService);
    const items = await collector.collect(fakeSource);

    expect(items).toEqual([]);
  });

  it('generates stable externalId from URL', async () => {
    vi.mocked(mockSearchService.search).mockResolvedValue([
      { title: 'T', url: 'https://example.com/article', snippet: 'S' },
      { title: 'T', url: 'https://example.com/article', snippet: 'S' },
    ]);

    const collector = new WebSearchCollector(mockSearchService);
    const items = await collector.collect(fakeSource);

    expect(items[0].externalId).toBe(items[1].externalId);
  });

  it('has collector name "web-search"', () => {
    const collector = new WebSearchCollector(mockSearchService);
    expect(collector.name).toBe('web-search');
  });
});
