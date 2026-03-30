import Anthropic from '@anthropic-ai/sdk';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
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

// Haiku pricing per million tokens
const HAIKU_INPUT_PRICE = 0.25 / 1_000_000;
const HAIKU_OUTPUT_PRICE = 1.25 / 1_000_000;

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
        system: 'You classify tech content. Respond in JSON only.',
        messages: [
          {
            role: 'user',
            content: `Title: ${input.title} | Source: ${input.sourceName} | Snippet: ${input.snippet.slice(0, 500)}`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = JSON.parse(text) as AiClassifyResult;

      // Log usage
      const costUsd =
        response.usage.input_tokens * HAIKU_INPUT_PRICE +
        response.usage.output_tokens * HAIKU_OUTPUT_PRICE;

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
}
