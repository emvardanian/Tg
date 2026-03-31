# User Profile Configuration

This file defines the end-user context for the news analysis pipeline. It is injected into Step 2 (Analysis & Scoring) to evaluate relevance and actionability against the user's actual work and interests.

---

## Primary Tech Stack

- **Backend**: Node.js, TypeScript, Python
- **Frontend**: React, React Native, Swift/SwiftUI
- **Infrastructure**: AWS (EKS, Lambda, EC2), Kubernetes, Docker
- **Databases**: MongoDB, PostgreSQL, Redis
- **CI/CD**: GitLab CI, GitHub Actions
- **AI/ML Tooling**: Claude API, Claude Code, LLM-assisted development workflows

## Active Interest Areas

### Tier 1 — Immediate relevance (score boost +1)
- New AI models and their capabilities (Claude, GPT, Gemini, open-source LLMs)
- AI-assisted coding tools and workflows (Cursor, Copilot, Claude Code, agentic coding)
- New developer tooling that changes daily workflow (terminals, editors, CLI tools)
- Kubernetes and container orchestration updates
- AWS service announcements that affect EKS/Lambda/serverless

### Tier 2 — High interest (no modifier)
- React and React Native ecosystem changes
- Node.js runtime updates and new APIs
- TypeScript language features and tooling
- Mobile development (iOS/Swift, cross-platform)
- DevOps practices, CI/CD pipeline improvements
- Cloud cost optimization and architecture patterns

### Tier 3 — Background interest (score penalty -0.5)
- Frontend frameworks outside React (Vue, Svelte, Angular)
- Programming languages outside primary stack (Rust, Go, Java) unless directly relevant
- Enterprise SaaS product announcements
- Hardware news unless it affects development workflow

### Tier 4 — Low interest (score penalty -1)
- Crypto/Web3/blockchain unless there's a genuine technical innovation
- Marketing-focused product launches without technical depth
- Corporate M&A news without technical implications
- Social media platform changes unless they affect APIs developers use

## What Counts as "Value" for This User

- Concrete technical details: benchmarks, code examples, architecture decisions, migration guides
- Tools or techniques that save time in daily development workflow
- Breaking changes or deprecations that require action
- Early access to new APIs or capabilities that provide competitive advantage
- Real-world experience reports (post-mortems, case studies, performance comparisons)

## What Does NOT Count as "Value"

- Vague "the future of X" thought pieces without specifics
- Repackaged press releases with no added analysis
- Hype-driven content ("revolutionary", "game-changing") without substance to back it up
- Tutorials for beginner-level topics
- Content that repeats what was already widely known

## Current Projects Context

- Building fintech/marketplace platforms with payment integrations
- Working with vending machine management systems (IoT + cloud)
- Exploring agentic AI workflows and Claude Code automation
- Evaluating local AI model deployment vs API usage

---

## How to Use This Profile

When evaluating relevance, match the article's content against:
1. **Tier classification** — which tier(s) does the topic fall into?
2. **Value definition** — does it meet the "counts as value" criteria?
3. **Project context** — is there a direct connection to current work?

The relevance score should reflect the combination of these factors, not just topic matching.
