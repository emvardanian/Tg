import { logger } from '../logger.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
}

interface BraveResponse {
  web?: { results: BraveWebResult[] };
}

export class SearchService {
  constructor(
    private tavilyKey: string,
    private braveKey: string,
  ) {}

  async search(query: string, maxResults = 10): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    try {
      return await this.searchTavily(query, maxResults);
    } catch (err) {
      logger.warn('Tavily failed, falling back to Brave Search', { query, error: (err as Error).message });
      return await this.searchBrave(query, maxResults);
    }
  }

  private async searchTavily(query: string, maxResults: number): Promise<SearchResult[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.tavilyKey,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_published_date: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Tavily error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as TavilyResponse;
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 500),
      publishedAt: r.published_date,
    }));
  }

  private async searchBrave(query: string, maxResults: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query, count: String(maxResults) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.braveKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brave Search error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as BraveResponse;
    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? '',
      publishedAt: r.age,
    }));
  }
}
