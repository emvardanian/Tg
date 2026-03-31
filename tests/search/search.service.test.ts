import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchService } from '../../src/search/search.service.js';

describe('SearchService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns results from Tavily', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: 'AI News',
            url: 'https://example.com/ai',
            content: 'About AI.',
            published_date: '2026-03-31',
          },
        ],
      }),
    } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    const results = await service.search('artificial intelligence', 5);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'AI News',
      url: 'https://example.com/ai',
      snippet: 'About AI.',
      publishedAt: '2026-03-31',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to Brave Search on Tavily quota error', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, text: async () => 'quota exceeded' } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: 'Brave Result',
                url: 'https://brave.com/result',
                description: 'Brave snippet.',
                age: '2026-03-31',
              },
            ],
          },
        }),
      } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    const results = await service.search('artificial intelligence', 5);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Brave Result');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to Brave Search on Tavily 429', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, text: async () => 'Too Many Requests' } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: {
            results: [
              { title: 'R', url: 'https://r.com', description: 'D', age: undefined },
            ],
          },
        }),
      } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    const results = await service.search('query', 5);

    expect(results[0].title).toBe('R');
  });

  it('throws if both Tavily and Brave fail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, text: async () => 'quota exceeded' } as any)
      .mockResolvedValueOnce({ ok: false, text: async () => 'Service Unavailable' } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    await expect(service.search('query', 5)).rejects.toThrow('Brave Search error');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to Brave when Tavily returns server error (500)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, text: async () => 'Internal Server Error' } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: 'Brave Fallback',
                url: 'https://brave.com/fallback',
                description: 'Fallback snippet.',
                age: '2026-03-31',
              },
            ],
          },
        }),
      } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    const results = await service.search('artificial intelligence', 5);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Brave Fallback');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when Tavily returns no results', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as any);

    const service = new SearchService('tavily-key', 'brave-key');
    const results = await service.search('obscure query', 5);

    expect(results).toEqual([]);
  });
});
