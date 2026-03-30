import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssCollector } from '../../src/collectors/rss.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

// Mock rss-parser
vi.mock('rss-parser', () => {
  return {
    default: class MockParser {
      async parseURL(url: string) {
        return {
          items: [
            {
              guid: 'post-1',
              link: 'https://blog.example.com/post-1',
              title: 'First Post',
              contentSnippet: 'This is the first post content snippet with enough words to test.',
              content: '<p>Content with <a href="https://linked.example.com/article">a link</a></p>',
              isoDate: '2026-03-28T10:00:00Z',
            },
            {
              guid: 'post-2',
              link: 'https://blog.example.com/post-2',
              title: 'Second Post',
              contentSnippet: 'Short.',
              content: '<p>Simple content</p>',
              isoDate: '2026-03-29T10:00:00Z',
            },
          ],
        };
      }
    },
  };
});

const fakeSource: Source = {
  id: 1,
  name: 'Test Blog',
  url: 'https://blog.example.com/feed',
  domain: 'blog.example.com',
  type: 'rss',
  category: 'it',
  enabled: 1,
  added_via: 'config',
  last_fetched_at: null,
  last_item_id: null,
  fetch_errors: 0,
  created_at: '2026-03-01',
};

describe('RssCollector', () => {
  let collector: RssCollector;

  beforeEach(() => {
    collector = new RssCollector();
  });

  it('collects items from RSS feed', async () => {
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(2);
    expect(items[0].externalId).toBe('post-1');
    expect(items[0].url).toBe('https://blog.example.com/post-1');
    expect(items[0].title).toBe('First Post');
  });

  it('extracts links from HTML content', async () => {
    const items = await collector.collect(fakeSource);

    expect(items[0].meta.links).toContain('https://linked.example.com/article');
  });

  it('estimates word count from snippet', async () => {
    const items = await collector.collect(fakeSource);

    expect(items[0].wordCount).toBeGreaterThan(0);
  });
});
