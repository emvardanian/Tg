# Feature Specification: Daily Tools Digest

**Feature Branch**: `daily-tools-digest`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "потрібно переробити повністю те, як новини приходять про тулзи. Мені вони не потрібні постійно. нехай просто раз на день клод робить самері по всіх, підбирає, які мені підійшли б найкраще і дає мені один пост про тулзи."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily curated tools post (Priority: P1)

As a channel subscriber, I receive one well-curated Telegram post per day that summarizes the best developer tools discovered across all sources, instead of receiving sporadic individual tool posts throughout the day.

**Why this priority**: This is the core value proposition -- replacing noise (multiple individual tool posts) with signal (one curated daily summary). Delivers immediate improvement to channel quality.

**Independent Test**: Can be fully tested by running the daily tools digest cycle and verifying a single consolidated post appears in the Telegram channel containing ranked tool summaries.

**Acceptance Scenarios**:

1. **Given** tool items have been collected from various sources throughout the day, **When** the daily tools digest time arrives, **Then** the system generates a single Telegram post summarizing the best tools with brief descriptions and links.
2. **Given** tool items have been collected, **When** the digest is generated, **Then** no individual tool posts are published to the channel -- only the consolidated digest post.
3. **Given** no tool items were collected on a given day, **When** the daily tools digest time arrives, **Then** no tools post is published (skip silently).

---

### User Story 2 - Personalized tool selection (Priority: P1)

As the channel owner, the AI pipeline evaluates all collected tool items against my profile and interests, selecting only the most relevant ones for the daily digest rather than including everything.

**Why this priority**: Equal priority with US1 -- the digest is only valuable if the tools are personally relevant. Without curation, it would just be a bulk dump.

**Independent Test**: Can be tested by feeding a mix of relevant and irrelevant tool items and verifying the digest only includes items that match the user profile criteria defined in the pipeline prompts.

**Acceptance Scenarios**:

1. **Given** 10 tool items collected from various sources, **When** the digest pipeline runs, **Then** it selects a subset (not all) based on relevance to the user's profile and interests.
2. **Given** collected tools span different subcategories (CLI tools, frameworks, SaaS products, libraries), **When** the digest is generated, **Then** items are ranked by relevance score and only the top items are included.
3. **Given** all collected tools on a given day are low-relevance, **When** the digest pipeline runs, **Then** it may include fewer items or skip the digest entirely rather than padding with irrelevant content.

---

### User Story 3 - Readable digest format (Priority: P2)

As a channel subscriber, the daily tools digest post is well-structured with a clear heading, brief per-tool summaries, and direct links -- easy to scan and act on.

**Why this priority**: Important for usability but secondary to the core collection and curation logic. The format enhances the experience but the feature works without a polished format.

**Independent Test**: Can be tested by generating a digest and verifying it contains a title, tool names, one-line descriptions, and clickable links in a scannable layout.

**Acceptance Scenarios**:

1. **Given** the digest pipeline has selected 3-5 tools, **When** the post is formatted, **Then** each tool has a name, one-line description, and a link to the source.
2. **Given** the digest is generated, **When** it is published, **Then** the post uses Telegram HTML formatting with clear visual hierarchy (heading, tool entries, optional tags).

---

### Edge Cases

- What happens when only 1 tool item is collected in a day? The digest still publishes if the item is relevant, formatted as a single-tool highlight.
- What happens when tool collection sources are temporarily unavailable? Digest works with whatever items were successfully collected; no error post is sent.
- What happens when the digest pipeline (Claude) fails? The system logs the error and skips the digest for that day. No fallback to individual tool posts.
- What happens with tools already in the publish queue when this feature launches? Existing queued tool items are consumed by the next digest cycle instead of being published individually.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT publish individual tool-category posts to the Telegram channel.
- **FR-002**: System MUST collect and store tool items from all configured sources throughout the day as it does currently.
- **FR-003**: System MUST run a daily digest pipeline that takes all unpublished tool items from the past 24 hours and generates a single curated summary.
- **FR-004**: The digest pipeline MUST evaluate each tool item against the user's profile/interests and select only the most relevant ones.
- **FR-005**: The digest pipeline MUST produce a single formatted Telegram post containing the selected tools with names, brief descriptions, and source links.
- **FR-006**: System MUST publish the tools digest post once per day at a configured time.
- **FR-007**: System MUST mark all tool items (both selected and rejected) as "processed" after the digest runs, so they are not re-processed the next day.
- **FR-008**: System MUST skip publishing the tools digest if no relevant tools were found for that day.
- **FR-009**: The tools digest pipeline MUST be a separate step from the existing per-item pipeline -- it operates on a batch of already-processed items.

### Key Entities

- **Tools Digest**: A batch summary generated from multiple individual tool items, containing curated selections with descriptions and links.
- **Tool Item**: An individual news item classified as tools/devtools_dx category, collected from any source.
- **Digest Schedule**: The configured time and frequency for generating and publishing the tools digest (once daily).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero individual tool posts appear in the Telegram channel after the feature is enabled -- all tool content arrives as a single daily digest.
- **SC-002**: The daily tools digest contains no more than 5-7 tools, each selected for personal relevance.
- **SC-003**: The daily digest post is published exactly once per day at the configured time (no duplicates, no missed days when tools exist).
- **SC-004**: All tool items from the day are accounted for after the digest runs -- none remain in an "unpublished" limbo state.

## Assumptions

- The existing collector infrastructure for tool sources (RSS, HN, Product Hunt, GitHub Trending, Web Search) remains unchanged -- only the publishing behavior changes.
- The existing per-item pipeline (extraction, analysis, summary, format) continues to run for individual tool items to produce scores and metadata. The digest pipeline is an additional aggregation step.
- The user profile and interests for tool relevance evaluation are derived from the same profile data used in the existing analysis pipeline prompt (02_analysis.md).
- Daily digest time defaults to a reasonable morning slot (aligned with existing digest schedule) unless configured otherwise.
- The digest post language and style match the existing channel tone (Ukrainian, technical audience).
