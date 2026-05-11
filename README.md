# AI Visibility Booster

A Claude Code plugin for **technical AI Visibility audits**: crawl public
URLs, run 36 basic AI crawler-readiness checks against each selected page,
optionally compare against competitors, and generate Markdown/JSON reports —
all locally, with no third-party APIs.

> AI Visibility = how often a brand surfaces in answers from ChatGPT,
> Perplexity, Gemini, Google AI, and similar systems. This plugin audits the
> technical foundation that makes a site eligible to be cited.

## What this is

- **Local audit pipeline** for the 36 BASIC AI Visibility checks identified
  by source research as the practical baseline for crawler-readiness and
  extractability.
- **Claude Code commands** for crawl, analyze, compare, report.
- **Stable public IDs**: every check has an `AIVB-NNN` identifier (`AIVB-001`
  through `AIVB-036`).

## What this is not

- **Not a content rewriting product.** Recommendations stay minimal and
  extractive (TL;DR/key-takeaway blocks, splitting overly long sentences,
  converting prose lists to bullets, adding visible dates / authors,
  adding image captions, adding metadata or prompt mappings).
- **No guarantees** of AI citations, AI Overview placements, or Semrush AI
  Visibility score increases.
- **No CAPTCHA / WAF / authentication bypass.**
- **No Semrush API dependency** in v0.1.0.
- **No Web UI** in v0.1.0 — Claude Code chat is the only interface.

## Scope: 36 checks (`AIVB-001` through `AIVB-036`)

The runtime evaluates every selected page against exactly 36 BASIC checks
covering:

- HTTP success and clean access
- Sitemap, canonical, internal linking
- Indexability and snippet controls
- Heading hierarchy and topic clarity
- Readability and structured lists/tables
- Freshness, authorship, expertise signals
- Media (alt, captions, og:image, filenames, video)
- JSON-LD type/coverage/rich-result fields
- Mobile/SSR rendering and overlay safety
- Accessibility (labels, ARIA, agent compatibility)
- Hreflang and title/H1/og:title alignment
- Strategic page prompt-coverage

The full table is printed by `/aiv-checklist` and detailed in
`docs/source-research.md`.

> The plugin does not use a 25-check subset. Anyone documenting "25 checks"
> is reading stale material.

## Public ID model

- The primary identifier on every check is `AIVB-NNN` (e.g. `AIVB-019`).
- Each check stores a `sourceId` (e.g. `S047`) for traceability back to the
  original research repository — provenance metadata only.
- All CLI output, reports, and JSON artifacts use the public `AIVB-xxx` IDs.

## Install

This plugin requires Node.js 20 or newer. It has **no runtime npm
dependencies**.

### Install from GitHub (recommended)

The repository ships its own `.claude-plugin/marketplace.json`, so Claude
Code can install it directly from GitHub — no clone, no npm, no global
install step.

In a Claude Code session, run:

```
/plugin marketplace add medvedikur/ai_visibility_booster
/plugin install ai-visibility-booster@ai-visibility-booster
```

The first command registers this repo as a local marketplace. The second
installs the plugin from it (the `@ai-visibility-booster` suffix is the
marketplace name, which happens to match the plugin name).

Verify it loaded:

```
/plugin
/aiv-doctor
```

If the `/aiv-*` commands do not appear immediately, run `/reload-plugins`
or restart the Claude Code session.

To update later:

```
/plugin marketplace update ai-visibility-booster
/plugin install ai-visibility-booster@ai-visibility-booster
```

To remove:

```
/plugin uninstall ai-visibility-booster
/plugin marketplace remove ai-visibility-booster
```

### Install from a local clone

Useful if you want to hack on the plugin itself.

1. Clone the repository:
   ```
   git clone https://github.com/medvedikur/ai_visibility_booster.git
   cd ai_visibility_booster
   ```
2. Confirm the CLI works standalone:
   ```
   node bin/aiv.mjs checklist
   node bin/aiv.mjs doctor
   ```
