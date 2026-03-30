import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../../src/storage/db.js';
import { UsageRepo } from '../../../src/storage/repositories/usage.repo.js';

describe('UsageRepo', () => {
  let db: Database;
  let repo: UsageRepo;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new UsageRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('logs usage and calculates monthly spend', () => {
    repo.log({ inputTokens: 300, outputTokens: 30, costUsd: 0.0003 });
    repo.log({ inputTokens: 1500, outputTokens: 200, costUsd: 0.002 });

    const spend = repo.getMonthlySpend();
    expect(spend).toBeCloseTo(0.0023, 4);
  });

  it('getWeeklyStats returns correct totals', () => {
    repo.log({ inputTokens: 100, outputTokens: 10, costUsd: 0.001 });
    repo.log({ inputTokens: 200, outputTokens: 20, costUsd: 0.002 });

    const stats = repo.getWeeklyStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.totalCostUsd).toBeCloseTo(0.003, 4);
  });

  it('canUseAI respects monthly limit', () => {
    expect(repo.canUseAI(5)).toBe(true);

    repo.log({ inputTokens: 100, outputTokens: 10, costUsd: 5.01 });

    expect(repo.canUseAI(5)).toBe(false);
  });
});
