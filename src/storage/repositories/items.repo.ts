import type { Database } from '../db.js';
import { normalizeUrl } from '../../url.js';

export interface Item {
  id: number;
  source_id: number;
  external_id: string | null;
  url: string;
  url_normalized: string;
  title: string;
  content_snippet: string | null;
  word_count: number | null;
  category: string | null;
  content_type: string | null;
  summary: string | null;
  classified_by: string | null;
  classifier_score: number;
  feedback_score: number;
  score: number;
  published: number;
  telegram_message_id: number | null;
  discovered_at: string;
  published_at: string | null;
}

interface InsertInput {
  sourceId: number;
  externalId?: string;
  url: string;
  title: string;
  contentSnippet?: string;
  wordCount?: number;
}

interface ClassificationInput {
  category: string;
  contentType: string;
  classifiedBy: 'heuristic' | 'ai';
  score: number;
}

export class ItemsRepo {
  private insertStmt;
  private getByIdStmt;

  constructor(private db: Database) {
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO items (source_id, external_id, url, url_normalized, title, content_snippet, word_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.getByIdStmt = db.prepare('SELECT * FROM items WHERE id = ?');
  }

  insertIfNew(input: InsertInput): Item | null {
    const urlNormalized = normalizeUrl(input.url);
    const result = this.insertStmt.run(
      input.sourceId,
      input.externalId ?? null,
      input.url,
      urlNormalized,
      input.title,
      input.contentSnippet ?? null,
      input.wordCount ?? null,
    );

    if (result.changes === 0) return null; // duplicate
    return this.getByIdStmt.get(result.lastInsertRowid) as Item;
  }

  getById(id: number): Item | undefined {
    return this.getByIdStmt.get(id) as Item | undefined;
  }

  getUnpublished(limit: number): Item[] {
    return this.db
      .prepare('SELECT * FROM items WHERE published = 0 ORDER BY score DESC, discovered_at ASC LIMIT ?')
      .all(limit) as Item[];
  }

  markPublished(id: number, telegramMessageId: number): void {
    this.db
      .prepare("UPDATE items SET published = 1, telegram_message_id = ?, published_at = datetime('now') WHERE id = ?")
      .run(telegramMessageId, id);
  }

  updateClassification(id: number, input: ClassificationInput): void {
    this.db
      .prepare('UPDATE items SET category = ?, content_type = ?, classified_by = ?, classifier_score = ? WHERE id = ?')
      .run(input.category, input.contentType, input.classifiedBy, input.score, id);
  }

  saveSummary(id: number, summary: string): void {
    this.db.prepare('UPDATE items SET summary = ? WHERE id = ?').run(summary, id);
  }

  findByNormalizedUrl(url: string): Item | undefined {
    const normalized = normalizeUrl(url);
    return this.db.prepare('SELECT * FROM items WHERE url_normalized = ?').get(normalized) as Item | undefined;
  }

  addSighting(itemId: number, sourceId: number, meta?: { upvotes?: number; comments?: number }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO item_sightings (item_id, source_id, meta)
      VALUES (?, ?, ?)
    `).run(itemId, sourceId, meta ? JSON.stringify(meta) : null);
  }

  getSightings(itemId: number): Array<{ source_name: string; meta: string | null }> {
    return this.db.prepare(`
      SELECT s.name as source_name, si.meta
      FROM item_sightings si
      JOIN sources s ON si.source_id = s.id
      WHERE si.item_id = ?
    `).all(itemId) as any[];
  }
}
