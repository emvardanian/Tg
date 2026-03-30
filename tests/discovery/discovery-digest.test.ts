import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryDigest } from '../../src/discovery/discovery-digest.js';

// Mock grammy InlineKeyboard
vi.mock('grammy', () => ({
  InlineKeyboard: class {
    text(label: string, data: string) { return this; }
  },
}));

function makeMockBot(apiOverrides: Record<string, any> = {}) {
  const handlers: { pattern: RegExp; fn: Function }[] = [];
  return {
    api: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      ...apiOverrides,
    },
    callbackQuery: vi.fn((pattern: RegExp, handler: Function) => {
      handlers.push({ pattern, fn: handler });
    }),
    _handlers: handlers,
    async triggerCallback(queryData: string, ctx: any) {
      for (const h of handlers) {
        const m = queryData.match(h.pattern);
        if (m) {
          ctx.match = m;
          await h.fn(ctx);
          return;
        }
      }
    },
  };
}

describe('DiscoveryDigest', () => {
  let bot: ReturnType<typeof makeMockBot>;
  let linksRepo: any;
  let sourcesRepo: any;

  beforeEach(() => {
    bot = makeMockBot();
    linksRepo = {
      getWeeklyCandidates: vi.fn().mockReturnValue([]),
      upsertCandidate: vi.fn(),
      getPendingCandidates: vi.fn().mockReturnValue([]),
      cleanOldMentions: vi.fn(),
      setCandidateStatus: vi.fn(),
    };
    sourcesRepo = {
      upsertFromConfig: vi.fn(),
    };
  });

  it('sends "no candidates" message when list is empty', async () => {
    const digest = new DiscoveryDigest(bot as any, '123', linksRepo, sourcesRepo);
    await digest.sendWeeklyDigest();
    expect(bot.api.sendMessage).toHaveBeenCalledWith('123', expect.stringContaining('не знайдено'));
  });

  it('sends candidate messages with inline buttons', async () => {
    linksRepo.getWeeklyCandidates.mockReturnValue([
      { domain: 'example.com', total_mentions: 5, unique_sources: 2, mentioned_by: '1,2' },
    ]);
    linksRepo.getPendingCandidates.mockReturnValue([
      { id: 10, domain: 'example.com', status: 'pending' },
    ]);
    const digest = new DiscoveryDigest(bot as any, '123', linksRepo, sourcesRepo);
    await digest.sendWeeklyDigest();
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      '123',
      expect.stringContaining('example.com'),
      expect.any(Object),
    );
    expect(linksRepo.cleanOldMentions).toHaveBeenCalled();
  });

  describe('registerCallbacks', () => {
    const mockFetch = vi.fn();
    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockFetch.mockResolvedValue({ ok: false });
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('discovery:skip marks candidate as rejected', async () => {
      const digest = new DiscoveryDigest(bot as any, '123', linksRepo, sourcesRepo);
      digest.registerCallbacks(bot as any);

      const ctx = {
        match: null,
        answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
        editMessageText: vi.fn().mockResolvedValue(undefined),
      };
      await bot.triggerCallback('discovery:skip:10', ctx);
      expect(linksRepo.setCandidateStatus).toHaveBeenCalledWith(10, 'rejected');
    });

    it('discovery:add with no feed found tells user to use /add', async () => {
      // All fetch calls fail → no feed found
      mockFetch.mockResolvedValue({ ok: false });
      const digest = new DiscoveryDigest(bot as any, '123', linksRepo, sourcesRepo);
      digest.registerCallbacks(bot as any);

      const ctx = {
        match: null,
        answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
        editMessageText: vi.fn().mockResolvedValue(undefined),
      };
      await bot.triggerCallback('discovery:add:10:example.com', ctx);
      expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('/add'));
      expect(sourcesRepo.upsertFromConfig).not.toHaveBeenCalled();
    });
  });
});
