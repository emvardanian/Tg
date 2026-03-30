import type { Item } from '../storage/repositories/items.repo.js';

const CATEGORY_EMOJI: Record<string, string> = {
  ai: '🧠 AI', business: '💼 Business', finance: '💰 Finance',
  product: '🎯 Product', tools: '🔧 Tools', career: '📈 Career', it: '🖥 IT',
};

export interface DigestItem {
  title: string;
  category: string | null;
  url: string;
  source_name?: string;
}

export function formatDigest(items: DigestItem[]): string {
  if (items.length === 0) {
    return '📰 Ранковий дайджест\n\nНових матеріалів немає.';
  }

  const grouped = new Map<string, DigestItem[]>();
  for (const item of items) {
    const cat = item.category ?? 'it';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  const lines: string[] = ['📰 Ранковий дайджест', ''];

  for (const [cat, catItems] of grouped) {
    lines.push(`${CATEGORY_EMOJI[cat] ?? cat}`);
    for (const item of catItems.slice(0, 5)) {
      let domain: string;
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {
        domain = item.url;
      }
      lines.push(`• [${item.title}](${item.url}) — ${domain}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
