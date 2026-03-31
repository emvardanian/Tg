import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreadsCollector } from '../../src/collectors/threads.collector.js';
import type { Source } from '../../src/storage/repositories/sources.repo.js';

const fakeSource: Source = {
  id: 20,
  name: 'AI on Threads',
  url: 'artificial intelligence',
  domain: 'artificial intelligence',
  type: 'threads',
  category: 'ai',
  enabled: 1,
  added_via: 'config',
  last_fetched_at: null,
  last_item_id: null,
  fetch_errors: 0,
  created_at: '2026-03-31',
};

describe('ThreadsCollector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns CollectedItems from Threads search', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'thread-123',
            text: 'The future of AI is here. Excited to share our new model!',
            timestamp: '2026-03-31T10:00:00+0000',
            permalink: 'https://www.threads.net/@sama/post/thread-123',
            username: 'sama',
          },
        ],
      }),
    } as any);

    const collector = new ThreadsCollector('test-access-token');
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('thread-123');
    expect(items[0].url).toBe('https://www.threads.net/@sama/post/thread-123');
    expect(items[0].title).toBe('@sama: The future of AI is here. Excited to share our new...');
    expect(items[0].contentSnippet).toBe('The future of AI is here. Excited to share our new model!');
    expect(items[0].publishedAt).toBe('2026-03-31T10:00:00+0000');
  });

  it('filters out threads with no text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'img-only',
            text: '',
            timestamp: '2026-03-31T10:00:00+0000',
            permalink: 'https://www.threads.net/@user/post/img-only',
            username: 'user',
          },
          {
            id: 'has-text',
            text: 'Real content here.',
            timestamp: '2026-03-31T10:00:00+0000',
            permalink: 'https://www.threads.net/@user/post/has-text',
            username: 'user',
          },
        ],
      }),
    } as any);

    const collector = new ThreadsCollector('test-access-token');
    const items = await collector.collect(fakeSource);

    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('has-text');
  });

  it('throws on non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as any);

    const collector = new ThreadsCollector('bad-token');
    await expect(collector.collect(fakeSource)).rejects.toThrow('Threads API error 401');
  });

  it('sends Authorization header with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const collector = new ThreadsCollector('my-secret-token');
    await collector.collect(fakeSource);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('threads/search'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-secret-token' }),
      }),
    );
  });

  it('has collector name "threads"', () => {
    const collector = new ThreadsCollector('token');
    expect(collector.name).toBe('threads');
  });
});
