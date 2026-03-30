import type { Source } from '../storage/repositories/sources.repo.js';

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
  collect(source: Source): Promise<CollectedItem[]>;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
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
