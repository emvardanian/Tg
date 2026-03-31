import type { Bot } from 'grammy';
import type { Item } from '../storage/repositories/items.repo.js';
import type { Source } from '../storage/repositories/sources.repo.js';
import { formatMessage } from './formatter.js';
import { logger } from '../logger.js';

export class TelegramPublisher {
  constructor(
    private bot: Bot,
    private channelId: string,
    private getSource: (id: number) => Source | undefined,
  ) {}

  async publish(item: Item): Promise<number> {
    const source = this.getSource(item.source_id);

    const text = formatMessage({
      category: item.category ?? 'it',
      contentType: item.content_type ?? 'article',
      title: item.title,
      contentSnippet: item.content_snippet ?? undefined,
      summary: item.summary ?? undefined,
      url: item.url,
      sourceName: source?.name ?? 'Unknown',
      wordCount: item.word_count ?? undefined,
      stars: item.stars ?? undefined,
      starsToday: item.stars_today ?? undefined,
      upvotes: item.upvotes ?? undefined,
      comments: item.comments ?? undefined,
    });

    const msg = await this.bot.api.sendMessage(this.channelId, text, {
      link_preview_options: { is_disabled: true },
    });

    logger.info('Published item', { itemId: item.id, messageId: msg.message_id });
    return msg.message_id;
  }

  async sendNotification(adminChatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(adminChatId, text);
  }
}
