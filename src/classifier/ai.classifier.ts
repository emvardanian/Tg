import { execFile } from 'child_process';
import { extract } from '@extractus/article-extractor';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
import { logger } from '../logger.js';

function execFileAsync(cmd: string, args: string[], opts: { timeout: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

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

const VALID_CATEGORIES = ['ai', 'business', 'finance', 'product', 'tools', 'career', 'it'];
const VALID_CONTENT_TYPES = ['article', 'video', 'discussion', 'tool', 'repo'];

export class AiClassifier {
  constructor(private usageRepo: UsageRepo) {}

  private async runClaude(prompt: string): Promise<string> {
    const stdout = await execFileAsync('claude', ['-p', prompt], {
      timeout: 30_000,
    });
    return stdout.trim();
  }

  async classify(input: AiClassifyInput): Promise<AiClassifyResult | null> {
    const prompt =
      `Classify this tech article. Reply ONLY with valid JSON, no explanation or markdown.\n\n` +
      `Title: "${input.title}"\n` +
      `Source: ${input.sourceName}\n` +
      `Snippet: ${input.snippet.slice(0, 500)}\n\n` +
      `Required JSON format:\n` +
      `{"category":"<one of: ai|business|finance|product|tools|career|it>","contentType":"<one of: article|video|discussion|tool|repo>"}`;

    try {
      const raw = await this.runClaude(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        logger.warn('AI classification returned no JSON', { raw: raw.slice(0, 200) });
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]) as AiClassifyResult;
      if (!VALID_CATEGORIES.includes(parsed.category) || !VALID_CONTENT_TYPES.includes(parsed.contentType)) {
        logger.warn('AI classification returned invalid values', { parsed });
        return null;
      }
      // Claude CLI does not expose token counts; log the call for frequency tracking only
      this.usageRepo.log({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
      return parsed;
    } catch (err) {
      logger.error('AI classification failed', { error: (err as Error).message });
      return null;
    }
  }

  async generateSummary(input: GenerateSummaryInput): Promise<string | null> {
    let text: string;
    try {
      const article = await extract(input.url);
      text = article?.content ?? input.snippet ?? input.title;
    } catch {
      logger.warn('Article extraction failed, falling back to snippet', { url: input.url });
      text = input.snippet ?? input.title;
    }

    const prompt = `Summarize this article in 3-5 sentences in Ukrainian:\n\n${text.slice(0, 4000)}`;

    try {
      const summary = await this.runClaude(prompt);
      if (!summary) return null;
      // Claude CLI does not expose token counts; log the call for frequency tracking only
      this.usageRepo.log({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
      return summary;
    } catch (err) {
      logger.error('Summary generation failed', { url: input.url, error: (err as Error).message });
      return null;
    }
  }
}
