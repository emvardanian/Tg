import { readFileSync } from 'fs';
import { parse } from 'yaml';
import 'dotenv/config';

export interface SourceConfig {
  name: string;
  url: string;
  type: 'rss' | 'youtube' | 'hn' | 'reddit' | 'producthunt' | 'github' | 'search' | 'threads';
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
  youtube: {
    apiKey: string;
  };
  search: {
    tavilyKey: string;
    braveKey: string;
  };
  db: {
    path: string;
  };
  logLevel: string;
  digest: {
    mode: 'daily' | 'realtime';
  };
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

  const digestModeRaw = process.env.DIGEST_MODE ?? 'realtime';
  if (digestModeRaw !== 'daily' && digestModeRaw !== 'realtime') {
    throw new Error(`Invalid DIGEST_MODE "${digestModeRaw}". Must be "daily" or "realtime".`);
  }

  return {
    sources: parsed.sources,
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      channelId: process.env.TELEGRAM_CHANNEL_ID ?? '',
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? '',
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY ?? '',
    },
    search: {
      tavilyKey: process.env.TAVILY_API_KEY ?? '',
      braveKey: process.env.BRAVE_SEARCH_API_KEY ?? '',
    },
    db: {
      path: process.env.DB_PATH ?? './data/aggregator.db',
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
    digest: {
      mode: digestModeRaw,
    },
  };
}
