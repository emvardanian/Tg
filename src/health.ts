import { createServer, type Server } from 'http';
import type { Database } from './storage/db.js';
import type { SourcesRepo } from './storage/repositories/sources.repo.js';
import type { UsageRepo } from './storage/repositories/usage.repo.js';
import type { PublishQueue } from './publisher/queue.js';
import { statSync } from 'fs';
import { logger } from './logger.js';

interface HealthDeps {
  db: Database;
  sourcesRepo: SourcesRepo;
  usageRepo: UsageRepo;
  publishQueue: PublishQueue;
  dbPath: string;
  startTime: number;
}

export function createHealthServer(deps: HealthDeps, port: number): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const dbSize = (() => { try { return statSync(deps.dbPath).size; } catch { return 0; } })();
      const body = JSON.stringify({
        uptime: Math.floor((Date.now() - deps.startTime) / 1000),
        sources: deps.sourcesRepo.getEnabled().length,
        queueSize: deps.publishQueue.size,
        monthlySpend: deps.usageRepo.getMonthlySpend(),
        dbSizeBytes: dbSize,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => logger.info(`Health server on :${port}`));
  return server;
}
