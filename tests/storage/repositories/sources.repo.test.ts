import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../../src/storage/db.js';
import { SourcesRepo, type Source } from '../../../src/storage/repositories/sources.repo.js';

describe('SourcesRepo', () => {
  let db: Database;
  let repo: SourcesRepo;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new SourcesRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('upserts a source from config', () => {
    repo.upsertFromConfig({
      name: 'Simon Willison',
      url: 'https://simonwillison.net/atom/everything/',
      type: 'rss',
      category: 'ai',
    });

    const sources = repo.getEnabled();
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('Simon Willison');
    expect(sources[0].domain).toBe('simonwillison.net');
    expect(sources[0].enabled).toBe(1);
  });

  it('updates existing source on re-upsert', () => {
    repo.upsertFromConfig({
      name: 'Old Name',
      url: 'https://example.com/feed',
      type: 'rss',
      category: 'it',
    });

    repo.upsertFromConfig({
      name: 'New Name',
      url: 'https://example.com/feed',
      type: 'rss',
      category: 'ai',
    });

    const sources = repo.getEnabled();
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('New Name');
    expect(sources[0].category).toBe('ai');
  });

  it('records fetch success', () => {
    repo.upsertFromConfig({ name: 'Test', url: 'https://example.com/feed', type: 'rss' });
    const source = repo.getEnabled()[0];

    repo.recordFetchError(source.id);
    repo.recordFetchError(source.id);
    repo.recordFetchSuccess(source.id, 'item-123');

    const updated = repo.getById(source.id)!;
    expect(updated.fetch_errors).toBe(0);
    expect(updated.last_item_id).toBe('item-123');
    expect(updated.last_fetched_at).toBeTruthy();
  });

  it('disables source after 5 consecutive errors', () => {
    repo.upsertFromConfig({ name: 'Flaky', url: 'https://flaky.com/feed', type: 'rss' });
    const source = repo.getEnabled()[0];

    for (let i = 0; i < 5; i++) {
      repo.recordFetchError(source.id);
    }

    const updated = repo.getById(source.id)!;
    expect(updated.fetch_errors).toBe(5);
    expect(updated.enabled).toBe(0);
  });

  it('getByType returns only matching type', () => {
    repo.upsertFromConfig({ name: 'RSS', url: 'https://a.com/feed', type: 'rss' });
    repo.upsertFromConfig({ name: 'HN', url: 'https://hn.com', type: 'hn' });

    const rss = repo.getByType('rss');
    expect(rss).toHaveLength(1);
    expect(rss[0].name).toBe('RSS');
  });

  it('setEnabled toggles source', () => {
    repo.upsertFromConfig({ name: 'Test', url: 'https://t.com/feed', type: 'rss' });
    const source = repo.getEnabled()[0];

    repo.setEnabled(source.id, false);
    expect(repo.getEnabled()).toHaveLength(0);

    repo.setEnabled(source.id, true);
    expect(repo.getEnabled()).toHaveLength(1);
  });

  it('getAll returns all sources including disabled', () => {
    repo.upsertFromConfig({ name: 'Active', url: 'https://a.com/feed', type: 'rss' });
    repo.upsertFromConfig({ name: 'Disabled', url: 'https://b.com/feed', type: 'rss' });

    const active = repo.getEnabled()[1]; // second source
    repo.setEnabled(active.id, false);

    expect(repo.getEnabled()).toHaveLength(1);
    expect(repo.getAll()).toHaveLength(2);
  });
});
