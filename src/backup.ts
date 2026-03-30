import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from './logger.js';

export function backupDatabase(dbPath: string, maxBackups = 7): void {
  const backupDir = join(dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const backupPath = join(backupDir, `aggregator-${date}.db`);

  copyFileSync(dbPath, backupPath);
  logger.info('Database backed up', { path: backupPath });

  // Prune old backups
  const backups = readdirSync(backupDir)
    .filter((f) => f.startsWith('aggregator-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const old of backups.slice(maxBackups)) {
    unlinkSync(join(backupDir, old));
    logger.info('Deleted old backup', { file: old });
  }
}
