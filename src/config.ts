import { readFileSync } from 'fs';
import { parse } from 'yaml';
import 'dotenv/config';

export interface SourceConfig {
  name: string;
  url: string;
  type: 'rss' | 'youtube' | 'hn' | 'reddit' | 'producthunt' | 'github';
  category?: string;
}

interface SourcesFile {
  sources: SourceConfig[];
}

export interface AppConfig {
  sources: SourceConfig[];
  telegram: {
    botToken: string;
    channelId: string;
    adminChatId: string;
  };
  anthropic: {
    apiKey: string;
    monthlyLimitUsd: number;
  };
  youtube: {
    apiKey: string;
  };
  db: {
    path: string;
  };
  logLevel: string;
}

export function loadConfig(sourcesPath: string): AppConfig {
  const raw = readFileSync(sourcesPath, 'utf-8');
  const parsed = parse(raw) as SourcesFile;

  if (!parsed?.sources || !Array.isArray(parsed.sources)) {
    throw new Error(`Invalid config: "sources" must be an array in ${sourcesPath}`);
  }

  for (const s of parsed.sources) {
    if (!s.name || !s.url || !s.type) {
      throw new Error(`Invalid source: name, url, and type are required. Got: ${JSON.stringify(s)}`);
    }
  }

  return {
    sources: parsed.sources,
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      channelId: process.env.TELEGRAM_CHANNEL_ID ?? '',
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? '',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      monthlyLimitUsd: parseFloat(process.env.AI_MONTHLY_LIMIT_USD ?? '5'),
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY ?? '',
    },
    db: {
      path: process.env.DB_PATH ?? './data/aggregator.db',
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
