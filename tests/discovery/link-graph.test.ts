import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../src/storage/db.js';
import { LinksRepo } from '../../src/storage/repositories/links.repo.js';
import { processLinks, DOMAIN_STOP_LIST } from '../../src/discovery/link-graph.js';

describe('processLinks', () => {
  let db: Database;
  let linksRepo: LinksRepo;

  beforeEach(() => {
    db = createDatabase(':memory:');
    linksRepo = new LinksRepo(db);
    db.prepare("INSERT INTO sources (name, url, domain, type) VALUES ('S1', 'https://s1.com/feed', 's1.com', 'rss')").run();
  });

  afterEach(() => {
    db.close();
  });

  it('saves link mentions from extracted links', () => {
    const links = [
      'https://interesting-blog.com/post',
      'https://another-site.org/article',
    ];

    processLinks(linksRepo, 1, links);

    const candidates = db.prepare('SELECT * FROM link_mentions').all();
    expect(candidates).toHaveLength(2);
  });

  it('filters out stop-list domains', () => {
    const links = [
      'https://github.com/some/repo',
      'https://twitter.com/user',
      'https://youtube.com/watch?v=abc',
      'https://real-blog.com/post',
    ];

    processLinks(linksRepo, 1, links);

    const mentions = db.prepare('SELECT * FROM link_mentions').all() as any[];
    expect(mentions).toHaveLength(1);
    expect(mentions[0].mentioned_domain).toBe('real-blog.com');
  });

  it('deduplicates same domain within one batch', () => {
    const links = [
      'https://cool-blog.com/post-1',
      'https://cool-blog.com/post-2',
    ];

    processLinks(linksRepo, 1, links);

    const mentions = db.prepare('SELECT * FROM link_mentions').all();
    expect(mentions).toHaveLength(1);
  });
});

describe('DOMAIN_STOP_LIST', () => {
  it('contains common noise domains', () => {
    expect(DOMAIN_STOP_LIST).toContain('github.com');
    expect(DOMAIN_STOP_LIST).toContain('twitter.com');
    expect(DOMAIN_STOP_LIST).toContain('youtube.com');
    expect(DOMAIN_STOP_LIST).toContain('wikipedia.org');
    expect(DOMAIN_STOP_LIST).toContain('medium.com');
  });
});
