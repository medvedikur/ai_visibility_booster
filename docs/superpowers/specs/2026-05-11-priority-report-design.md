# Single-site priority report — design

Status: approved by user 2026-05-11
Owner: Mike Urbanovich
Target plugin: `ai-visibility-booster` (this repo)

## 1. Motivation

The plugin already evaluates each page against 36 BASIC AI Visibility checks
(`AIVB-001` through `AIVB-036`) and produces a per-page score plus a
Markdown report. The existing `/aiv-report` output ranks checks by raw fail
count alone and does not distinguish a Critical check failing on 1% of pages
from a Low check failing on 90% of pages.

The reference report we are reproducing —
`a1qa ai visibility/.claude/worktrees/cool-hodgkin-9a9fef/outputs/basic-lite/priority-report.html` —
introduces a single composite **PRIORITY** score from 0 to 100 that combines
fail rate and severity, sorts all 36 checks on one axis, groups them into
four buckets, and explains each row in business language. That single axis
is the value: an engineer or marketer reads top-to-bottom and stops when
they run out of effort.

The reference report uses competitor benchmarking and AI Visibility
correlation as additional factors. **This spec deliberately drops those
factors.** We are producing a single-site report; competitor logic stays in
`/aiv-compare` for later work.

## 2. Scope

In scope:

- New `/aiv-priority <domain>` command that emits a self-contained HTML
  priority report for one analyzed site.
- New `--thorough` flag on `/aiv-analyze` that runs the existing
  `aiv-page-auditor` subagent over residual `NEEDS_REVIEW` verdicts and
  resolves them to PASS / FAIL / N/A.
- Detector corrections for five checks (AIVB-012, 019, 030, 034, 035) that
  systematically produce false positives or false negatives compared to a
  page-aware LLM judge.
- Exclusion of AIVB-029 (Core Web Vitals) from the priority computation
  because it requires a third-party performance data source the plugin does
  not call.
- New `priorityProblem` field on every check in `lib/checks.mjs`, populated
  for all 36 checks with English business-language text.

Out of scope:

- Any competitor comparison logic in the priority report.
- AI Visibility rank metadata or POS/NEG/NEUT/INERT correlation classifier.
- Changes to `/aiv-compare` or to the existing Markdown `/aiv-report`.
- Translation of report text to any non-English language.
- A web UI; the plugin remains chat-driven.
- Any change to the 36 AIVB IDs, their `sourceId` mapping, or to the
  English-only documentation rule (`tests/language.test.mjs`).

## 3. PRIORITY formula

For each check `c` evaluated on the target site:

```
fail_pct(c)        = 100 * count(verdict == FAIL on c) /
                     count(verdict in {PASS, FAIL} on c)
                     ; pages with verdict == NEEDS_REVIEW or N/A are excluded
                     ; AIVB-029 is excluded from /aiv-priority entirely

severity_weight(c) = { Critical: 1.00,
                       High:     0.85,
                       Medium:   0.70,
                       Low:      0.50 }[severity(c)]

PRIORITY(c)        = clamp(0, 100, fail_pct(c) * severity_weight(c))
```

Buckets:

| Bucket  | Range  | Row background     |
|---------|--------|--------------------|
| HIGH    | 50-100 | `#fdecea` (red)    |
| MEDIUM  | 20-49  | `#fff8e0` (yellow) |
| LOW     | 5-19   | `#f3fbf6` (green)  |
| NONE    | 0-4    | `#fafafa` (gray)   |

Rows are sorted by `PRIORITY` descending; ties break by `fail_pct`
descending, then by `AIVB` ID ascending. A section divider row is inserted
each time the bucket changes.

Edge cases:

- If `count(verdict in {PASS, FAIL} on c) == 0` (e.g. every analyzed page
  returned N/A for that check), `fail_pct(c)` is reported as `N/A` and the
  check is placed in the `NONE` bucket with priority 0 and a `Why this
  priority` cell that says "No applicable pages on this site."
- Residual `NEEDS_REVIEW` verdicts after the `--thorough` run are excluded
  from the denominator but are surfaced as a counter in the report footer
  per check, so the reader knows how much evidence was inconclusive.

## 4. Input pipeline

