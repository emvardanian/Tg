import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { createDatabase, type Database } from '../../src/storage/db.js';

describe('createDatabase', () => {
  let db: Database;
  let tmpPath: string | undefined;

  afterEach(() => {
    db?.close();
    if (tmpPath) {
      try { unlinkSync(tmpPath); unlinkSync(tmpPath + '-wal'); unlinkSync(tmpPath + '-shm'); } catch {}
      tmpPath = undefined;
    }
  });

  it('creates all tables in-memory', () => {
    db = createDatabase(':memory:');

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const names = tables.map((t) => t.name);
    expect(names).toContain('sources');
    expect(names).toContain('items');
    expect(names).toContain('feedback');
    expect(names).toContain('link_mentions');
    expect(names).toContain('discovery_candidates');
    expect(names).toContain('api_usage');
  });

  it('creates all indexes', () => {
    db = createDatabase(':memory:');

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_items_url');
    expect(names).toContain('idx_items_published');
    expect(names).toContain('idx_items_source');
    expect(names).toContain('idx_link_mentions_domain');
    expect(names).toContain('idx_api_usage_date');
    expect(names).toContain('idx_feedback_item');
  });

  it('enables WAL mode', () => {
    tmpPath = '/tmp/test-wal-' + Date.now() + '.db';
    db = createDatabase(tmpPath);
    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
  });
});

describe('createDatabase pragmas', () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it('sets busy_timeout to 5000', () => {
    db = createDatabase(':memory:');
    const result = db.pragma('busy_timeout', { simple: true });
    expect(result).toBe(5000);
  });

  it('sets synchronous to NORMAL (1)', () => {
    db = createDatabase(':memory:');
    const result = db.pragma('synchronous', { simple: true });
    // 0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA
    expect(result).toBe(1);
  });
});
