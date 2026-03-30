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
  summary?: string;
  url: string;
  sourceName: string;
  wordCount?: number;
  stars?: number;
  starsToday?: number;
  upvotes?: number;
  comments?: number;
  sightings?: Array<{ source_name: string; meta: string | null }>;
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
    // Reserve ~200 chars for header/footer
    const maxSnippet = 4096 - input.title.length - 200;
    const snippet = input.contentSnippet.length > maxSnippet
      ? input.contentSnippet.slice(0, maxSnippet) + '...'
      : input.contentSnippet;
    lines.push('');
    lines.push(snippet);
  }

  if (input.summary) {
    lines.push('');
    lines.push(`📝 ${input.summary}`);
  }

  lines.push('');
  lines.push(`📌 ${input.sourceName}  |  🔗 ${input.url}`);

  if (input.stars) {
    const todayPart = input.starsToday ? `  🚀 +${input.starsToday.toLocaleString('en-US')} today` : '';
    lines.push(`⭐ ${input.stars.toLocaleString('en-US')} stars${todayPart}`);
  }

  if (input.upvotes) {
    const commentsPart = input.comments ? ` · 💬 ${input.comments}` : '';
    lines.push(`🔺 ${input.upvotes} pts${commentsPart}`);
  }

  if (input.sightings?.length) {
    const parts = input.sightings.map((s) => {
      const meta = s.meta ? JSON.parse(s.meta) : {};
      const suffix = meta.upvotes ? ` (${meta.upvotes} pts)` : '';
      return `${s.source_name}${suffix}`;
    });
    lines.push(`📡 Also on: ${parts.join(', ')}`);
  }

  return lines.join('\n');
}
