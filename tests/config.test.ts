import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, type AppConfig, type SourceConfig } from '../src/config.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TMP_DIR = join(import.meta.dirname, '__tmp_config');

describe('loadConfig', () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('loads sources from YAML file', () => {
    const yaml = `
sources:
  - name: Simon Willison
    url: https://simonwillison.net/atom/everything/
    type: rss
    category: ai
  - name: Hacker News
    url: https://news.ycombinator.com
    type: hn
    category: it
`;
    const configPath = join(TMP_DIR, 'sources.config.yml');
    writeFileSync(configPath, yaml);

    const config = loadConfig(configPath);

    expect(config.sources).toHaveLength(2);
    expect(config.sources[0]).toEqual({
      name: 'Simon Willison',
      url: 'https://simonwillison.net/atom/everything/',
      type: 'rss',
      category: 'ai',
    });
    expect(config.sources[1].type).toBe('hn');
  });

  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent/path.yml')).toThrow();
  });

  it('throws on invalid YAML structure', () => {
    const configPath = join(TMP_DIR, 'bad.yml');
    writeFileSync(configPath, 'not: valid: structure:');

    expect(() => loadConfig(configPath)).toThrow();
  });
});
