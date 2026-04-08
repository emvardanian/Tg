import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logger.js';
import type { UsageRepo } from '../storage/repositories/usage.repo.js';
import type {
  ExtractionResult,
  AnalysisResult,
  SummaryResult,
  TelegramPostResult,
  PipelineResult,
} from './types.js';
import { execFileAsync, parseJson } from './utils.js';

const SOURCE_TYPE_MAP: Record<string, string> = {
  youtube: 'youtube_transcript',
  threads: 'threads_post',
  github: 'github_release',
  hn: 'news_article',
  reddit: 'news_article',
  producthunt: 'other',
  search: 'news_article',
  rss: 'blog_post',
};

export class PipelineService {
  private prompts = new Map<string, string>();

  constructor(
    private promptsDir: string,
    private usageRepo: UsageRepo,
  ) {}

  async loadPrompts(): Promise<void> {
    const names = [
      '00_user_profile',
      '01_extraction',
      '02_analysis',
      '03_summary',
      '04_translate_format',
    ];
    await Promise.all(
      names.map(async (name) => {
        const content = await readFile(join(this.promptsDir, `${name}.md`), 'utf-8');
        this.prompts.set(name, content);
      }),
    );
    logger.info('Pipeline prompts loaded', { count: this.prompts.size, dir: this.promptsDir });
  }

  private async runClaude(systemPrompt: string, userMessage: string, tools = ''): Promise<string> {
    const timeout = tools ? 120_000 : 60_000;
    const stdout = await execFileAsync(
      'claude',
      ['--tools', tools, '--no-session-persistence', '--system-prompt', systemPrompt, '-p', userMessage],
      { timeout },
    );
    this.usageRepo.log({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
    return stdout.trim();
  }

  async process(input: {
    url: string;
    title: string;
    snippet?: string;
    sourceType: string;
    author?: string;
  }): Promise<PipelineResult | null> {
    const pipelineSourceType = SOURCE_TYPE_MAP[input.sourceType] ?? 'other';

    try {
      // ── Step 1: Extraction (Claude fetches the URL via WebFetch) ─────────────
      const sourceXml = [
        '<source>',
        `  <type>${pipelineSourceType}</type>`,
        `  <url>${input.url}</url>`,
        `  <author>${input.author ?? 'unknown'}</author>`,
        `  <published_date>unknown</published_date>`,
        `  <title_hint>${input.title}</title_hint>`,
        `  <snippet_hint>${(input.snippet ?? '').slice(0, 1000)}</snippet_hint>`,
        '</source>',
      ].join('\n');

      const extractionRaw = await this.runClaude(this.prompts.get('01_extraction')!, sourceXml, 'WebFetch');
      const extraction = parseJson<ExtractionResult>(extractionRaw);
      const imageUrl = extraction.extraction.image_url || null;
      logger.debug('Pipeline step 1 done', { url: input.url, imageUrl });

      // ── Step 2: Analysis ────────────────────────────────────────────────────
      const analysisInput = [
        '<extraction>',
        JSON.stringify(extraction),
        '</extraction>',
        '',
        '<user_profile>',
        this.prompts.get('00_user_profile')!,
        '</user_profile>',
      ].join('\n');

      const analysisRaw = await this.runClaude(this.prompts.get('02_analysis')!, analysisInput);
      const analysis = parseJson<AnalysisResult>(analysisRaw);
      logger.debug('Pipeline step 2 done', {
        url: input.url,
        score: analysis.analysis.composite_score,
        category: analysis.analysis.category,
      });

      // ── Step 3: Summary ─────────────────────────────────────────────────────
      const summaryInput = [
        '<extraction>',
        JSON.stringify(extraction),
        '</extraction>',
        '',
        '<analysis>',
        JSON.stringify(analysis),
        '</analysis>',
      ].join('\n');

      const summaryRaw = await this.runClaude(this.prompts.get('03_summary')!, summaryInput);
      const summary = parseJson<SummaryResult>(summaryRaw);
      logger.debug('Pipeline step 3 done', { url: input.url });

      // ── Step 4: Translate & Format ──────────────────────────────────────────
      const formatInput = [
        '<summary>',
        JSON.stringify(summary),
        '</summary>',
        '',
        '<analysis>',
        JSON.stringify(analysis),
        '</analysis>',
        '',
        `<source_url>${input.url}</source_url>`,
      ].join('\n');

      const formatRaw = await this.runClaude(this.prompts.get('04_translate_format')!, formatInput);
      const post = parseJson<TelegramPostResult>(formatRaw);
      logger.debug('Pipeline step 4 done', { url: input.url });

      return {
        telegramPost: post.telegram_post.text,
        captionText: post.telegram_post.caption_text || null,
        imageUrl,
        compositeScore: post.telegram_post.metadata.composite_score,
        category: post.telegram_post.metadata.category,
        shouldPin: post.telegram_post.metadata.should_pin,
      };
    } catch (err) {
      logger.error('Pipeline failed', { url: input.url, error: (err as Error).message });
      return null;
    }
  }
}
