import type { Collector, CollectedItem } from './base.collector.js';
import { estimateWordCount } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const THREADS_API = 'https://graph.threads.net/v1.0';
const THREAD_FIELDS = 'id,text,timestamp,permalink,username';

interface ThreadPost {
  id: string;
  text?: string;
  timestamp: string;
  permalink: string;
  username: string;
}

interface ThreadsSearchResponse {
  data: ThreadPost[];
}

export class ThreadsCollector implements Collector {
  name = 'threads';

  constructor(private accessToken: string) {}

  async collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]> {
    const params = new URLSearchParams({
      q: source.url,
      fields: THREAD_FIELDS,
      limit: '20',
    });

    const res = await fetch(`${THREADS_API}/threads/search?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal,
    });

    if (!res.ok) {
      throw new Error(`Threads API error ${res.status}`);
    }

    const data = (await res.json()) as ThreadsSearchResponse;

    return data.data
      .filter((t) => t.text && t.text.trim().length > 0)
      .map((t) => {
        const text = t.text!.trim();
        const titlePreview = text.length > 50 ? `${text.slice(0, 50)}...` : text;
        return {
          externalId: t.id,
          url: t.permalink,
          title: `@${t.username}: ${titlePreview}`,
          contentSnippet: text,
          wordCount: estimateWordCount(text),
          publishedAt: t.timestamp,
          meta: {},
        };
      });
  }
}
