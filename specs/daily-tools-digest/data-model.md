# Data Model: Daily Tools Digest

**Date**: 2026-04-09
**Branch**: daily-tools-digest

## Entities

### Item (existing -- no schema changes)

The existing `items` table already contains all fields needed:

| Field | Type | Relevance to this feature |
|-------|------|--------------------------|
| `id` | integer | Primary key for batch queries |
| `category` | text | Filter by `devtools_dx` to find tool items |
| `score` | real | Ranking within the digest |
| `classifier_score` | real | Pipeline composite score (1.0-5.0) for relevance |
| `published` | integer | 0 = unpublished, 1 = published. Filter for digest candidates |
| `telegram_message_id` | integer | 0 = published via digest, -1 = skipped by digest (new convention) |
| `title` | text | Passed to batch digest prompt |
| `url` | text | Included in digest post links |
| `summary` | text | Passed to batch digest prompt for Claude to evaluate |
| `pipeline_post` | text | Existing formatted post (not used in digest, but available) |
| `discovered_at` | text | Time window filter (past 24h) |

### No new tables required

The feature reuses existing infrastructure. The only new "entity" is the digest post itself, which is a transient Telegram message -- not stored in the DB.

## New Repository Method

```
getUnpublishedByCategory(category: string, limit: number): Item[]
```

Fetches unpublished items filtered by category, ordered by `classifier_score DESC, discovered_at ASC`.

## State Transitions

```
Tool item collected
  --> pipeline processes (extraction, analysis, summary, format)
  --> item stored with category='devtools_dx', published=0
  --> queue SKIPS this item (maxToolsPerDay=0)
  --> item waits in DB

Daily digest cron (09:00)
  --> query: all items where category='devtools_dx' AND published=0
  --> pass batch to Claude digest prompt
  --> Claude selects top 3-7 items, formats single post
  --> publish post to Telegram channel
  --> mark selected items: published=1, telegram_message_id=<actual_msg_id>
  --> mark rejected items: published=1, telegram_message_id=-1
```

## Configuration Changes

New environment variable:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TOOLS_DIGEST_HOUR` | number | 9 | Hour (0-23) when daily tools digest runs |
