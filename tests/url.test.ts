import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractDomain } from '../src/url.js';

describe('normalizeUrl', () => {
  it('strips utm_ params', () => {
    expect(normalizeUrl('https://example.com/post?utm_source=twitter&utm_medium=social'))
      .toBe('https://example.com/post');
  });

  it('strips www prefix', () => {
    expect(normalizeUrl('https://www.example.com/post'))
      .toBe('https://example.com/post');
  });

  it('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/post/'))
      .toBe('https://example.com/post');
  });

  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Post'))
      .toBe('https://example.com/Post');
  });

  it('keeps non-utm query params', () => {
    expect(normalizeUrl('https://example.com/search?q=test&page=2'))
      .toBe('https://example.com/search?page=2&q=test');
  });

  it('strips fragment', () => {
    expect(normalizeUrl('https://example.com/post#section'))
      .toBe('https://example.com/post');
  });

  it('handles all transforms together', () => {
    expect(normalizeUrl('https://www.EXAMPLE.com/post/?utm_source=hn#top'))
      .toBe('https://example.com/post');
  });
});

describe('extractDomain', () => {
  it('extracts domain without www', () => {
    expect(extractDomain('https://www.simonwillison.net/2024/post'))
      .toBe('simonwillison.net');
  });

  it('extracts domain from simple URL', () => {
    expect(extractDomain('https://blog.example.com/feed'))
      .toBe('blog.example.com');
  });
});
