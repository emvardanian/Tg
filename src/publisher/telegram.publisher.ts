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
    let text: string;
    let parseMode: 'HTML' | undefined;

    if (item.pipeline_post) {
      text = item.pipeline_post;
      parseMode = 'HTML';
    } else {
      const source = this.getSource(item.source_id);
      text = formatMessage({
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
      parseMode = undefined;
    }

    // Use sendPhoto when pipeline produced an image URL
    if (item.pipeline_image_url && item.pipeline_post) {
      const caption = item.pipeline_caption ?? item.pipeline_post.slice(0, 1024);
      try {
        const msg = await this.bot.api.sendPhoto(this.channelId, item.pipeline_image_url, {
          caption,
          parse_mode: 'HTML',
        });
        logger.info('Published item with photo', { itemId: item.id, messageId: msg.message_id });
        return msg.message_id;
      } catch (err) {
        logger.warn('sendPhoto failed, falling back to sendMessage', {
          itemId: item.id,
          error: (err as Error).message,
        });
        // Fall through to sendMessage
      }
    }

    const msg = await this.bot.api.sendMessage(this.channelId, text, {
      parse_mode: parseMode,
      link_preview_options: { is_disabled: true },
    });

    logger.info('Published item', { itemId: item.id, messageId: msg.message_id });
    return msg.message_id;
  }

  async sendNotification(adminChatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(adminChatId, text);
  }
}
