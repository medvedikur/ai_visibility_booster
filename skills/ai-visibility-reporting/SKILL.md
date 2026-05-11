---
name: ai-visibility-reporting
description: Use when generating AI Visibility audit reports, crawl summaries, fix-priority reports, or executive summaries from local AI Visibility artifacts produced by ai-visibility-booster. Enforces minimal-fix language, AIVB-xxx public IDs, and explicit caveats; forbids ranking/citation guarantees.
---

# Reporting AI Visibility audit findings

This skill governs how to write reports and summaries from local
`ai-visibility-booster` artifacts. The default report shape has two lenses
that must always be kept distinct:

- **A. Current site situation** — what we crawled, what we analyzed, what
  passed/failed/needs review.
- **B. Competitor comparison** — only when competitor analyses exist.

## Format requirements

- Markdown is the default user-facing format.
- Public `AIVB-xxx` IDs are the primary identifiers in every table,
  bullet, and heading. `Sxxx` may appear only in a clearly-marked
  provenance column or footnote.
- Section A always covers: crawl coverage, 36-check summary, top problem
  areas, minimal fix recommendations, caveats.
- Section B always covers: competitor coverage warnings, target-worse
  table, target-better table.
- Avoid emojis unless the user explicitly asks for them.
- English only.

## Confidence and caveats

Always include a Caveats section that says, at minimum:

- The score is a v0.1 heuristic and is **not** a Semrush AI Visibility
  score, nor a Lighthouse score, nor a guarantee of any ranking outcome.
- Heuristic and `NEEDS_REVIEW` verdicts should be confirmed before
  remediation.
- Source provenance for every check is in `docs/source-research.md`.

If a comparison includes any competitor with fewer than 10 analyzed pages,
add an explicit coverage warning to the comparison section.

## Minimal-fix language

Recommendations must always frame fixes as minimal technical changes:
metadata, structure, alt text, captions, schema, internal links, hreflang,
prompt mappings. Examples of acceptable phrasing:

- "Add a visible 'Reviewed YYYY-MM-DD' line near the H1 (AIVB-011)."
- "Add `<figcaption>` summarizing the throughput chart (AIVB-020)."
- "Add `Article.datePublished` to the JSON-LD block (AIVB-010)."
- "Convert the prose process description into an `<ol>` (AIVB-009)."
- "Add `BreadcrumbList` schema and a visible breadcrumb (AIVB-017)."

Never recommend "rewrite this page", "increase keyword density", "add more
content", or any change that alters page meaning beyond TL;DR / list /
caption / metadata additions.

## Forbidden phrases

- "We will rank #1."
- "AI will cite this page."
- "Semrush AI Visibility will increase to N."
- "Guaranteed AI Overview placement."
- Any phrasing that frames the report as a content-rewrite plan.

## Red flags

- Reports that miss the Caveats section.
- Reports that present `Sxxx` as a primary ID.
- Reports that include competitor comparison tables without coverage
  warnings.
- Reports that imply the runtime scope is 25 checks.
