import type { Database } from '../db.js';
import { extractDomain } from '../../url.js';

export interface Source {
  id: number;
  name: string;
  url: string;
  domain: string;
  type: string;
  category: string | null;
  enabled: number;
  added_via: string;
  last_fetched_at: string | null;
  last_item_id: string | null;
  fetch_errors: number;
  created_at: string;
}

interface SourceConfigInput {
  name: string;
  url: string;
  type: string;
  category?: string;
}

export class SourcesRepo {
  constructor(private db: Database) {}

  upsertFromConfig(input: SourceConfigInput): void {
    const domain = extractDomain(input.url);
    this.db.prepare(`
      INSERT INTO sources (name, url, domain, type, category, added_via)
      VALUES (?, ?, ?, ?, ?, 'config')
      ON CONFLICT(url) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        category = excluded.category,
        domain = excluded.domain
    `).run(input.name, input.url, domain, input.type, input.category ?? null);
  }

  getAll(): Source[] {
    return this.db.prepare('SELECT * FROM sources ORDER BY name').all() as Source[];
  }

  getEnabled(): Source[] {
    return this.db.prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY name').all() as Source[];
  }

  getById(id: number): Source | undefined {
    return this.db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source | undefined;
  }

  getByType(type: string): Source[] {
    return this.db.prepare('SELECT * FROM sources WHERE enabled = 1 AND type = ? ORDER BY name').all(type) as Source[];
  }

  setEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  recordFetchSuccess(id: number, lastItemId: string): void {
    this.db.prepare(`
      UPDATE sources
      SET last_fetched_at = datetime('now'), last_item_id = ?, fetch_errors = 0
      WHERE id = ?
    `).run(lastItemId, id);
  }

  recordFetchError(id: number): void {
    this.db.prepare(`
      UPDATE sources SET fetch_errors = fetch_errors + 1 WHERE id = ?
    `).run(id);

    // Auto-disable after 5 consecutive errors
    this.db.prepare(`
      UPDATE sources SET enabled = 0 WHERE id = ? AND fetch_errors >= 5
    `).run(id);
  }
}
