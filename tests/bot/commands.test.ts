import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerCommands } from '../../src/bot/commands.js';

function makeMockCtx(overrides: Record<string, any> = {}): any {
  return {
    chat: { id: 123, type: 'private' },
    match: '',
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockBot() {
  const handlers: Record<string, Function> = {};
  const middlewares: Function[] = [];
  return {
    command: vi.fn((name: string, handler: Function) => { handlers[name] = handler; }),
    use: vi.fn((handler: Function) => { middlewares.push(handler); }),
    _handlers: handlers,
    _middlewares: middlewares,
    async triggerMiddleware(ctx: any) {
      for (const mw of middlewares) {
        let nextCalled = false;
        await mw(ctx, async () => { nextCalled = true; });
        if (!nextCalled) return false;
      }
      return true;
    },
    async triggerCommand(name: string, ctx: any) {
      await this.triggerMiddleware(ctx);
      if (handlers[name]) await handlers[name](ctx);
    },
  };
}

describe('Commands', () => {
  let bot: ReturnType<typeof makeMockBot>;
  let deps: any;

  beforeEach(() => {
    bot = makeMockBot();
    deps = {
      sourcesRepo: {
        upsertFromConfig: vi.fn(),
        getEnabled: vi.fn().mockReturnValue([
          { id: 1, name: 'HN', type: 'hackernews', category: 'it', enabled: 1 },
        ]),
        getAll: vi.fn().mockReturnValue([
          { id: 1, name: 'HN', type: 'hackernews', category: 'it', enabled: 0 },
        ]),
        setEnabled: vi.fn(),
      },
      itemsRepo: {},
      usageRepo: {
        getWeeklyStats: vi.fn().mockReturnValue({ totalCalls: 5, totalCostUsd: 0.0012 }),
        getMonthlySpend: vi.fn().mockReturnValue(1.23),
      },
      adminChatId: '123',
    };
    registerCommands(bot as any, deps);
  });

  it('blocks unauthorized users', async () => {
    const ctx = makeMockCtx({ chat: { id: 999, type: 'private' } });
    await bot.triggerMiddleware(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Доступ заборонено'));
  });

  it('/add with valid URL adds source', async () => {
    const ctx = makeMockCtx({ match: 'https://blog.example.com/feed' });
    await bot.triggerCommand('add', ctx);
    expect(deps.sourcesRepo.upsertFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://blog.example.com/feed', type: 'rss' }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Додано'));
  });

  it('/add without URL shows usage', async () => {
    const ctx = makeMockCtx({ match: '' });
    await bot.triggerCommand('add', ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/add'));
    expect(deps.sourcesRepo.upsertFromConfig).not.toHaveBeenCalled();
  });

  it('/sources lists enabled sources', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCommand('sources', ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('HN'));
  });

  it('/mute disables a source', async () => {
    const ctx = makeMockCtx({ match: 'HN' });
    await bot.triggerCommand('mute', ctx);
    expect(deps.sourcesRepo.setEnabled).toHaveBeenCalledWith(1, false);
  });

  it('/unmute enables a source', async () => {
    const ctx = makeMockCtx({ match: 'HN' });
    await bot.triggerCommand('unmute', ctx);
    expect(deps.sourcesRepo.setEnabled).toHaveBeenCalledWith(1, true);
  });

  it('/stats shows AI calls and cost', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCommand('stats', ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('5'));
  });
});
