const CATEGORY_EMOJI: Record<string, string> = {
  it: '🖥 IT',
  business: '💼 Business',
  finance: '💰 Finance',
  ai: '🧠 AI',
  product: '🎯 Product',
  tools: '🔧 Tools',
  career: '📈 Career',
};

const CONTENT_TYPE_EMOJI: Record<string, string> = {
  article: '📰 Article',
  video: '🎬 Video',
  discussion: '💬 Discussion',
  tool: '🚀 Tool Launch',
  repo: '⭐ Repo',
};

interface FormatInput {
  category: string;
  contentType: string;
  title: string;
  contentSnippet?: string;
  url: string;
  sourceName: string;
  wordCount?: number;
  stars?: number;
}

export function formatMessage(input: FormatInput): string {
  const catLabel = CATEGORY_EMOJI[input.category] ?? input.category;
  const typeLabel = CONTENT_TYPE_EMOJI[input.contentType] ?? input.contentType;

  const domain = new URL(input.url).hostname.replace(/^www\./, '');

  const lines: string[] = [];

  lines.push(`${catLabel}  |  ${typeLabel}`);
  lines.push('');
  lines.push(input.title);

  if (input.contentSnippet) {
    const snippet = input.contentSnippet.length > 200
      ? input.contentSnippet.slice(0, 200) + '...'
      : input.contentSnippet;
    lines.push('');
    lines.push(snippet);
  }

  lines.push('');
  lines.push(`🔗 ${domain}`);
  lines.push(`📌 ${input.sourceName}`);

  if (input.stars) {
    lines.push(`⭐ ${input.stars.toLocaleString('en-US')}`);
  }

  return lines.join('\n');
}
