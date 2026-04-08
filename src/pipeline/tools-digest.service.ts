import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logger.js';
import type { Item } from '../storage/repositories/items.repo.js';
import type { ToolsDigestResult } from './types.js';
import { execFileAsync, parseJson } from './utils.js';

interface DigestInput {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  score: number;
  source_name: string;
}

export class ToolsDigestService {
  private systemPrompt: string | null = null;
  private userProfile: string | null = null;

  constructor(private promptsDir: string) {}

  async loadPrompts(): Promise<void> {
    this.systemPrompt = await readFile(join(this.promptsDir, '05_tools_digest.md'), 'utf-8');
    this.userProfile = await readFile(join(this.promptsDir, '00_user_profile.md'), 'utf-8');
  }

  async generateDigest(
    items: Item[],
    sourcesMap: Map<number, string>,
  ): Promise<ToolsDigestResult | null> {
    if (items.length === 0) return null;

    const digestItems: DigestInput[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      summary: item.summary,
      score: item.classifier_score,
      source_name: sourcesMap.get(item.source_id) ?? 'unknown',
    }));

    if (!this.systemPrompt || !this.userProfile) {
      throw new Error('ToolsDigestService: prompts not loaded, call loadPrompts() first');
    }

    const userMessage = [
      '<tools>',
      JSON.stringify(digestItems, null, 2),
      '</tools>',
      '',
      '<user_profile>',
      this.userProfile!,
      '</user_profile>',
    ].join('\n');

    try {
      const stdout = await execFileAsync(
        'claude',
        ['--no-session-persistence', '--system-prompt', this.systemPrompt!, '-p', userMessage],
        { timeout: 120_000 },
      );

      const result = parseJson<{ selected_ids: number[]; telegram_post: string; item_count: number }>(stdout);

      const selectedSet = new Set(result.selected_ids);
      const selectedItemIds = items.filter((i) => selectedSet.has(i.id)).map((i) => i.id);
      const rejectedItemIds = items.filter((i) => !selectedSet.has(i.id)).map((i) => i.id);

      return {
        telegramPost: result.telegram_post,
        selectedItemIds,
        rejectedItemIds,
        itemCount: selectedItemIds.length,
      };
    } catch (err) {
      logger.error('Tools digest pipeline failed', { error: (err as Error).message });
      return null;
    }
  }
}
