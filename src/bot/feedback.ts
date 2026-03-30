import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { FeedbackRepo } from '../storage/repositories/feedback.repo.js';
import { logger } from '../logger.js';

interface FeedbackDeps {
  feedbackRepo: FeedbackRepo;
}

export function registerFeedback(bot: Bot, deps: FeedbackDeps): void {
  const { feedbackRepo } = deps;

  bot.callbackQuery(/^vote:(\d+):(up|down)$/, async (ctx) => {
    const itemId = parseInt(ctx.match![1], 10);
    const direction = ctx.match![2];
    const score = direction === 'up' ? 1 : -1;

    feedbackRepo.add(itemId, score as 1 | -1);
    await ctx.answerCallbackQuery({ text: direction === 'up' ? '\u{1F44D}' : '\u{1F44E}' });
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
  });
}
