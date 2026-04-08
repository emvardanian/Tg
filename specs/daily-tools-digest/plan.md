# Implementation Plan: Daily Tools Digest

**Branch**: `daily-tools-digest` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/daily-tools-digest/spec.md`

## Summary

Replace individual tool-category Telegram posts (currently max 2/day) with a single daily curated digest. A new Claude batch prompt evaluates all collected tool items, selects the most personally relevant ones, and generates one formatted Telegram post published at a configured time each day.

## Technical Context

**Language/Version**: TypeScript 5.7+, Node.js 22+
**Primary Dependencies**: grammy (Telegram), better-sqlite3, node-cron, winston, claude CLI (child process)
**Storage**: SQLite via better-sqlite3 -- no schema changes needed
**Testing**: vitest, tests/ directory
**Target Platform**: Linux server (Docker on VPS)
**Project Type**: Single Node.js backend service
**Performance Goals**: Digest generation completes within 2 minutes (single Claude call)
**Constraints**: Telegram Bot API rate limits (existing handling sufficient)
**Scale/Scope**: ~5-15 tool items per day from 5 sources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Single service architecture | PASS | No new services. ToolsDigestService is a class within the same process |
| Immutability pattern | PASS | New service creates new objects, no mutation |
| Repository pattern for DB access | PASS | New query added to ItemsRepo |
| DI via constructor | PASS | ToolsDigestService receives deps via constructor |
| Error handling at boundaries | PASS | Try-catch in scheduler, logs errors, skips on failure |
| File organization (200-400 lines) | PASS | New service ~80 lines, prompt ~60 lines |
| Named exports only | PASS | No default exports |
| Pipeline prompts in prompts/ | PASS | New prompt file 05_tools_digest.md |
| Conventional commits | PASS | Will use feat:, test: prefixes |
| kebab-case file names | PASS | tools-digest.service.ts, tools-digest.test.ts |

**Post-design re-check**: All gates still pass. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/daily-tools-digest/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research decisions
├── data-model.md        # Entity analysis
├── quickstart.md        # Developer quickstart
└── tasks.md             # Phase 2 output (/trc.tasks)
```

### Source Code (repository root)

```text
src/
├── pipeline/
│   ├── pipeline.service.ts          # Existing per-item pipeline (unchanged)
│   ├── tools-digest.service.ts      # NEW: batch tools digest Claude call
│   └── types.ts                     # Existing types (add ToolsDigestResult)
├── publisher/
│   ├── queue.ts                     # MODIFY: maxToolsPerDay=0
│   ├── telegram.publisher.ts        # Existing (unchanged, reuse publish method)
│   └── digest-formatter.ts          # Existing (unchanged)
├── storage/repositories/
│   └── items.repo.ts                # MODIFY: add getUnpublishedByCategory()
├── scheduler.ts                     # MODIFY: add daily tools digest cron
├── config.ts                        # MODIFY: add toolsDigestHour config
└── index.ts                         # MODIFY: wire up ToolsDigestService

prompts/
├── 00_user_profile.md               # Existing (referenced by new prompt)
├── 01_extraction.md                 # Existing (unchanged)
├── 02_analysis.md                   # Existing (unchanged)
├── 03_summary.md                    # Existing (unchanged)
├── 04_translate_format.md           # Existing (unchanged)
└── 05_tools_digest.md               # NEW: batch tools curation prompt

tests/
├── pipeline/
│   └── tools-digest.test.ts         # NEW: test ToolsDigestService
└── publisher/
    └── queue.test.ts                # MODIFY: test tools exclusion
```

**Structure Decision**: Follows existing single-project layout. New files placed alongside their domain counterparts (pipeline service next to pipeline service, test next to tests).

## Implementation Phases

### Phase 1: Repository & Config (foundation)

**Goal**: Enable querying unpublished tools and configure digest timing.

