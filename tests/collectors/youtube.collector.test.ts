import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeCollector } from '../../src/collectors/youtube.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const fakeSource: Source = {
  id: 4, name: 'Fireship', url: 'UCsBjURrPoezykLs9EqgamOA',
  domain: 'UCsBjURrPoezykLs9EqgamOA', type: 'youtube', category: 'it',
  enabled: 1, added_via: 'config', last_fetched_at: null, last_item_id: null,
  fetch_errors: 0, created_at: '2026-03-01',
};

describe('YouTubeCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: { videoId: 'abc123' },
          snippet: {
            title: 'Cool Video', description: 'A video about stuff',
            publishedAt: '2026-03-29T10:00:00Z', channelTitle: 'Fireship',
          },
        }],
      }),
    });
  });

  it('collects videos from YouTube API', async () => {
    const collector = new YouTubeCollector('fake-key');
    const items = await collector.collect(fakeSource);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://www.youtube.com/watch?v=abc123');
    expect(items[0].title).toBe('Cool Video');
  });

  it('handles empty response', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const collector = new YouTubeCollector('fake-key');
    const items = await collector.collect(fakeSource);
    expect(items).toHaveLength(0);
  });
});
