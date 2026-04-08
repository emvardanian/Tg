import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsDigestService } from '../../src/pipeline/tools-digest.service.js';
import type { Item } from '../../src/storage/repositories/items.repo.js';

const mockExecFileAsync = vi.fn();

vi.mock('../../src/pipeline/utils.js', () => ({
  execFileAsync: (...args: any[]) => mockExecFileAsync(...args),
  parseJson: (raw: string) => {
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf('{');
      if (start === -1) throw new Error(`No JSON object found`);
      let depth = 0;
      let end = -1;
      for (let i = start; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        else if (trimmed[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) throw new Error(`Unclosed JSON object`);
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mock prompt content'),
}));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    source_id: 1,
    external_id: null,
    url: 'https://example.com/tool',
    url_normalized: 'example.com/tool',
    title: 'Cool Tool',
    content_snippet: null,
    word_count: null,
    category: 'devtools_dx',
    content_type: 'tool',
    summary: 'A cool dev tool',
    classified_by: 'pipeline',
    classifier_score: 0.8,
    feedback_score: 0,
    score: 0.8,
    stars: null,
    stars_today: null,
    upvotes: null,
    comments: null,
    published: 0,
    telegram_message_id: null,
    pipeline_post: null,
    pipeline_caption: null,
    pipeline_image_url: null,
    should_pin: 0,
    discovered_at: '2026-04-09T00:00:00Z',
    published_at: null,
    ...overrides,
  };
}

describe('ToolsDigestService', () => {
  let service: ToolsDigestService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new ToolsDigestService('/mock/prompts');
    await service.loadPrompts();
  });

  it('returns null for empty items array', async () => {
    const result = await service.generateDigest([], new Map());
    expect(result).toBeNull();
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it('calls claude CLI and parses valid JSON response', async () => {
    const items = [
      makeItem({ id: 1, title: 'Tool A' }),
      makeItem({ id: 2, title: 'Tool B' }),
      makeItem({ id: 3, title: 'Tool C' }),
    ];

    const mockResponse = JSON.stringify({
      selected_ids: [1, 3],
      telegram_post: '<b>Tools</b>\nTool A\nTool C',
      item_count: 2,
    });

    mockExecFileAsync.mockResolvedValue(mockResponse);

    const sourcesMap = new Map([[1, 'Source A']]);
    const result = await service.generateDigest(items, sourcesMap);

    expect(result).not.toBeNull();
    expect(result!.selectedItemIds).toEqual([1, 3]);
    expect(result!.rejectedItemIds).toEqual([2]);
    expect(result!.telegramPost).toContain('Tool A');
    expect(result!.itemCount).toBe(2);
  });

  it('returns null when claude CLI fails', async () => {
    const items = [makeItem({ id: 1 })];
    mockExecFileAsync.mockRejectedValue(new Error('timeout'));

    const result = await service.generateDigest(items, new Map());
    expect(result).toBeNull();
  });

  it('returns null when claude returns invalid JSON', async () => {
    const items = [makeItem({ id: 1 })];
    mockExecFileAsync.mockResolvedValue('not json at all');

    const result = await service.generateDigest(items, new Map());
    expect(result).toBeNull();
  });

  it('maps source names from sourcesMap', async () => {
    const items = [makeItem({ id: 1, source_id: 42 })];

    mockExecFileAsync.mockImplementation(async (_cmd: string, args: string[]) => {
      const userMessage = args[args.length - 1];
      expect(userMessage).toContain('GitHub Trending');
      return JSON.stringify({ selected_ids: [1], telegram_post: 'test', item_count: 1 });
    });

    const sourcesMap = new Map([[42, 'GitHub Trending']]);
    await service.generateDigest(items, sourcesMap);

    expect(mockExecFileAsync).toHaveBeenCalled();
  });
});
