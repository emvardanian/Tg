import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../../src/storage/db.js';
import { ItemsRepo, type Item } from '../../../src/storage/repositories/items.repo.js';

describe('ItemsRepo', () => {
  let db: Database;
  let repo: ItemsRepo;
  let sourceId: number;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new ItemsRepo(db);
    // Insert a test source
    db.prepare(
      "INSERT INTO sources (name, url, domain, type) VALUES ('Test', 'https://test.com/feed', 'test.com', 'rss')"
    ).run();
    sourceId = 1;
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a new item', () => {
    const inserted = repo.insertIfNew({
      sourceId,
      externalId: 'abc-123',
      url: 'https://example.com/post-1',
      title: 'Test Post',
      contentSnippet: 'Some content here',
      wordCount: 500,
    });

    expect(inserted).not.toBeNull();
    expect(inserted!.title).toBe('Test Post');
    expect(inserted!.url_normalized).toBe('https://example.com/post-1');
  });

  it('deduplicates by normalized URL', () => {
    repo.insertIfNew({
      sourceId,
      externalId: '1',
      url: 'https://www.example.com/post/?utm_source=hn',
      title: 'First',
    });

    const dupe = repo.insertIfNew({
      sourceId,
      externalId: '2',
      url: 'https://example.com/post',
      title: 'Duplicate',
    });

    expect(dupe).toBeNull();
  });

  it('getUnpublished returns items ordered by score desc', () => {
    repo.insertIfNew({ sourceId, externalId: '1', url: 'https://a.com/1', title: 'Low' });
    repo.insertIfNew({ sourceId, externalId: '2', url: 'https://a.com/2', title: 'High' });

    // Manually set scores
    db.prepare("UPDATE items SET score = 5 WHERE title = 'High'").run();
    db.prepare("UPDATE items SET score = 1 WHERE title = 'Low'").run();

    const items = repo.getUnpublished(10);
    expect(items[0].title).toBe('High');
    expect(items[1].title).toBe('Low');
  });

  it('markPublished updates published flag and message ID', () => {
    const item = repo.insertIfNew({ sourceId, externalId: '1', url: 'https://a.com/1', title: 'Test' })!;

    repo.markPublished(item.id, 12345);

    const updated = repo.getById(item.id)!;
    expect(updated.published).toBe(1);
    expect(updated.telegram_message_id).toBe(12345);
    expect(updated.published_at).toBeTruthy();
  });

  it('updateClassification sets category and content_type', () => {
    const item = repo.insertIfNew({ sourceId, externalId: '1', url: 'https://a.com/1', title: 'Test' })!;

    repo.updateClassification(item.id, {
      category: 'ai',
      contentType: 'article',
      classifiedBy: 'heuristic',
      score: 0.85,
    });

    const updated = repo.getById(item.id)!;
    expect(updated.category).toBe('ai');
    expect(updated.content_type).toBe('article');
    expect(updated.classified_by).toBe('heuristic');
    expect(updated.score).toBe(0.85);
  });

  it('saveSummary caches summary text', () => {
    const item = repo.insertIfNew({ sourceId, externalId: '1', url: 'https://a.com/1', title: 'Test' })!;

    repo.saveSummary(item.id, 'This is a summary.');

    const updated = repo.getById(item.id)!;
    expect(updated.summary).toBe('This is a summary.');
  });
});
