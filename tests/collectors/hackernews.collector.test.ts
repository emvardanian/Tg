import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HackerNewsCollector } from '../../src/collectors/hackernews.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

// Mock undici fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const fakeSource: Source = {
  id: 2,
  name: 'Hacker News Top',
  url: 'https://news.ycombinator.com',
  domain: 'news.ycombinator.com',
  type: 'hn',
  category: 'it',
  enabled: 1,
  added_via: 'config',
  last_fetched_at: null,
  last_item_id: null,
  fetch_errors: 0,
  created_at: '2026-03-01',
};

describe('HackerNewsCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();

    // Mock top stories endpoint
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('topstories')) {
        return { ok: true, json: async () => [1001, 1002, 1003] };
      }
      if (url.includes('showstories')) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes('/item/1001')) {
        return {
          ok: true,
          json: async () => ({
            id: 1001, title: 'High Score Story', url: 'https://example.com/high',
            score: 150, descendants: 80, time: 1743350400, type: 'story',
          }),
        };
      }
      if (url.includes('/item/1002')) {
        return {
          ok: true,
          json: async () => ({
            id: 1002, title: 'Low Score Story', url: 'https://example.com/low',
            score: 30, descendants: 5, time: 1743350400, type: 'story',
          }),
        };
      }
      if (url.includes('/item/1003')) {
        return {
          ok: true,
          json: async () => ({
            id: 1003, title: 'Medium Story', url: 'https://example.com/med',
            score: 110, descendants: 40, time: 1743350400, type: 'story',
          }),
        };
      }
      return { ok: false };
    });
  });

  it('collects stories with score > 100', async () => {
    const collector = new HackerNewsCollector(100);
    const items = await collector.collect(fakeSource);

    const titles = items.map((i) => i.title);
    expect(titles).toContain('High Score Story');
    expect(titles).toContain('Medium Story');
    expect(titles).not.toContain('Low Score Story');
  });

  it('includes upvotes and comments in meta', async () => {
    const collector = new HackerNewsCollector(100);
    const items = await collector.collect(fakeSource);

    const high = items.find((i) => i.title === 'High Score Story')!;
    expect(high.meta.upvotes).toBe(150);
    expect(high.meta.comments).toBe(80);
  });

  it('returns all stories for discovery (low threshold)', async () => {
    const collector = new HackerNewsCollector(0);
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(3);
  });
});
