import type { Collector, CollectedItem } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

const HN_API = 'https://hacker-news.firebaseio.com/v0';

interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants?: number;
  time: number;
  type: string;
}

export class HackerNewsCollector implements Collector {
  name = 'hackernews';

  constructor(private minScore: number = 100) {}

  async collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]> {
    const isShow = source.url.includes('/show');
    const endpoint = isShow ? 'showstories' : 'topstories';

    const res = await fetch(`${HN_API}/${endpoint}.json`, { signal });
    const storyIds = (await res.json()) as number[];

    // Fetch top 30 stories
    const results = await Promise.allSettled(
      storyIds.slice(0, 30).map(async (id) => {
        const r = await fetch(`${HN_API}/item/${id}.json`, { signal });
        return r.json() as Promise<HNStory>;
      })
    );

    const stories = results
      .filter((r): r is PromiseFulfilledResult<HNStory> => r.status === 'fulfilled')
      .map((r) => r.value);

    return stories
      .filter((s) => s.type === 'story' && s.url && s.score >= this.minScore)
      .map((s) => ({
        externalId: String(s.id),
        url: s.url!,
        title: s.title,
        publishedAt: new Date(s.time * 1000).toISOString(),
        meta: {
          upvotes: s.score,
          comments: s.descendants ?? 0,
        },
      }));
  }
}
