import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFeedback } from '../../src/bot/feedback.js';

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

  it('clears keyboard after vote', async () => {
    const ctx = makeMockCtx();
    await bot.triggerCallback('vote:1:up', ctx);
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
  });
});
