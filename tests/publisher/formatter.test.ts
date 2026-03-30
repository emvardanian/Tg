import { describe, it, expect } from 'vitest';
import { formatMessage } from '../../src/publisher/formatter.js';

describe('formatMessage', () => {
  it('formats a standard article', () => {
    const msg = formatMessage({
      category: 'ai',
      contentType: 'article',
      title: 'The Future of AI Agents',
      contentSnippet: 'TypeScript continues to dominate enterprise development.',
      url: 'https://simonwillison.net/2026/post',
      sourceName: 'Simon Willison',
      wordCount: 1200,
    });

    expect(msg).toContain('🧠 AI');
    expect(msg).toContain('📰 Article');
    expect(msg).toContain('The Future of AI Agents');
    expect(msg).toContain('simonwillison.net');
    expect(msg).toContain('Simon Willison');
  });

  it('formats a GitHub repo', () => {
    const msg = formatMessage({
      category: 'tools',
      contentType: 'repo',
      title: 'owner/cool-tool (Rust)',
      contentSnippet: 'A blazing fast CLI tool',
      url: 'https://github.com/owner/cool-tool',
      sourceName: 'GitHub Trending',
      stars: 1234,
    });

    expect(msg).toContain('🔧 Tools');
    expect(msg).toContain('⭐ Repo');
    expect(msg).toContain('⭐ 1,234');
  });

  it('formats a video', () => {
    const msg = formatMessage({
      category: 'it',
      contentType: 'video',
      title: 'System Design Interview',
      url: 'https://youtube.com/watch?v=abc',
      sourceName: 'ByteByteGo',
    });

    expect(msg).toContain('🖥 IT');
    expect(msg).toContain('🎬 Video');
  });

  it('truncates long snippets', () => {
    const longSnippet = 'word '.repeat(100);
    const msg = formatMessage({
      category: 'it',
      contentType: 'article',
      title: 'Test',
      contentSnippet: longSnippet,
      url: 'https://example.com',
      sourceName: 'Test',
    });

    expect(msg.length).toBeLessThan(longSnippet.length + 200);
  });

  it('includes summary when provided', () => {
    const result = formatMessage({
      category: 'ai',
      contentType: 'article',
      title: 'Test Article',
      url: 'https://example.com/test',
      sourceName: 'Test Source',
      summary: 'Це резюме статті у трьох реченнях.',
    });
    expect(result).toContain('Це резюме статті');
    expect(result).toContain('📝');
  });

  it('omits summary section when not provided', () => {
    const result = formatMessage({
      category: 'ai',
      contentType: 'article',
      title: 'Test Article',
      url: 'https://example.com/test',
      sourceName: 'Test Source',
    });
    expect(result).not.toContain('📝');
  });
});
