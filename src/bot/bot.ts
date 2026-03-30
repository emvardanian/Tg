import { Bot } from 'grammy';
import { logger } from '../logger.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.catch((err) => {
    logger.error('Bot error', { error: err.message });
  });

  return bot;
}
