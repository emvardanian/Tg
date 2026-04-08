# Research: Daily Tools Digest

**Date**: 2026-04-09
**Branch**: daily-tools-digest

## Decision 1: How to exclude tools from individual publishing

**Decision**: Set `maxToolsPerDay: 0` in QueueOptions and ensure queue skips all `devtools_dx` items.

**Rationale**: The queue already has `maxToolsPerDay` logic that skips `devtools_dx` items when limit is reached. Setting it to 0 means zero tools are published individually -- they stay unpublished in the DB until the digest job picks them up.

**Alternatives considered**:
- Add a new `excludeCategories` option to queue -- more flexible but unnecessary complexity for a single category.
- Filter in `publishPending()` before enqueueing -- would work but duplicates filtering logic. The queue already handles this.

## Decision 2: Where to run the tools digest Claude call

**Decision**: New service `ToolsDigestService` in `src/pipeline/tools-digest.service.ts` that calls Claude CLI with a batch prompt.

**Rationale**: Follows existing pattern -- pipeline.service.ts calls Claude CLI as child process with prompts from `prompts/`. The new service handles batch input (multiple items) rather than single-item processing. Keeps the existing per-item pipeline unchanged.

**Alternatives considered**:
- Extend existing PipelineService with a batch mode -- violates single-responsibility; per-item and batch have different inputs/outputs.
- Use digest-formatter.ts directly without Claude -- no AI curation, just formatting. Doesn't meet the "pick the best ones for me" requirement.

## Decision 3: Prompt design for batch tools digest

**Decision**: New prompt file `prompts/05_tools_digest.md` that receives a JSON array of pre-analyzed tool items (title, url, summary, score, category) plus user profile, and outputs a curated Telegram HTML post.

**Rationale**: Items are already processed through the 4-step pipeline, so extraction/analysis data exists. The digest prompt only needs to:
1. Evaluate the batch holistically (dedup similar tools, pick top items)
2. Write a single consolidated post in Ukrainian
3. Output Telegram-ready HTML

**Alternatives considered**:
- Two-step batch pipeline (select, then format) -- overhead of two Claude calls for a simple task. One call suffices since the individual analysis is already done.
- Reuse `04_translate_format.md` per item then merge -- loses the "holistic curation" aspect; can't compare items against each other.

## Decision 4: Scheduling time for tools digest

**Decision**: Run the tools digest at 09:00 daily, after the existing daily digest (08:05) and after most collectors have run their morning cycles.

**Rationale**: GitHub Trending runs at 10:00, but other tool sources (RSS every 2h, HN every 2h, Web Search every 6h) would have collected during the night/morning. 09:00 gives a good window. Items collected later (including GitHub at 10:00) will be included in the next day's digest.

**Alternatives considered**:
- Evening digest (18:00) -- catches all daily collections but delivers value too late in the day.
- Same time as daily digest (08:05) -- conflicts and complicates the existing digest logic.
- Configurable via env var -- good idea, will implement as `TOOLS_DIGEST_HOUR` env var with default 9.

## Decision 5: How to mark tools items after digest

**Decision**: Use existing `markPublished(id, 0)` with `telegram_message_id = 0` for items included in the digest. For rejected items, also mark published with `telegram_message_id = -1` (new convention) to distinguish "skipped by digest" from "published in digest".

**Rationale**: Both selected and rejected items must be marked so they don't appear in the next digest cycle. Using different message_id values allows tracking which items were selected vs skipped.

**Alternatives considered**:
- New `published_via` field -- requires DB migration. The existing `telegram_message_id` values (0 = digest, -1 = skipped) suffice.
- Only mark selected items -- rejected items would re-appear in tomorrow's digest indefinitely.

## Decision 6: Item selection criteria for digest

**Decision**: Use existing `classifier_score` (composite 1.0-5.0) from the per-item pipeline analysis. The batch Claude prompt receives all items with their scores and metadata, and selects the top 3-7 items based on relevance, novelty, and complementarity.

**Rationale**: The per-item pipeline already scores for relevance against user profile. The batch prompt adds holistic curation: avoiding duplicates, ensuring variety, and picking complementary tools.

**Alternatives considered**:
- Pure score-based cutoff (e.g., score >= 3.0) -- loses the "pick what suits me best" nuance. Claude can consider factors beyond a single score.
- Re-analyze items from scratch in the batch prompt -- wasteful since analysis is already done.
