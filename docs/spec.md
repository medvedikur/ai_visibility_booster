# AI Visibility Booster — Specification (v0.1.0)

## 1. Problem statement

AI Visibility Booster helps teams audit website crawlability and
extractability for AI search and citation systems through 36 basic technical
checks. It ships as a Claude Code plugin that runs locally, crawls public
URLs, evaluates each selected page against `AIVB-001` through `AIVB-036`,
generates Markdown/JSON reports, and supports lightweight competitor
comparison.

The runtime scope is exactly the 36 BASIC hot-list checks identified by the
source research as the practical baseline (`docs/source-research.md`). It is
explicitly **not** a 25-check subset and **not** the full audit checklist.

## 2. Non-goals

- Not a content rewriting product. Recommendations stay minimal and
  extractive (TL;DR, key takeaways, splitting overly long sentences,
  converting prose lists into bullets, adding visible dates / authors,
  adding image captions, adding metadata or prompt mappings).
- No guarantees of AI citations, AI Overview placements, or Semrush AI
  Visibility score increases.
- No CAPTCHA / WAF / bot-defense bypass.
- No scraping behind authentication.
- No Semrush API dependency in v0.1.0.
- No Web UI in v0.1.0 — Claude Code chat is the only interface.

## 3. Users

- SEO / AI Visibility specialists running first-pass site audits.
- Technical marketers preparing fix lists for engineering.
- Webmasters validating template changes before production.
- QA / engineering teams checking crawler-readiness pre-release.
- Claude Code users running local AI Visibility audits without standing up
  a separate audit app.

## 4. Plugin commands

| Command | Purpose |
|---|---|
| `/aiv-crawl <url> [opts]` | Crawl URL inventory for a public site, save artifacts. |
| `/aiv-analyze <domain> [opts]` | Analyze selected pages against the 36 `AIVB-xxx` checks. |
| `/aiv-add-competitor <target-domain> <competitor-url>` | Register a competitor for the target domain. |
| `/aiv-compare <target-domain> [opts]` | Compare target vs competitors using saved artifacts. |
| `/aiv-report <target-domain> [opts]` | Generate the final Markdown/JSON report. |
| `/aiv-status [target-domain]` | Show local artifact status. |
| `/aiv-checklist` | Print the 36 public checks (severity, mode, source ID, fix family). |
| `/aiv-doctor` | Validate plugin install, Node version, artifact folders, English-only docs. |

Argument grammar matches the CLI in `bin/aiv.mjs` (Phase 8 of the plan).

## 5. Local artifact model

All artifacts live under a `./.ai-visibility/` directory inside the user's
project (or the directory passed via `--artifacts <dir>`).

```
.ai-visibility/
  sites/
    <domain>/
      site.json                 # site metadata
      url-tree.json             # discovered URL inventory
      competitors.json          # registered competitor domains
      crawl-runs/
        <timestamp>/
          stats.json            # crawl summary
          urls.json             # final URL list with status
          pages/
            <hash>.json         # per-page snapshot (extracted DOM signals)
      analyses/
        <timestamp>/
          input.json            # selected URLs + sampling args
          verdicts.json         # per-URL per-check verdicts
          summary.json          # aggregate stats
          check-matrix.json     # check x url matrix
  comparisons/
    <timestamp>/
      comparison.json
      comparison.md
  reports/
    <timestamp>-<domain>.md
    <timestamp>-<domain>.json
```

Reuse rules:

- `site.json` holds the canonical normalized domain and base URL; later
  commands look it up by `--target` / `--domain` argument.
- `url-tree.json` accumulates the union of URLs ever discovered.
- `crawl-runs/<ts>` is immutable; `analyze` references the latest crawl run
  by default, or `--run-id <ts>` for a specific one.
- `analyses/<ts>` is immutable; `report` and `compare` read the latest
  analysis by default.

## 6. Analysis statuses

Every per-check verdict carries one of:

- `PASS` — evidence shows the check is satisfied.
- `FAIL` — evidence shows the check is violated.
- `N/A` — the check does not apply to this page (with a stable
  `naReason`: `not_applicable`, `pending_access`, or `missing_data`).
- `NEEDS_REVIEW` — the deterministic/heuristic evaluator cannot conclude;
  a Claude review or human review is required.

Every PASS, FAIL, or NEEDS_REVIEW carries a non-empty `evidence` string
explaining what the evaluator saw. Tests enforce this.

## 7. Public ID model

- Every check has `id: "AIVB-NNN"` with `NNN` zero-padded to 3 digits.
- Every check has `sourceId: "Sxxx"` linking back to the source research.
- All CLI output, Markdown reports, and JSON artifacts use the public
  `AIVB-xxx` ID by default.
- The string `Sxxx` may appear in JSON artifacts only inside `sourceId` /
  `legacySourceId`, in `docs/source-research.md`, and in any explicitly
  marked provenance appendix.
- Tests fail if a check's primary `id` is `Sxxx`, if the checklist length
  is not 36, or if any docs/code path describes the runtime scope as 25.

## 8. Scoring

Severity weights (penalty per FAIL):

| Severity | Weight |
|---|---|
| Critical | 5 |
| High | 4 |
| Medium | 2 |
| Low | 1 |

Per-page score:

```
score = clamp(0, 100, 100 - sum(failPenalty) - 0.5 * count(NEEDS_REVIEW))
```

Where `failPenalty` is the severity weight scaled so that the same fail
distribution as the source's basic benchmark places similar pages into the
same buckets. We use a fixed multiplier of 1.0 in v0.1.0; if calibration
warrants change in a later release, it will be a documented version bump.

Buckets:

| Bucket | Range |
|---|---|
| `high` | score ≥ 95 |
| `average` | 90 ≤ score < 95 |
| `low` | 80 ≤ score < 90 |
| `bad` | 60 ≤ score < 80 |
| `very_bad` | score < 60 |

Site-level aggregate is the bucket distribution and the average score across
analyzed pages, plus per-check pass/fail/N/A/NEEDS_REVIEW counts.

Competitor delta: per check, target FAIL rate minus competitor FAIL rate.
Confidence is `low` when either side has fewer than 10 analyzed pages.

This is documented as a v0.1 heuristic, not a Semrush AI Visibility score.

## 9. Output formats

- `JSON` — every artifact is JSON for machine reuse.
- `Markdown` — primary user-facing format; default for `/aiv-report`.
- `HTML` — not in v0.1.0 (deferred).

All Markdown is English-only. A test enforces no Cyrillic characters in
README, docs, commands, skills, and agents.

## 10. Safety and crawl ethics

- Default crawl is **same-origin only**.
- Default `--limit` is 200 URLs per crawl, capped at 5000.
- Default `--depth` is 2.
- Default request timeout is 15 s, default concurrency is 3, default sleep
  between requests is 250 ms.
- Fixed user agent:
  `AIVisibilityBooster/0.1 (+https://github.com/medvedikur/ai_visibility_booster)`.
- Robots.txt is parsed for sitemap discovery and obvious `Disallow` notes.
  The plugin does not bypass `Disallow`, authentication, CAPTCHA, or WAF.
- No secrets are read or written; artifacts are JSON / Markdown only.
- The plugin does not contact Semrush, OpenAI, or any third-party API in
  v0.1.0.

## 11. Runtime dependencies

v0.1.0 has zero runtime npm dependencies. `package.json` declares
`"type": "module"`, the binary `aiv`, and `node --test` for tests.

If a small parser dependency is ever required, the spec mandates: justify it
in this file, list it in `package.json`, update README install
instructions, and verify a clean install round-trip.
