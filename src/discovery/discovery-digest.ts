import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { LinksRepo } from '../storage/repositories/links.repo.js';
import type { SourcesRepo } from '../storage/repositories/sources.repo.js';
import { logger } from '../logger.js';

export class DiscoveryDigest {
  constructor(
    private bot: Bot,
    private adminChatId: string,
    private linksRepo: LinksRepo,
    private sourcesRepo: SourcesRepo,
  ) {}

  async sendWeeklyDigest(): Promise<void> {
    const candidates = this.linksRepo.getWeeklyCandidates();

    if (candidates.length === 0) {
      await this.bot.api.sendMessage(this.adminChatId, '🔍 Нових авторів цього тижня не знайдено.');
      return;
    }

    let message = '🔍 **Нові автори цього тижня:**\n\n';

    for (const c of candidates) {
      message += `• **${c.domain}** — ${c.total_mentions} згадок від ${c.unique_sources} джерел\n`;

      // Upsert into discovery_candidates
      this.linksRepo.upsertCandidate(
        c.domain,
        c.mentioned_by.split(',').map(Number),
      );
    }

    // Send with inline buttons for each candidate
    for (const c of candidates) {
      const pending = this.linksRepo.getPendingCandidates().find(
        (p) => p.domain === c.domain,
      );
      if (!pending) continue;

      const keyboard = new InlineKeyboard()
        .text('✅ Add', `discovery:add:${pending.id}:${c.domain}`)
        .text('❌ Skip', `discovery:skip:${pending.id}`);

      await this.bot.api.sendMessage(
        this.adminChatId,
        `🔗 ${c.domain}\n📊 ${c.total_mentions} згадок від ${c.unique_sources} джерел`,
        { reply_markup: keyboard },
      );
    }

    // Clean old mentions
    this.linksRepo.cleanOldMentions();
    logger.info('Discovery digest sent', { candidateCount: candidates.length });
  }

  registerCallbacks(bot: Bot): void {
    bot.callbackQuery(/^discovery:add:(\d+):(.+)$/, async (ctx) => {
      const candidateId = parseInt(ctx.match![1], 10);
      const domain = ctx.match![2];

      // Try common RSS paths
      const feedUrl = await this.discoverFeed(domain);

      if (feedUrl) {
        this.sourcesRepo.upsertFromConfig({
          name: domain,
          url: feedUrl,
          type: 'rss',
        });
        this.linksRepo.setCandidateStatus(candidateId, 'approved');
        await ctx.answerCallbackQuery({ text: '✅ Додано!' });
        await ctx.editMessageText(`✅ ${domain} — додано (${feedUrl})`);
      } else {
        await ctx.answerCallbackQuery({ text: 'RSS не знайдено — введіть URL вручну через /add' });
        await ctx.editMessageText(`⚠️ ${domain} — RSS не знайдено. Використайте /add <url>`);
      }
    });

    bot.callbackQuery(/^discovery:skip:(\d+)$/, async (ctx) => {
      const candidateId = parseInt(ctx.match![1], 10);
      this.linksRepo.setCandidateStatus(candidateId, 'rejected');
      await ctx.answerCallbackQuery({ text: '❌ Пропущено' });
      await ctx.editMessageText('❌ Пропущено');
    });
  }

  private async discoverFeed(domain: string): Promise<string | null> {
    const paths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml'];

    for (const path of paths) {
      try {
        const url = `https://${domain}${path}`;
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const ct = res.headers.get('content-type') ?? '';
          if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
            return url;
          }
        }
      } catch {
        // Continue trying
      }
    }

    // Try HTML page for <link rel="alternate">
    try {
      const res = await fetch(`https://${domain}`, { signal: AbortSignal.timeout(5000) });
      const html = await res.text();
      const match = html.match(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]+href=["']([^"']+)/i);
      if (match?.[2]) {
        const feedUrl = match[2].startsWith('http') ? match[2] : `https://${domain}${match[2]}`;
        return feedUrl;
      }
    } catch {
      // No feed found
    }

    return null;
  }
}
