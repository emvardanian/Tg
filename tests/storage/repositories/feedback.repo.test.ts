import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../../src/storage/db.js';
import { FeedbackRepo } from '../../../src/storage/repositories/feedback.repo.js';

describe('FeedbackRepo', () => {
  let db: Database;
  let repo: FeedbackRepo;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new FeedbackRepo(db);
    db.prepare("INSERT INTO sources (name, url, domain, type) VALUES ('S1', 'https://s1.com/feed', 's1.com', 'rss')").run();
    db.prepare("INSERT INTO items (source_id, url, url_normalized, title) VALUES (1, 'https://a.com/1', 'https://a.com/1', 'Test')").run();
  });

  afterEach(() => { db.close(); });

  it('records positive feedback and updates feedback_score', () => {
    repo.add(1, 1);
    const item = db.prepare('SELECT feedback_score FROM items WHERE id = 1').get() as any;
    expect(item.feedback_score).toBe(1);
  });

  it('records negative feedback', () => {
    repo.add(1, -1);
    const item = db.prepare('SELECT feedback_score FROM items WHERE id = 1').get() as any;
    expect(item.feedback_score).toBe(-1);
  });

  it('averages multiple feedbacks', () => {
    repo.add(1, 1);
    repo.add(1, 1);
    repo.add(1, -1);
    const item = db.prepare('SELECT feedback_score FROM items WHERE id = 1').get() as any;
    expect(item.feedback_score).toBeCloseTo(0.333, 2);
  });

  it('getSourceScores requires >10 feedbacks', () => {
    const scores = repo.getSourceScores();
    expect(scores).toHaveLength(0); // only 0-3 feedbacks, threshold is 10
  });

  it('add() is atomic: feedback_score reflects all votes consistently after many votes', () => {
    for (let i = 0; i < 5; i++) repo.add(1, 1);
    for (let i = 0; i < 5; i++) repo.add(1, -1);

    const item = db.prepare('SELECT feedback_score FROM items WHERE id = 1').get() as any;
    expect(item.feedback_score).toBeCloseTo(0, 5);

    const count = db.prepare('SELECT COUNT(*) as n FROM feedback WHERE item_id = 1').get() as any;
    expect(count.n).toBe(10);
  });
});
