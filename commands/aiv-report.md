---
description: Generate the final AI Visibility report (Markdown by default) for a target domain.
argument-hint: "<target-domain> [--competitors csv] [--format md|json]"
allowed-tools: Bash, Read, Write
---

Generate the final report. The Markdown report has two sections by design:

- **A. Current site situation** — crawl coverage, 36-check summary, top
  problem areas, minimal fix recommendations.
- **B. Competitor comparison** — only when `--competitors` is supplied or
  competitors are registered.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs report $ARGUMENTS
```

2. Read the printed report path and present a 5–10 line summary to the user
   that highlights:
   - top 3–5 minimal technical fixes (with `AIVB-xxx` IDs and severity);
   - top 3 competitor gaps (if competitors were included);
   - caveats from the report.

3. Optionally invoke the `ai-visibility-reporting` skill before
   summarizing, and the `aiv-report-reviewer` agent to scan for overclaims,
   missing caveats, content-rewrite bias, or accidental `Sxxx` usage.

Rules:
- recommendations must remain minimal technical fixes (metadata, structure,
  alt text, captions, schema, internal links, prompt mappings) — never full
  page rewrites;
- never promise AI citations, AI Overview placements, or Semrush AI
  Visibility score increases;
- always show `AIVB-xxx` IDs in user-facing output.
