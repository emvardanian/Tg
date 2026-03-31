import type { Database } from '../db.js';

interface LogInput {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  itemId?: number;
}

interface WeeklyStats {
  totalCalls: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export class UsageRepo {
  constructor(private db: Database) {}

  log(input: LogInput): void {
    this.db
      .prepare(
        "INSERT INTO api_usage (date, input_tokens, output_tokens, cost_usd, item_id) VALUES (date('now'), ?, ?, ?, ?)"
      )
      .run(input.inputTokens, input.outputTokens, input.costUsd, input.itemId ?? null);
  }

  getMonthlySpend(): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost_usd), 0) as total FROM api_usage WHERE date >= date('now', 'start of month')"
      )
      .get() as { total: number };
    return row.total;
  }

  getWeeklyStats(): WeeklyStats {
    const row = this.db
      .prepare(
        `SELECT
          COUNT(*) as totalCalls,
          COALESCE(SUM(cost_usd), 0) as totalCostUsd,
          COALESCE(SUM(input_tokens), 0) as totalInputTokens,
          COALESCE(SUM(output_tokens), 0) as totalOutputTokens
        FROM api_usage
        WHERE date >= date('now', '-7 days')`
      )
      .get() as WeeklyStats;
    return row;
  }

  getMonthlyCallCount(): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as total FROM api_usage WHERE date >= date('now', 'start of month')"
      )
      .get() as { total: number };
    return row.total;
  }

  canUseAI(monthlyLimitUsd: number): boolean {
    return this.getMonthlySpend() < monthlyLimitUsd;
  }
}