**Changes**:
1. `src/storage/repositories/items.repo.ts` -- Add `getUnpublishedByCategory(category: string, limit: number): Item[]`
   - SQL: `SELECT * FROM items WHERE category = ? AND published = 0 ORDER BY classifier_score DESC, discovered_at ASC LIMIT ?`
2. `src/config.ts` -- Add `toolsDigestHour: number` to AppConfig
   - Env var: `TOOLS_DIGEST_HOUR`, default: `9`
3. `src/publisher/queue.ts` -- No code change yet, but update queue instantiation in index.ts to pass `maxToolsPerDay: 0`

**Tests**: Unit test for `getUnpublishedByCategory()` in items repo test.

### Phase 2: Tools Digest Prompt (AI curation)

**Goal**: Create the Claude prompt that takes batch tool items and produces a curated digest post.

**Changes**:
1. `prompts/05_tools_digest.md` -- New prompt:
   - Input: JSON array of tool items (title, url, summary, score, source_name) + user profile reference
   - Instructions: Evaluate batch holistically, select 3-7 most relevant, avoid duplicates
   - Output: JSON with `selected_items` (array of indices), `telegram_post` (Ukrainian HTML), `item_count` (number)
   - Tone: Match existing channel style (Ukrainian, technical, concise)

### Phase 3: Tools Digest Service (batch processing)

**Goal**: Service that orchestrates the batch Claude call and returns formatted result.

**Changes**:
1. `src/pipeline/tools-digest.service.ts` -- New class `ToolsDigestService`:
   - Constructor: receives `promptsDir: string` (path to prompts/)
   - Method: `generateDigest(items: Item[], sourcesMap: Map<number, string>): Promise<ToolsDigestResult | null>`
   - Calls Claude CLI with `05_tools_digest.md` prompt + serialized items JSON
   - Parses JSON response, returns `{ telegramPost: string; selectedItemIds: number[]; rejectedItemIds: number[] }`
   - Returns null if Claude call fails (logged, not thrown)
2. `src/pipeline/types.ts` -- Add `ToolsDigestResult` interface

**Tests**: Mock Claude CLI call, verify input serialization and output parsing.

### Phase 4: Scheduler Integration (wiring)

**Goal**: Wire everything together -- cron job, publishing, marking items.

**Changes**:
1. `src/scheduler.ts` -- Add `sendToolsDigest()` method:
   - Query unpublished devtools_dx items via `getUnpublishedByCategory('devtools_dx', 20)`
   - If no items, skip silently
   - Call `ToolsDigestService.generateDigest(items)`
   - If result null (Claude failed), log and skip
   - Publish result.telegramPost to channel via `publisher.publish()` (send as HTML message)
   - Mark selected items as published (telegram_message_id = actual msg id)
   - Mark rejected items as published (telegram_message_id = -1)
   - Add cron schedule: `'0 ${toolsDigestHour} * * *'`
2. `src/index.ts` -- Wire up:
   - Create ToolsDigestService instance
   - Pass to Scheduler deps
   - Set `maxToolsPerDay: 0` in PublishQueue options

**Tests**: Integration test verifying the full flow (mock Claude + mock Telegram).

### Phase 5: Queue Exclusion (cleanup)

**Goal**: Ensure queue never publishes individual tool posts.

**Changes**:
1. `src/index.ts` -- Already done in Phase 4: `maxToolsPerDay: 0`
2. `tests/publisher/queue.test.ts` -- Add test: with maxToolsPerDay=0, no devtools_dx items are published

## Complexity Tracking

No constitution violations to justify. All changes follow existing patterns.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude CLI call fails for digest | Medium | Low | Skip digest for the day, log error. Items remain unpublished and are picked up next day |
| Too few tools collected in a day | Low | Low | Prompt handles 1-item case gracefully; skip if 0 items |
| Tools items accumulate if digest keeps failing | Low | Medium | Items are picked up by next successful digest run. Monitor logs |
| Telegram rate limit on digest post | Low | Low | Single message per day is well within limits |
