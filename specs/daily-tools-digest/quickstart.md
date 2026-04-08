# Quickstart: Daily Tools Digest

**Date**: 2026-04-09
**Branch**: daily-tools-digest

## What changes

Instead of publishing up to 2 individual tool posts per day, the system now collects all tool items and publishes one curated daily digest at 09:00.

## Files to modify

1. **`src/publisher/queue.ts`** -- Set maxToolsPerDay to 0 (block all individual tool posts)
2. **`src/storage/repositories/items.repo.ts`** -- Add `getUnpublishedByCategory()` method
3. **`src/pipeline/tools-digest.service.ts`** -- NEW: batch Claude call for tools digest
4. **`prompts/05_tools_digest.md`** -- NEW: prompt for batch tools curation
5. **`src/scheduler.ts`** -- Add daily tools digest cron job
6. **`src/config.ts`** -- Add `TOOLS_DIGEST_HOUR` config
7. **`src/index.ts`** -- Wire up ToolsDigestService, set maxToolsPerDay=0, pass to scheduler

## Files to test

1. **`tests/pipeline/tools-digest.test.ts`** -- NEW: test batch digest service
2. **`tests/publisher/queue.test.ts`** -- Update: verify tools are fully excluded
3. **`tests/scheduler.test.ts`** -- Update or NEW: verify digest cron is registered

## How to verify locally

```bash
# Build
npm run build

# Run tests
npm run test

# Manual test: run the digest function directly
# (requires items in DB with category='devtools_dx' and published=0)
npm run dev
# Then trigger via admin command or wait for cron
```

## Deployment

Standard: SSH to server, git pull, npm run build, restart service. No DB migrations needed.
