import type { Collector, CollectedItem } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

interface RedditPost {
  id: string;
  title: string;
  url: string;
  score: number;
  num_comments: number;
  selftext: string;
  created_utc: number;
  is_self: boolean;
}

interface RedditResponse {
  data: {
    children: Array<{ data: RedditPost }>;
  };
}

export class RedditCollector implements Collector {
  name = 'reddit';

  constructor(private minScore: number = 50) {}

  async collect(source: Source): Promise<CollectedItem[]> {
    // Extract subreddit from URL: https://www.reddit.com/r/programming → programming
    const match = source.url.match(/\/r\/([^/]+)/);
    const subreddit = match?.[1] ?? 'programming';

    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=25`,
      {
        headers: {
          'User-Agent': 'content-aggregator/0.1.0 (personal bot)',
        },
      },
    );

    const data = (await res.json()) as RedditResponse;

    return data.data.children
      .map((c) => c.data)
      .filter((p) => p.score >= this.minScore && !p.is_self)
      .map((p) => ({
        externalId: p.id,
        url: p.url,
        title: p.title,
        contentSnippet: p.selftext?.slice(0, 500) || undefined,
        publishedAt: new Date(p.created_utc * 1000).toISOString(),
        meta: {
          upvotes: p.score,
          comments: p.num_comments,
        },
      }));
  }
}
