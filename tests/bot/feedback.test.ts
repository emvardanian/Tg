import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFeedback } from '../../src/bot/feedback.js';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'A short summary.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    };
  },
}));

// Mock article extractor
vi.mock('@extractus/article-extractor', () => ({
  extract: vi.fn().mockResolvedValue({ content: 'Full article content here.' }),
}));

function makeMockBot() {
  const handlers: Record<string, { pattern: RegExp; fn: Function }[]> = {};
  return {
    callbackQuery: vi.fn((pattern: RegExp, handler: Function) => {
      const key = pattern.source;
      if (!handlers[key]) handlers[key] = [];
      handlers[key].push({ pattern, fn: handler });
    }),
    _handlers: handlers,
    async triggerCallback(queryData: string, ctx: any) {
      for (const list of Object.values(handlers)) {
        for (const h of list) {
          const m = queryData.match(h.pattern);
          if (m) {
            ctx.match = m;
            await h.fn(ctx);
            return;
          }
        }
      }
    },
  };
}

function makeMockCtx(overrides: Record<string, any> = {}): any {
  return {
    match: null,
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    callbackQuery: { message: { message_id: 100 } },
    ...overrides,
  };
}

describe('Feedback', () => {
  let bot: ReturnType<typeof makeMockBot>;
  let deps: any;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = makeMockBot();
    deps = {
      feedbackRepo: { add: vi.fn() },
      itemsRepo: {
        getById: vi.fn().mockReturnValue({ id: 1, url: 'https://a.com/1', title: 'Test', summary: null, content_snippet: null }),
        saveSummary: vi.fn(),
      },
      usageRepo: {
        canUseAI: vi.fn().mockReturnValue(true),
        log: vi.fn(),
      },
      anthropicApiKey: 'fake-key',
      monthlyLimitUsd: 5,
    };
    registerFeedback(bot as any, deps);
  });

  it('records upvote', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCallback('vote:1:up', ctx);
    expect(deps.feedbackRepo.add).toHaveBeenCalledWith(1, 1);
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('records downvote', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCallback('vote:1:down', ctx);
    expect(deps.feedbackRepo.add).toHaveBeenCalledWith(1, -1);
  });

  it('returns cached summary', async () => {
    deps.itemsRepo.getById.mockReturnValue({
      id: 1, url: 'https://a.com/1', title: 'Test', summary: 'Cached summary.', content_snippet: null,
    });
    const ctx = makeMockCtx();
    await bot.triggerCallback('summarize:1', ctx);
    expect(ctx.reply).toHaveBeenCalledWith('Cached summary.', expect.any(Object));
  });

  it('denies summarize when budget exhausted', async () => {
    deps.usageRepo.canUseAI.mockReturnValue(false);
    const ctx = makeMockCtx();
    await bot.triggerCallback('summarize:1', ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Бюджет') }),
    );
    expect(deps.itemsRepo.saveSummary).not.toHaveBeenCalled();
  });

  it('generates and caches summary via AI', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCallback('summarize:1', ctx);
    expect(deps.itemsRepo.saveSummary).toHaveBeenCalledWith(1, 'A short summary.');
    expect(ctx.reply).toHaveBeenCalledWith('A short summary.', expect.any(Object));
  });
});