`/aiv-priority` reads three artifacts:

1. `.ai-visibility/sites/<domain>/site.json` — domain identity.
2. The latest (or `--run-id <ts>`) analysis directory:
   `.ai-visibility/sites/<domain>/analyses/<ts>/verdicts.json`.
3. The plugin manifest for header metadata.

The verdicts file must contain PASS / FAIL / N/A / NEEDS_REVIEW for all 36
checks. `/aiv-priority` does not crawl, does not analyze, and does not
invoke any subagent on its own — it is a pure transformation.

To make the verdicts file faithful enough for the formula, `/aiv-analyze`
gains a `--thorough` flag that runs a second pass:

```
/aiv-analyze <domain> [existing flags] --thorough
   1. Run heuristic pass as today (no change).
   2. For every (page, check) where the heuristic returned NEEDS_REVIEW,
      invoke the aiv-page-auditor subagent with the existing per-page
      JSON snapshot and the per-check pass-criteria text from checks.mjs.
   3. Persist the resolved verdict (PASS / FAIL / N/A) plus a one-line
      evidence string back into the same analyses/<ts>/verdicts.json.
   4. If the subagent is unavailable or refuses, keep NEEDS_REVIEW and
      record the failure reason on the verdict. Do not crash.
```

`--thorough` is opt-in. Without it, `/aiv-priority` still works but the
report headers warn the reader that the underlying analysis was not
LLM-resolved and that priority scores are likely understated for checks
that returned NEEDS_REVIEW.

## 5. Detector corrections in `lib/analyzer.mjs`

These five checks misclassify on real sites and bias the priority output.
We do not change their public IDs, severity, or pass criteria text — only
the evaluator that produces the verdict.

### AIVB-012 — Named author/reviewer (`sourceId: S037`)

- Today: always returns `NEEDS_REVIEW`.
- Change: classify the page first.
  - Page type signals: URL path patterns (`/services/`, `/industries/`,
    `/products/`, `/solutions/`, `/about/`, `/contact/`,
    `/legal/`, `/privacy/`), schema `@type`, and template hints from the
    extracted snapshot.
  - If page type is `service`, `industry`, `product`, `solution`, `legal`,
    `contact`, `about` → verdict `N/A` with evidence
    `Page type does not require named expertise byline`.
  - If page type is `blog`, `news`, `article`, `case`, `whitepaper` and a
    visible byline / `author` JSON-LD is present → `PASS`.
  - If page type is expertise-sensitive and no byline → `NEEDS_REVIEW`
    (resolved by `aiv-page-auditor` under `--thorough`).
- Pass-criteria text and `minimalFix` unchanged.

### AIVB-019 — Meaningful images have alt text (`sourceId: S047`)

- Today: declares a page `PASS` when one of one detected "meaningful" image
  has alt text. The filter is too narrow.
- Change: broaden the "meaningful image" definition.
  - Counts as meaningful: any `<img>` rendered in the document body (not
    inside `<nav>`, `<header role="banner">`, `<footer>`,
    `[role="navigation"]`, or `[aria-hidden="true"]` containers) whose
    declared or rendered width and height are both `>= 96px`, plus any
    `<picture>` source with the same bounds, plus any inline SVG with a
    `<title>` element or `aria-label`.
  - Decorative images (`alt=""` explicitly, `role="presentation"`, or
    `aria-hidden="true"`) are excluded from the denominator.
  - Report `missing_alt_pct = missing_alt / meaningful_total` and
    return `FAIL` when `missing_alt_pct >= 0.1` (10% of meaningful images
    lacking alt), `PASS` when `missing_alt_pct == 0`, otherwise
    `NEEDS_REVIEW` (resolved by judge).
  - Evidence string reports both counts:
    `Meaningful images=N; missing alt=M (P%); decorative=K`.

### AIVB-029 — Core Web Vitals (`sourceId: S060`)

- Today: returns `NEEDS_REVIEW`.
- Change: tag with `excludeFromPriority: true` in `checks.mjs`. The verdict
  remains in `verdicts.json` for completeness, but `/aiv-priority` filters
  it out before computing buckets. The report footer lists it under
  "Checks excluded from priority computation (require external data)".

