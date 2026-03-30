import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { FeedbackRepo } from '../storage/repositories/feedback.repo.js';
import type { ItemsRepo } from '../storage/repositories/items.repo.js';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
import Anthropic from '@anthropic-ai/sdk';
import { extract } from '@extractus/article-extractor';
import { calculateCost } from '../pricing.js';
import { logger } from '../logger.js';

interface FeedbackDeps {
  feedbackRepo: FeedbackRepo;
  itemsRepo: ItemsRepo;
  usageRepo: UsageRepo;
  anthropicApiKey: string;
  monthlyLimitUsd: number;
}

export function registerFeedback(bot: Bot, deps: FeedbackDeps): void {
  const { feedbackRepo, itemsRepo, usageRepo, anthropicApiKey, monthlyLimitUsd } = deps;
  const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });

  bot.callbackQuery(/^vote:(\d+):(up|down)$/, async (ctx) => {
    const itemId = parseInt(ctx.match![1], 10);
    const direction = ctx.match![2];
    const score = direction === 'up' ? 1 : -1;

    feedbackRepo.add(itemId, score as 1 | -1);
    await ctx.answerCallbackQuery({ text: direction === 'up' ? '\u{1F44D}' : '\u{1F44E}' });

    // Remove vote buttons, keep summarize if applicable
    const item = itemsRepo.getById(itemId);
    if (item && (item.word_count ?? 0) > 400) {
      const keyboard = new InlineKeyboard().text('\u{1F4DD} Summarize', `summarize:${itemId}`);
      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    } else {
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    }
  });

  bot.callbackQuery(/^summarize:(\d+)$/, async (ctx) => {
    const itemId = parseInt(ctx.match![1], 10);
    const item = itemsRepo.getById(itemId);

    if (!item) {
      await ctx.answerCallbackQuery({ text: '\u274C \u0415\u043b\u0435\u043c\u0435\u043d\u0442 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e' });
      return;
    }

    // Return cached summary
    if (item.summary) {
      await ctx.reply(item.summary, {
        reply_parameters: { message_id: ctx.callbackQuery.message?.message_id ?? 0 },
      });
      await ctx.answerCallbackQuery();
      return;
    }

    // Check budget
    if (!usageRepo.canUseAI(monthlyLimitUsd)) {
      await ctx.answerCallbackQuery({ text: '\u{1F4B0} \u0411\u044e\u0434\u0436\u0435\u0442 \u0432\u0438\u0447\u0435\u0440\u043f\u0430\u043d\u043e' });
      return;
    }

    await ctx.answerCallbackQuery({ text: '\u231B \u0413\u0435\u043d\u0435\u0440\u0443\u044e \u0440\u0435\u0437\u044e\u043c\u0435...' });

    try {
      // Extract full article
      const article = await extract(item.url);
      const text = article?.content ?? item.content_snippet ?? item.title;

      const response = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Summarize this article in 3-5 sentences in Ukrainian:\n\n${text.slice(0, 4000)}`,
          },
        ],
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      // Cache and log
      itemsRepo.saveSummary(itemId, summary);

      const costUsd = calculateCost(response.usage.input_tokens, response.usage.output_tokens);
      usageRepo.log({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd,
        itemId,
      });

      await ctx.reply(summary, {
        reply_parameters: { message_id: ctx.callbackQuery.message?.message_id ?? 0 },
      });
    } catch (err) {
      logger.error('Summary generation failed', { itemId, error: (err as Error).message });
      await ctx.reply('\u274C \u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0433\u0435\u043d\u0435\u0440\u0443\u0432\u0430\u0442\u0438 \u0440\u0435\u0437\u044e\u043c\u0435');
    }
  });
}
