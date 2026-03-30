import type { Collector, CollectedItem } from './base.collector.js';
import type { Source } from '../storage/repositories/sources.repo.js';

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
  };
}

interface YTSearchResponse {
  items: YTSearchItem[];
}

export class YouTubeCollector implements Collector {
  name = 'youtube';

  constructor(private apiKey: string) {}

  async collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]> {
    // Extract channel ID from URL, or use URL as channel ID directly
    const channelId = source.url.includes('youtube.com/channel/')
      ? source.url.split('/channel/')[1]?.split('/')[0]
      : source.url;

    const publishedAfter = source.last_fetched_at ?? new Date(Date.now() - 7 * 86400_000).toISOString();

    const params = new URLSearchParams({
      part: 'snippet',
      channelId: channelId ?? '',
      type: 'video',
      order: 'date',
      maxResults: '10',
      publishedAfter,
      key: this.apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
    const data = (await res.json()) as YTSearchResponse;

    return (data.items ?? []).map((item) => ({
      externalId: item.id.videoId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      title: item.snippet.title,
      contentSnippet: item.snippet.description?.slice(0, 500),
      publishedAt: item.snippet.publishedAt,
      meta: {},
    }));
  }
}
