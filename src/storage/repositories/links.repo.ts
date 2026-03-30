import type { Database } from '../db.js';

export interface LinkMention {
  id: number;
  source_id: number;
  mentioned_domain: string;
  mentioned_url: string;
  item_id: number | null;
  created_at: string;
}

export interface WeeklyCandidate {
  domain: string;
  total_mentions: number;
  unique_sources: number;
  mentioned_by: string;
}

export interface DiscoveryCandidate {
  id: number;
  domain: string;
  mention_count: number;
  mentioned_by: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
}

export class LinksRepo {
  constructor(private db: Database) {}

  addMention(sourceId: number, domain: string, url: string, itemId?: number): void {
    this.db
      .prepare(
        'INSERT INTO link_mentions (source_id, mentioned_domain, mentioned_url, item_id) VALUES (?, ?, ?, ?)',
      )
      .run(sourceId, domain, url, itemId ?? null);
  }

  getWeeklyCandidates(): WeeklyCandidate[] {
    return this.db
      .prepare(
        `SELECT
          mentioned_domain AS domain,
          COUNT(*) AS total_mentions,
          COUNT(DISTINCT source_id) AS unique_sources,
          GROUP_CONCAT(DISTINCT source_id) AS mentioned_by
        FROM link_mentions
        WHERE created_at >= datetime('now', '-7 days')
          AND mentioned_domain NOT IN (
            SELECT domain FROM sources
          )
          AND mentioned_domain NOT IN (
            SELECT domain FROM discovery_candidates WHERE status IN ('approved', 'rejected')
          )
        GROUP BY mentioned_domain
        HAVING unique_sources >= 2
        ORDER BY total_mentions DESC`,
      )
      .all() as WeeklyCandidate[];
  }

  upsertCandidate(domain: string, mentionedBy: number[]): void {
    const mentionedByStr = mentionedBy.join(',');
    this.db
      .prepare(
        `INSERT INTO discovery_candidates (domain, mention_count, mentioned_by)
        VALUES (?, ?, ?)
        ON CONFLICT(domain) DO UPDATE SET
          mention_count = mention_count + excluded.mention_count,
          mentioned_by = excluded.mentioned_by,
          last_seen_at = datetime('now')`,
      )
      .run(domain, mentionedBy.length, mentionedByStr);
  }

  getPendingCandidates(): DiscoveryCandidate[] {
    return this.db
      .prepare(
        "SELECT * FROM discovery_candidates WHERE status = 'pending' ORDER BY mention_count DESC",
      )
      .all() as DiscoveryCandidate[];
  }

  setCandidateStatus(candidateId: number, status: string): void {
    this.db.prepare('UPDATE discovery_candidates SET status = ? WHERE id = ?').run(status, candidateId);
  }

  cleanOldMentions(): void {
    this.db.prepare("DELETE FROM link_mentions WHERE created_at < datetime('now', '-30 days')").run();
  }
}