3. Add the local checkout as a marketplace and install:
   ```
   /plugin marketplace add /absolute/path/to/ai_visibility_booster
   /plugin install ai-visibility-booster@ai-visibility-booster
   ```

### Marketplace install (after acceptance)

Once the plugin is accepted into the official Claude Code plugin directory,
it can also be installed via Claude Code's plugin browser. The plugin name
is `ai-visibility-booster`.

## Quick start

```
/aiv-doctor
/aiv-checklist
/aiv-crawl https://site.com --limit 100
/aiv-analyze site.com --random 20 --seed 42
/aiv-add-competitor site.com https://testlio.com
/aiv-crawl https://testlio.com --limit 100
/aiv-analyze testlio.com --random 20 --seed 42
/aiv-compare site.com --competitors testlio.com
/aiv-report site.com --competitors testlio.com
```

The report ends up in `./.ai-visibility/reports/<timestamp>-<domain>.md`.

## Commands

| Command | Purpose |
|---|---|
| `/aiv-crawl <url> [--limit N] [--depth N] [--sitemap-only]` | Crawl URL inventory; saves crawl-run artifacts. |
| `/aiv-analyze <domain> [--random N --seed N] [--all] [--urls csv]` | Analyze pages against 36 `AIVB-xxx` checks. |
| `/aiv-add-competitor <target> <competitor-url>` | Register a competitor for a target domain. |
| `/aiv-compare <target> [--competitors csv]` | Compare target vs competitors using saved analyses. |
| `/aiv-report <target> [--competitors csv] [--format md|json]` | Generate the final Markdown/JSON report. |
| `/aiv-status [target]` | Show local artifact status. |
| `/aiv-checklist` | Print the 36 public checks (severity, mode, source ID, fix family). |
| `/aiv-doctor` | Validate plugin install, Node version, artifact folders, English-only docs. |

## Local artifact structure

```
.ai-visibility/
  sites/
    <domain>/
      site.json
      url-tree.json
      competitors.json
      crawl-runs/<timestamp>/
        stats.json
        urls.json
        pages/<hash>.json
      analyses/<timestamp>/
        input.json
        verdicts.json
        summary.json
        check-matrix.json
  comparisons/<timestamp>/comparison.json
  reports/<timestamp>-<domain>.md
```

## Limitations

- v0.1.0 evaluators are **deterministic / heuristic / needs-claude-review**.
  Many checks (e.g. mobile-rendered visibility, performance, prompt
  coverage) cannot be proven from static HTML alone and intentionally return
  `NEEDS_REVIEW`. The included Claude skills and `aiv-page-auditor` agent
  help close those reviews when enough evidence is present.
- The crawler is intentionally polite (default concurrency 3, 250 ms sleep,
  default limit 200 URLs, same-origin only) and does **not** bypass auth,
  CAPTCHA, or WAF defenses.
- The score is a v0.1 heuristic — not a Semrush AI Visibility score, not a
  Lighthouse score, and not a guarantee of any ranking outcome.
- No browser rendering / JS execution in v0.1.0; JS-only single-page apps
  will appear under-extracted (which is itself a finding via `AIVB-032`).
- The runtime has no external npm dependencies. Everything runs on Node 20+
  built-ins (`fetch`, `node:test`, `node:fs/promises`).

## Safety and crawl ethics

- Same-origin only by default.
- Default `--limit 200` (cap 5000), default `--depth 2`, default request
  timeout 15 s, default concurrency 3, default sleep 250 ms.
- Fixed user agent: `AIVisibilityBooster/0.1
  (+https://github.com/medvedikur/ai_visibility_booster)`.
- `robots.txt` is parsed for sitemap discovery and obvious `Disallow` notes.
- The plugin reads no secrets and writes only JSON / Markdown.

## Development and tests

```
node --test tests/*.test.mjs
node bin/aiv.mjs checklist
node bin/aiv.mjs doctor
```

See `docs/spec.md`, `docs/plan.md`, `docs/testing.md`, and
`docs/source-research.md` for design and provenance.

## License

MIT — see `LICENSE`.
