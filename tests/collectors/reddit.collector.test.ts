import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedditCollector } from '../../src/collectors/reddit.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const fakeSource: Source = {
  id: 3,
  name: 'r/programming',
  url: 'https://www.reddit.com/r/programming',
  domain: 'reddit.com',
  type: 'reddit',
  category: 'it',
  enabled: 1,
  added_via: 'config',
  last_fetched_at: null,
  last_item_id: null,
  fetch_errors: 0,
  created_at: '2026-03-01',
};

describe('RedditCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                title: 'Cool programming post',
                url: 'https://coolblog.com/article',
                score: 200,
                num_comments: 50,
                selftext: 'Some text here',
                created_utc: 1743350400,
                is_self: false,
              },
            },
            {
              data: {
                id: 'def456',
                title: 'Low score post',
                url: 'https://boring.com/meh',
                score: 10,
                num_comments: 2,
                selftext: '',
                created_utc: 1743350400,
                is_self: false,
              },
            },
          ],
        },
      }),
    });
  });

  it('collects posts with score above threshold', async () => {
    const collector = new RedditCollector(50);
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Cool programming post');
    expect(items[0].url).toBe('https://coolblog.com/article');
  });

  it('includes upvotes and comments in meta', async () => {
    const collector = new RedditCollector(50);
    const items = await collector.collect(fakeSource);

    expect(items[0].meta.upvotes).toBe(200);
    expect(items[0].meta.comments).toBe(50);
  });

  it('passes custom User-Agent header', async () => {
    const collector = new RedditCollector(50);
    await collector.collect(fakeSource);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('reddit.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('content-aggregator'),
        }),
      }),
    );
  });
});
