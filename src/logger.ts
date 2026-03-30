import { createLogger, format, transports } from 'winston';

const logLevel = process.env.LOG_LEVEL ?? 'info';

export const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.json(),
  ),
  transports: [new transports.Console()],
});
