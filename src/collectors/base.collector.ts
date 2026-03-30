import type { Source } from '../storage/repositories/sources.repo.js';

export class RateLimitError extends Error {
  constructor(public source: string, public retryAfterMs?: number) {
    super(`Rate limited by ${source}`);
    this.name = 'RateLimitError';
  }
}

export interface CollectedItem {
  externalId: string;
  url: string;
  title: string;
  contentSnippet?: string;
  wordCount?: number;
  publishedAt?: string;
  meta: {
    upvotes?: number;
    comments?: number;
    stars?: number;
    links?: string[];
  };
}

export interface Collector {
  name: string;
  collect(source: Source, signal?: AbortSignal): Promise<CollectedItem[]>;
}

export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return fn(controller.signal).finally(() => clearTimeout(timer));
}

export function extractLinks(html: string): string[] {
  const linkRegex = /href=["']?(https?:\/\/[^\s"'<>]+)/gi;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

export function estimateWordCount(text: string | undefined): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
