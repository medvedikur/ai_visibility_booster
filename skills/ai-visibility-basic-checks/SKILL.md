---
name: ai-visibility-basic-checks
description: Use when auditing website pages for AI crawler visibility, AI search extractability, technical SEO crawler readiness, or applying the 36 basic AI Visibility checks (AIVB-001..AIVB-036). Forbids content rewriting recommendations and forbids treating Sxxx as a public ID.
---

# Auditing pages with the 36 basic AI Visibility checks

This skill governs how to apply the 36 BASIC AI Visibility checks shipped
with `ai-visibility-booster`. The runtime scope is **exactly 36 checks**,
identified by public IDs `AIVB-001` through `AIVB-036`. Source IDs (`Sxxx`)
are provenance metadata only.

## When to use

- Auditing a single page or a sampled batch of pages from a crawl run.
- Reviewing `NEEDS_REVIEW` verdicts produced by deterministic/heuristic
  evaluators in `verdicts.json`.
- Helping a user understand which fixes a check implies.

## Verdict vocabulary

Every per-page-per-check verdict is one of:

- `PASS` — evidence shows the check is satisfied. Always cite the evidence
  string from the artifact; never invent it.
- `FAIL` — evidence shows the check is violated. Always cite evidence.
- `N/A` — the check does not apply to this page (with `naReason` of
  `not_applicable`, `pending_access`, or `missing_data`). Explain why.
- `NEEDS_REVIEW` — the deterministic/heuristic evaluator cannot conclude.
  Use available evidence to push toward `PASS`/`FAIL`/`N/A` only when the
  evidence is sufficient. Otherwise leave it as `NEEDS_REVIEW` and
  explicitly state what is missing.

## Evaluation modes

- `deterministic` — outputs are reproducible from the page snapshot alone.
  Do not override unless you have a stronger signal from the snapshot itself.
- `heuristic` — outputs are derived from rules with thresholds. You may
  override with explicit evidence; explain the override.
- `needs-claude-review` — these checks (e.g. `AIVB-012`, `AIVB-015`,
  `AIVB-020`, `AIVB-023`, `AIVB-028`, `AIVB-029`, `AIVB-033`, `AIVB-036`)
  start as `NEEDS_REVIEW`. Promote to `PASS`/`FAIL`/`N/A` only with cited
  evidence from the snapshot.

## Review protocol

1. Open the latest `verdicts.json` for the analyzed domain.
2. Filter to `NEEDS_REVIEW` items, then sort by severity (Critical → Low).
3. For each item, read the page snapshot under
   `crawl-runs/<id>/pages/<hash>.json` and look for the specific signals
   the check requires (e.g. for `AIVB-012`: visible byline,
   `Person` JSON-LD, `author` field on `Article` JSON-LD).
4. If you can confirm `PASS`, write a short, concrete evidence string.
5. If you must flip to `FAIL`, cite the missing signal explicitly.
6. If still unsure, leave `NEEDS_REVIEW` and document what evidence would
   resolve it.
7. Save updated verdicts under a `claudeReview` key — do not overwrite the
   deterministic/heuristic verdict.

## Minimal-fix family

Recommendations should always be **minimal and extractive**:

- add a TL;DR or key-takeaways block without changing meaning;
- split overly long sentences;
- convert existing prose lists into bullets/tables;
- add visible reviewed/published dates;
- add a visible byline and `Person` JSON-LD;
- add image captions / `figcaption` companions;
- add or correct schema (`Article`, `BreadcrumbList`, `VideoObject`);
- add an `og:image` or schema `image` if missing;
- align title / H1 / og:title / schema headline;
- add prompt-mapped FAQ blocks for strategic pages.

## Red flags — never do these

- Recommend rewriting the whole page or replacing meaning.
- Mark `PASS` without quoting evidence.
- Treat missing signals as automatic `FAIL` without explaining why.
- Reduce the runtime scope to "25 checks" (the runtime scope is 36).
- Use `Sxxx` as a public/user-facing ID. The public ID is `AIVB-NNN`.
- Promise AI citations, AI Overview placements, or Semrush AI Visibility
  growth.

## Output style

When writing review output, prefix each verdict line with the public ID:

```
AIVB-012: PASS — author "John Reviewer" appears in JSON-LD Article.author.name and as a visible byline ("Reviewed 2026-04-20 by John Reviewer").
```

If a source ID is needed for traceability, append it parenthetically:
`(provenance: S037)`. Never use it as the lead identifier.
