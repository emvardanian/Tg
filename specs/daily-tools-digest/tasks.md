# Tasks: Daily Tools Digest

**Input**: Design documents from `/specs/daily-tools-digest/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: US1 (daily curated post) and US2 (personalized selection) are co-implemented -- the same prompt and service handle both selection and posting. US3 (readable format) is a polish pass on the prompt output.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Config and repository foundation for the feature

- [x] T001 [P] Add `toolsDigestHour` config field to `src/config.ts` -- read from `TOOLS_DIGEST_HOUR` env var, default `9`, add to `AppConfig` interface
- [x] T002 [P] Add `getUnpublishedByCategory(category: string, limit: number): Item[]` method to `src/storage/repositories/items.repo.ts` -- SQL: `SELECT * FROM items WHERE category = ? AND published = 0 ORDER BY classifier_score DESC, discovered_at ASC LIMIT ?`
- [x] T003 [P] Add `ToolsDigestResult` interface to `src/pipeline/types.ts` -- fields: `telegramPost: string`, `selectedItemIds: number[]`, `rejectedItemIds: number[]`, `itemCount: number`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Block individual tool posts from being published. MUST complete before digest can work correctly.

- [x] T004 Set `maxToolsPerDay: 0` in PublishQueue instantiation in `src/index.ts` -- add to the QueueOptions object passed to `new PublishQueue()`

**Checkpoint**: After this, no individual devtools_dx posts will be published. Items accumulate as unpublished.

---

## Phase 3: User Story 1+2 - Daily Curated Tools Post + Personalized Selection (Priority: P1) MVP

**Goal**: Once daily, Claude evaluates all unpublished tool items, selects the most relevant, and publishes one curated Telegram post.

**Independent Test**: Manually insert 5-10 devtools_dx items into DB with published=0, trigger the digest function, verify one Telegram post is sent with a curated subset.

### Implementation

- [x] T005 [P] [US1] Create batch curation prompt `prompts/05_tools_digest.md` -- input: JSON array of tool items (id, title, url, summary, score, source_name) + reference to user profile from `00_user_profile.md`; instructions: select 3-7 most relevant, deduplicate similar tools, rank by personal relevance; output: JSON with `selected_ids` (number[]), `telegram_post` (Ukrainian HTML string), `item_count` (number)
- [x] T006 [P] [US1] Create `ToolsDigestService` class in `src/pipeline/tools-digest.service.ts` -- constructor receives `promptsDir: string`; method `generateDigest(items: Item[], sourcesMap: Map<number, string>): Promise<ToolsDigestResult | null>`; serializes items to JSON, calls Claude CLI with `05_tools_digest.md` prompt as system + items JSON as user message, parses JSON response; returns null on failure (log error with winston)
- [x] T007 [US1] Add `toolsDigestService` to `SchedulerDeps` interface and `sendToolsDigest()` method to `Scheduler` class in `src/scheduler.ts` -- query items via `getUnpublishedByCategory('devtools_dx', 20)`, skip if empty, call `toolsDigestService.generateDigest()`, publish `result.telegramPost` to channel via `bot.api.sendMessage(channelId, post, { parse_mode: 'HTML' })`, mark selected items published with actual message_id, mark rejected items published with telegram_message_id=-1
- [x] T008 [US1] Add tools digest cron schedule in `Scheduler.start()` in `src/scheduler.ts` -- `cron.schedule('0 ${this.deps.toolsDigestHour} * * *', () => this.sendToolsDigest())`, always active (not gated by digestMode)
- [x] T009 [US1] Wire up in `src/index.ts` -- instantiate `ToolsDigestService` with prompts dir, add `toolsDigestService` and `toolsDigestHour` to scheduler deps object

**Checkpoint**: Daily tools digest is fully functional. One post per day, AI-curated, no individual tool posts.

---

## Phase 4: User Story 3 - Readable Digest Format (Priority: P2)

**Goal**: The digest post has clear visual hierarchy -- heading, per-tool entries with name/description/link, scannable layout.

**Independent Test**: Generate a digest and verify the HTML output has a title line, numbered or bulleted tool entries, each with bold name, one-line description, and clickable link.

### Implementation

- [x] T010 [US3] Refine Telegram HTML formatting in `prompts/05_tools_digest.md` -- add explicit format instructions: post starts with heading (e.g. bold title line), each tool entry is `<b>Tool Name</b> -- one-line description\n<a href="url">source</a>`, entries separated by blank line, optional hashtags at the end; ensure total post length stays under 4096 chars (Telegram limit)

**Checkpoint**: Digest post is well-structured and scannable.

---

## Phase 5: Tests & Verification

**Purpose**: Test coverage and build validation

- [x] T011 [P] Add tests for `ToolsDigestService` in `tests/pipeline/tools-digest.test.ts` -- mock Claude CLI child process, test: input serialization (items mapped to JSON correctly), output parsing (valid JSON response produces ToolsDigestResult), error handling (Claude failure returns null), empty items array returns null without calling Claude
- [x] T012 [P] Add test for `maxToolsPerDay=0` behavior in `tests/publisher/queue.test.ts` -- enqueue items with category='devtools_dx', verify processNext() skips all of them, verify non-tools items still publish normally
- [x] T013 Build verification -- run `npx tsc` to confirm no type errors, run `npm test` to confirm all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies -- start immediately. All 3 tasks are parallel.
- **Phase 2 (Foundational)**: Depends on T001 (config needed in index.ts). Can start after T001.
- **Phase 3 (US1+US2)**: Depends on Phase 1 completion (T001-T003). T005 and T006 are parallel. T007 depends on T006. T008 depends on T007. T009 depends on T006 + T004.
- **Phase 4 (US3)**: Depends on T005 (prompt must exist first). Can be done anytime after T005.
- **Phase 5 (Tests)**: T011 depends on T006. T012 depends on T004. T013 depends on all previous.

### Within Phase 3 (critical path)

```
T005 (prompt) ──────────────────────┐
                                    ├── T007 (scheduler method) ── T008 (cron) ── T009 (wiring)
T006 (service) ────────────────────┘
```

T005 and T006 can run in parallel. T007 needs both. T008 and T009 are sequential after T007.

### Parallel Opportunities

```bash
# Phase 1: all 3 in parallel
T001 (config) | T002 (repo method) | T003 (types)

# Phase 3: prompt and service in parallel
T005 (prompt) | T006 (service)

# Phase 5: tests in parallel
T011 (digest tests) | T012 (queue tests)
```

---

## Implementation Strategy

### MVP (Phases 1-3)

1. Complete Phase 1: Setup (T001, T002, T003 in parallel)
2. Complete Phase 2: Foundational (T004)
3. Complete Phase 3: US1+US2 (T005-T009)
4. **STOP and VALIDATE**: Build, deploy, verify one daily digest post appears
5. This is a fully functional feature

### Full Delivery

6. Phase 4: US3 (T010) -- format polish
7. Phase 5: Tests (T011-T013) -- test coverage and build check

---

## Notes

- US1 and US2 share the same implementation -- the prompt both selects (US2) and produces the post (US1)
- US3 is a refinement of the prompt formatting, not a separate code path
- No DB migrations needed -- reuses existing schema
- The `maxToolsPerDay=0` change (T004) should be deployed together with the digest feature to avoid a gap where no tools are published at all
