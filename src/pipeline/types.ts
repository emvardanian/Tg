export interface ExtractionResult {
  extraction: {
    source_type: string;
    source_url: string;
    author: string;
    published_date: string | null;
    content_language: string;
    title: string;
    technologies_mentioned: Array<{
      name: string;
      context: string;
      version: string | null;
    }>;
    factual_claims: Array<{
      claim: string;
      specificity: 'high' | 'medium' | 'low';
      has_evidence: boolean;
      evidence: string | null;
    }>;
    opinion_claims: Array<{
      claim: string;
      strength: 'strong' | 'moderate' | 'speculative';
    }>;
    announcements: Array<{
      what: string;
      who: string;
      when: string;
      availability: 'available_now' | 'early_access' | 'coming_soon' | 'no_date' | 'already_available';
    }>;
    code_or_examples: Array<{
      description: string;
      is_runnable: boolean;
      language: string;
    }>;
    numbers_and_benchmarks: Array<{
      metric: string;
      value: string;
      context: string;
    }>;
    links_and_references: Array<{
      url: string;
      description: string;
    }>;
    content_meta: {
      estimated_substance_density: 'high' | 'medium' | 'low';
      content_type: string;
      word_count_approximate: number;
      has_original_research: boolean;
      is_primarily_promotional: boolean;
    };
  };
}

export interface AnalysisResult {
  analysis: {
    scores: {
      value_density: { score: number; rationale: string };
      relevance: {
        score: number;
        rationale: string;
        matched_tiers: string[];
        matched_technologies: string[];
      };
      timeliness: { score: number; rationale: string };
      actionability: { score: number; rationale: string };
    };
    composite_score: number;
    flags: {
      is_hype: boolean;
      is_promotional: boolean;
      is_breaking_news: boolean;
      has_original_research: boolean;
      requires_deep_dive: boolean;
      contradicts_known_info: boolean;
    };
    category: 'ai_ml' | 'devtools_dx' | 'cloud_infra' | 'frontend_mobile' | 'security' | 'other';
    key_insight: string;
    critical_notes: string | null;
  };
}

export interface SummaryResult {
  summary: {
    headline: string;
    body: string;
    actionable_conclusion: string;
    tags: string[];
    tldr: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface TelegramPostResult {
  telegram_post: {
    format: string;
    text: string;
    metadata: {
      composite_score: number;
      category: string;
      tags: string[];
      source_url: string;
      should_pin: boolean;
      confidence: 'high' | 'medium' | 'low';
    };
  };
}

export interface PipelineResult {
  telegramPost: string;
  compositeScore: number;
  category: string;
  shouldPin: boolean;
}