### AIVB-030 — Interstitial / overlay blocking (`sourceId: S061`)

- Today: marks any element with `position: fixed` and cookie / consent /
  modal class names as FAIL.
- Change: demote to `needs-claude-review`. Heuristic now only flags
  candidates (records DOM evidence). The judge decides whether the overlay
  actually blocks main content (`z-index`, dismissibility, viewport
  coverage, content-on-top-of-overlay test).

### AIVB-034 — Hreflang for multilingual pages (`sourceId: S066`)

- Today: any page with `lang="en-us"` (or similar) but no `hreflang` links
  is FAIL.
- Change: detect site-level multilingual signals before failing.
  - Site is multilingual if any crawled page declares `<link
    rel="alternate" hreflang="...">`, OR a URL pattern like `/<lang>/`
    appears for two or more distinct language codes, OR there is a visible
    language switcher (links whose text matches ISO language names).
  - Single-language sites: verdict `N/A` with evidence
    `Single-language site; hreflang not required`.
  - Multilingual sites without hreflang on a given page: `FAIL` as today.

### AIVB-035 — Title / H1 / og:title / schema name alignment (`sourceId: S067`)

- Today: string-compares the four fields after lowercase + whitespace
  normalization.
- Change: demote to `needs-claude-review`. Heuristic computes a similarity
  ratio and exposes it as evidence; the judge decides whether the variants
  are semantically aligned (e.g. marketing title vs short H1 category is
  still aligned).

## 6. `priorityProblem` field on every check

`lib/checks.mjs` already carries `id`, `sourceId`, `title`, `description`,
`severity`, `gapCategory`, `scope`, `evaluationMode`, `minimalFix`,
`sourceEvidence`. Add one more required field:

```
priorityProblem: string  // English, business-language, one sentence,
                         // explains WHY the check matters for AI Visibility
```

Test `tests/checklist.test.mjs` is extended to assert every check has a
non-empty `priorityProblem`. Test `tests/language.test.mjs` continues to
enforce English-only across all docs and source.

The priority report's "Why this priority" cell renders:

```
What's wrong: <priorityProblem>
What to fix:  <minimalFix>
```

When `fail_pct < 5`:

```
Not worth fixing — only X% of pages have this issue.
```

When `count(PASS+FAIL) == 0`:

```
No applicable pages on this site.
```

## 7. Report HTML

Output file: `.ai-visibility/reports/<timestamp>-<domain>-priority.html`.

Sibling JSON: `.ai-visibility/reports/<timestamp>-<domain>-priority.json`
with the computed rows array `[{checkId, sourceId, title, severity,
fail_pct, severity_weight, priority, bucket, decorativeImagesCount, ...}]`
for downstream tooling.

Layout (single-site, no competitor columns):

```
<title>AI Visibility fix-priority — {domain}</title>

<h1>AI Visibility fix-priority — {domain}</h1>

<div class="summary-box">
  How to read this table: top rows are the most important fixes; bottom
  rows are checks where the problem barely exists. Row background tracks
  priority (red → yellow → green → gray). The PRIORITY column is a 0-100
  importance score. Severity and Priority scales are explained below the
  table.
</div>

<table>
  <thead>
    <tr>
      <th>PRIORITY</th>
      <th>ID</th>
      <th>Severity</th>
      <th>What is checked</th>
      <th>Pages failing</th>
      <th>Why this priority</th>
    </tr>
  </thead>
  <tbody>
    [section-divider rows per bucket transition]
    [rows sorted by PRIORITY desc, ties by fail_pct desc, then ID asc]
  </tbody>
</table>

<div class="footer-explainers">
  <h3>What "Severity" means</h3>
  <ul>
    <li><strong>Critical</strong> — without this the page does not enter
        the index or AI answers at all.</li>
    <li><strong>High</strong> — strongly reduces AI citation likelihood.</li>
    <li><strong>Medium</strong> — noticeably hurts quality without blocking.</li>
    <li><strong>Low</strong> — minor hygiene.</li>
  </ul>

  <h3>What "Priority" means</h3>
  <p>Score from 0 to 100 = how much you should fix this check on this site.
     Combines two factors:</p>
  <ol>
    <li>What share of your pages currently fail the check.</li>
    <li>Severity of the check itself (Critical weighs more than Low).</li>
  </ol>
  <p>Bucketing: HIGH (50-100), MEDIUM (20-49), LOW (5-19), NONE (&lt;5).</p>

  <h3>Checks excluded from priority computation</h3>
  <p>AIVB-029 (Core Web Vitals) is excluded because it requires a
     third-party performance data source the plugin does not call. Run
     PageSpeed Insights or CrUX separately to evaluate this check.</p>

  <h3>Coverage</h3>
  <p>Analyzed {N} pages from a crawl of {M} URLs. {K} verdicts remained
     NEEDS_REVIEW after the analysis run.</p>
</div>
```

