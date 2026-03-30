export interface ClassificationInput {
  title: string;
  contentSnippet?: string;
  sourceCategory?: string;
  sourceType: string;
}

export interface ClassificationResult {
  category: string;
  contentType: string;
  confidence: number;
}

const CONTENT_TYPE_BY_SOURCE: Record<string, string> = {
  youtube: 'video',
  hn: 'discussion',
  reddit: 'discussion',
  github: 'repo',
  producthunt: 'tool',
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ai: [
    'llm', 'gpt', 'transformer', 'neural', 'machine learning', 'deep learning',
    'language model', 'openai', 'anthropic', 'claude', 'diffusion', 'embedding',
    'fine-tun', 'rag', 'agent', 'prompt', 'inference', 'training',
  ],
  business: [
    'startup', 'fundrais', 'series a', 'series b', 'venture capital', 'vc',
    'founder', 'yc', 'y combinator', 'revenue', 'growth', 'market',
    'acquisition', 'ipo',
  ],
  finance: [
    'invest', 'stock', 'portfolio', 'dividend', 'valuation', 'market cap',
    'compound', 'etf', 'bond', 'inflation',
  ],
  product: [
    'product management', 'roadmap', 'metrics', 'okr', 'user research',
    'retention', 'onboarding', 'a/b test', 'conversion',
  ],
  tools: [
    'open source', 'cli', 'framework', 'library', 'sdk', 'plugin',
    'extension', 'devtool',
  ],
  career: [
    'interview', 'hiring', 'salary', 'remote work', 'career', 'job market',
    'promotion', 'engineering manager',
  ],
};

export class HeuristicClassifier {
  classify(input: ClassificationInput): ClassificationResult {
    const contentType = CONTENT_TYPE_BY_SOURCE[input.sourceType] ?? 'article';

    // Layer 1: Source default category
    if (input.sourceCategory) {
      const hasKnownSourceType = input.sourceType in CONTENT_TYPE_BY_SOURCE;
      return {
        category: input.sourceCategory,
        contentType,
        confidence: hasKnownSourceType ? 0.9 : 0.7,
      };
    }

    // Layer 2: Keyword matching
    const text = `${input.title} ${input.contentSnippet ?? ''}`.toLowerCase();

    let bestCategory = 'it';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    const confidence = bestScore === 0 ? 0.3 : Math.min(0.5 + bestScore * 0.15, 0.9);

    return {
      category: bestCategory,
      contentType,
      confidence,
    };
  }
}
