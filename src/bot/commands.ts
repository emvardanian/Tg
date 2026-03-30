import type { Bot } from 'grammy';
import type { Database } from '../storage/db.js';
import type { SourcesRepo } from '../storage/repositories/sources.repo.js';
import type { ItemsRepo } from '../storage/repositories/items.repo.js';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
import { extractDomain } from '../url.js';

interface CommandDeps {
  db: Database;
  sourcesRepo: SourcesRepo;
  itemsRepo: ItemsRepo;
  usageRepo: UsageRepo;
  adminChatId: string;
}

export function registerCommands(bot: Bot, deps: CommandDeps): void {
  const { db, sourcesRepo, itemsRepo, usageRepo, adminChatId } = deps;

  // Only allow admin
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id.toString();
    if (chatId === adminChatId) {
      await next();
    } else if (ctx.chat?.type !== 'private') {
      // Channel/group messages — only allow from configured channel
      // Bot shouldn't process commands in channels anyway
      return;
    } else {
      await ctx.reply('⛔ Доступ заборонено');
    }
  });

  bot.command('add', async (ctx) => {
    const url = ctx.match?.trim();
    if (!url) {
      await ctx.reply('\u0412\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043d\u043d\u044f: /add <rss_url>');
      return;
    }

    try {
      const domain = extractDomain(url);
      sourcesRepo.upsertFromConfig({
        name: domain,
        url,
        type: 'rss',
        category: undefined,
      });
      await ctx.reply(`\u2705 \u0414\u043e\u0434\u0430\u043d\u043e: ${domain}`);
    } catch {
      await ctx.reply('\u274C \u041d\u0435\u0432\u0430\u043b\u0456\u0434\u043d\u0438\u0439 URL');
    }
  });

  bot.command('sources', async (ctx) => {
    const sources = sourcesRepo.getEnabled();
    if (sources.length === 0) {
      await ctx.reply('\u041d\u0435\u043c\u0430\u0454 \u0430\u043a\u0442\u0438\u0432\u043d\u0438\u0445 \u0434\u0436\u0435\u0440\u0435\u043b.');
      return;
    }

    const lines = sources.map((s) =>
      `\u2022 ${s.name} (${s.type})${s.category ? ` [${s.category}]` : ''}`
    );
    await ctx.reply(`\u{1F4E1} \u0410\u043a\u0442\u0438\u0432\u043d\u0456 \u0434\u0436\u0435\u0440\u0435\u043b\u0430 (${sources.length}):\n\n${lines.join('\n')}`);
  });

  bot.command('mute', async (ctx) => {
    const name = ctx.match?.trim();
    if (!name) {
      await ctx.reply('\u0412\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043d\u043d\u044f: /mute <\u043d\u0430\u0437\u0432\u0430 \u0434\u0436\u0435\u0440\u0435\u043b\u0430>');
      return;
    }
    const source = sourcesRepo.getEnabled().find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (!source) {
      await ctx.reply(`\u274C \u0414\u0436\u0435\u0440\u0435\u043b\u043e "${name}" \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e`);
      return;
    }
    sourcesRepo.setEnabled(source.id, false);
    await ctx.reply(`\u{1F507} ${source.name} \u0432\u0438\u043c\u043a\u043d\u0435\u043d\u043e`);
  });

  bot.command('unmute', async (ctx) => {
    const name = ctx.match?.trim();
    if (!name) {
      await ctx.reply('\u0412\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043d\u043d\u044f: /unmute <\u043d\u0430\u0437\u0432\u0430 \u0434\u0436\u0435\u0440\u0435\u043b\u0430>');
      return;
    }
    const source = sourcesRepo.getAll().find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (!source) {
      await ctx.reply(`\u274C \u0414\u0436\u0435\u0440\u0435\u043b\u043e "${name}" \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e`);
      return;
    }
    sourcesRepo.setEnabled(source.id, true);
    await ctx.reply(`\u{1F50A} ${source.name} \u0443\u0432\u0456\u043c\u043a\u043d\u0435\u043d\u043e`);
  });

  bot.command('stats', async (ctx) => {
    const weeklyStats = usageRepo.getWeeklyStats();
    const sources = sourcesRepo.getEnabled();

    await ctx.reply(
      `\u{1F4CA} \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0437\u0430 \u0442\u0438\u0436\u0434\u0435\u043d\u044c:\n` +
      `\u2022 AI \u0432\u0438\u043a\u043b\u0438\u043a\u0438: ${weeklyStats.totalCalls}\n` +
      `\u2022 \u0412\u0438\u0442\u0440\u0430\u0447\u0435\u043d\u043e: $${weeklyStats.totalCostUsd.toFixed(4)}\n` +
      `\u2022 \u0410\u043a\u0442\u0438\u0432\u043d\u0438\u0445 \u0434\u0436\u0435\u0440\u0435\u043b: ${sources.length}`
    );
  });

  bot.command('cost', async (ctx) => {
    const monthlySpend = usageRepo.getMonthlySpend();
    const limit = parseFloat(process.env.AI_MONTHLY_LIMIT_USD ?? '5');

    await ctx.reply(
      `\u{1F4B0} \u0412\u0438\u0442\u0440\u0430\u0442\u0438 \u0437\u0430 \u043c\u0456\u0441\u044f\u0446\u044c:\n` +
      `$${monthlySpend.toFixed(4)} / $${limit.toFixed(2)} (${((monthlySpend / limit) * 100).toFixed(1)}%)`
    );
  });

  bot.command('saved', async (ctx) => {
    const arg = ctx.match?.trim();

    if (arg === 'clear') {
      db.prepare('DELETE FROM saved_items').run();
      await ctx.reply('🗑 Збережені елементи очищено');
      return;
    }

    const saved = db.prepare(`
      SELECT i.title, i.url FROM saved_items si
      JOIN items i ON si.item_id = i.id
      ORDER BY si.saved_at DESC LIMIT 20
    `).all() as Array<{ title: string; url: string }>;

    if (saved.length === 0) {
      await ctx.reply('📭 Немає збережених елементів');
      return;
    }

    const lines = saved.map((s, i) => `${i + 1}. [${s.title}](${s.url})`);
    await ctx.reply(`🔖 Збережені (${saved.length}):\n\n${lines.join('\n')}`, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  });
}
