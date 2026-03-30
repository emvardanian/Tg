import type { Database } from '../db.js';

interface SourceScore {
  source_id: number;
  avg_score: number;
  total_feedback: number;
}

export class FeedbackRepo {
  constructor(private db: Database) {}

  add(itemId: number, score: 1 | -1): void {
    this.db.prepare('INSERT INTO feedback (item_id, score) VALUES (?, ?)').run(itemId, score);

    // Update item score
    const agg = this.db
      .prepare('SELECT COALESCE(AVG(score), 0) as avg FROM feedback WHERE item_id = ?')
      .get(itemId) as { avg: number };

    this.db.prepare('UPDATE items SET feedback_score = ? WHERE id = ?').run(agg.avg, itemId);
  }

  getSourceScores(): SourceScore[] {
    return this.db
      .prepare(
        `SELECT
          i.source_id,
          AVG(f.score) as avg_score,
          COUNT(f.id) as total_feedback
        FROM feedback f
        JOIN items i ON f.item_id = i.id
        GROUP BY i.source_id
        HAVING total_feedback > 10`
      )
      .all() as SourceScore[];
  }
}
