import { describe, it, expect } from 'vitest';
import { formatDigest, type DigestItem } from '../../src/publisher/digest-formatter.js';

describe('formatDigest', () => {
  it('formats items grouped by category', () => {
    const items: DigestItem[] = [
      { title: 'AI Post', category: 'ai', url: 'https://a.com/1', source_name: 'Blog' },
      { title: 'Biz Post', category: 'business', url: 'https://b.com/1', source_name: 'News' },
      { title: 'AI Post 2', category: 'ai', url: 'https://a.com/2', source_name: 'Blog2' },
    ];
    const msg = formatDigest(items);

    expect(msg).toContain('🧠 AI');
    expect(msg).toContain('💼 Business');
    expect(msg).toContain('AI Post');
    expect(msg).toContain('Biz Post');
  });

  it('returns empty message for no items', () => {
    const msg = formatDigest([]);
    expect(msg).toContain('Нових матеріалів немає');
  });

  it('handles malformed URL gracefully', () => {
    const items: DigestItem[] = [
      { title: 'Bad URL Post', category: 'ai', url: 'not-a-valid-url' },
    ];
    const msg = formatDigest(items);
    expect(msg).toContain('Bad URL Post');
  });
});