Tooltips:

- `PRIORITY` cell `title="Priority X (Y% of pages fail × severity Z = X)"`.
- `ID` cell and `What is checked` cell `title="<check title>\n\nPass
  criteria: <check pass criteria>"`.

Styling intentionally mirrors the reference report's palette and CSS for
visual continuity, but all UI strings are English.

## 8. File map

```
commands/
  aiv-priority.md            NEW
  aiv-analyze.md             EDIT — document --thorough
lib/
  priority.mjs               NEW — pure: verdicts → rows + buckets
  priority-report-html.mjs   NEW — pure: rows → HTML string
  judge.mjs                  NEW — orchestrates aiv-page-auditor subagent
  analyzer.mjs               EDIT — corrections for AIVB-012/019/030/034/035,
                                    --thorough hook, exclude AIVB-029 from priority
  checks.mjs                 EDIT — add priorityProblem on all 36 checks,
                                    add excludeFromPriority on AIVB-029
bin/aiv.mjs                  EDIT — wire /aiv-priority subcommand and --thorough flag
agents/aiv-page-auditor.md   EDIT — confirm prompt covers AIVB-012/019/030/035
tests/
  priority.test.mjs          NEW — formula, buckets, NEEDS_REVIEW excluded,
                                    AIVB-029 filtered
  priority-report.test.mjs   NEW — HTML structure, English-only, section dividers
  judge.test.mjs             NEW — agent-unavailable path preserves NEEDS_REVIEW
  analyzer.test.mjs          EDIT — fixtures for the 5 corrected detectors
  checklist.test.mjs         EDIT — assert priorityProblem present on all checks
  cli.test.mjs               EDIT — smoke /aiv-priority on fixture site
docs/
  spec.md                    EDIT — describe /aiv-priority, --thorough, formula
  source-research.md         EDIT — note the 5 detector corrections
```

## 9. End-to-end UX

```
/aiv-crawl https://site.com --limit 200
/aiv-analyze site.com --random 50 --seed 42 --thorough
/aiv-priority site.com

→ .ai-visibility/reports/<ts>-site.com-priority.html
→ .ai-visibility/reports/<ts>-site.com-priority.json
```

`/aiv-priority` requires the analysis to exist. `--run-id <ts>` selects a
specific older analysis; default is the latest run for the domain.

## 10. Non-goals reminder

- No external HTTP calls during priority computation. The only external
  call in the pipeline is the LLM judge invoked through Claude Code's own
  subagent tool — there is no Semrush, no PSI, no Lighthouse, no headless
  browser.
- No write to `verdicts.json` from `/aiv-priority`. Priority is a
  consumer, not a producer of analysis data.
- No change to existing `/aiv-compare` or `/aiv-report`. The user can run
  both old and new in the same project; they read the same analyses.

## 11. Acceptance

- `/aiv-priority` on a fixture site produces a deterministic HTML file
  whose row order, bucket counts, and tooltips match expected snapshots.
- `tests/priority.test.mjs` covers: an all-PASS site → all priority 0,
  all rows in NONE; an all-FAIL Critical-only site → priorities 100,
  HIGH bucket; mixed severities with realistic fail percentages → correct
  ordering and bucket boundaries; AIVB-029 absent from output.
- The five corrected detectors have at least one fixture each that
  reproduces the false positive / false negative observed against the
  reference and asserts the new behavior.
- The English-only test passes; no Cyrillic anywhere in shipped code,
  docs, or fixtures.
