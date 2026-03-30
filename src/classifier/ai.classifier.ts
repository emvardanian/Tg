import Anthropic from '@anthropic-ai/sdk';
import { extract } from '@extractus/article-extractor';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
import { calculateCost } from '../pricing.js';
import { logger } from '../logger.js';

interface AiClassifyInput {
  title: string;
  sourceName: string;
  snippet: string;
}

interface AiClassifyResult {
  category: string;
  contentType: string;
}

interface GenerateSummaryInput {
  url: string;
  snippet: string;
  title: string;
}

export class AiClassifier {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private usageRepo: UsageRepo,
    private monthlyLimitUsd: number,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(input: AiClassifyInput): Promise<AiClassifyResult | null> {
    if (!this.usageRepo.canUseAI(this.monthlyLimitUsd)) {
      logger.warn('AI budget exhausted, skipping classification');
      return null;
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: 'You classify tech content into categories.',
        messages: [
          {
            role: 'user',
            content: `Classify: "${input.title}" from ${input.sourceName}. Snippet: ${input.snippet.slice(0, 500)}`,
          },
        ],
        tools: [
          {
            name: 'classify',
            description: 'Classify a tech content item',
            input_schema: {
              type: 'object' as const,
              properties: {
                category: {
                  type: 'string',
                  enum: ['ai', 'business', 'finance', 'product', 'tools', 'career', 'it'],
                },
                contentType: {
                  type: 'string',
                  enum: ['article', 'video', 'discussion', 'tool', 'repo'],
                },
              },
              required: ['category', 'contentType'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'classify' },
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') return null;

      const parsed = toolBlock.input as AiClassifyResult;

      const costUsd = calculateCost(response.usage.input_tokens, response.usage.output_tokens);

      this.usageRepo.log({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd,
      });

      return parsed;
    } catch (err) {
      logger.error('AI classification failed', { error: (err as Error).message });
      return null;
    }
  }

  async generateSummary(input: GenerateSummaryInput): Promise<string | null> {
    if (!this.usageRepo.canUseAI(this.monthlyLimitUsd)) {
      logger.warn('AI budget exhausted, skipping summary generation');
      return null;
    }

    try {
      const article = await extract(input.url);
      const text = article?.content ?? input.snippet ?? input.title;

      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Summarize this article in 3-5 sentences in Ukrainian:\n\n${text.slice(0, 4000)}`,
          },
        ],
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : null;
      if (!summary) return null;

      const costUsd = calculateCost(response.usage.input_tokens, response.usage.output_tokens);
      this.usageRepo.log({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd,
      });

      return summary;
    } catch (err) {
      logger.error('Summary generation failed', { url: input.url, error: (err as Error).message });
      return null;
    }
  }
}
