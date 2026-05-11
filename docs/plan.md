# Implementation Plan

## Files to create

```
.
├── .claude-plugin/plugin.json
├── commands/
│   ├── aiv-crawl.md
│   ├── aiv-analyze.md
│   ├── aiv-add-competitor.md
│   ├── aiv-compare.md
│   ├── aiv-report.md
│   ├── aiv-status.md
│   ├── aiv-checklist.md
│   └── aiv-doctor.md
├── skills/
│   ├── ai-visibility-basic-checks/SKILL.md
│   ├── ai-visibility-reporting/SKILL.md
│   └── ai-visibility-competitor-comparison/SKILL.md
├── agents/
│   ├── aiv-page-auditor.md
│   └── aiv-report-reviewer.md
├── bin/aiv.mjs
├── lib/
│   ├── checks.mjs        # 36 check definitions, AIVB-001..AIVB-036
│   ├── extract-page.mjs  # raw HTML → page snapshot
│   ├── crawler.mjs       # robots/sitemap parse + same-origin BFS
│   ├── analyzer.mjs      # page snapshot → 36 verdicts
│   ├── storage.mjs       # .ai-visibility/ FS layout
│   ├── compare.mjs       # target vs competitors deltas
│   ├── reporter.mjs      # Markdown report builder
│   ├── scoring.mjs       # severity weights, buckets
│   ├── cli-args.mjs      # argv parser
│   └── utils.mjs         # url normalize, hash, sleep
├── tests/
│   ├── fixtures/
│   │   ├── passing-page.html
│   │   ├── failing-page.html
│   │   ├── media-page.html
│   │   ├── schema-page.html
│   │   ├── forms-page.html
│   │   ├── sitemap.xml
│   │   ├── robots.txt
│   │   └── site/                # mini-site for end-to-end smoke
│   ├── checklist.test.mjs       # 36 IDs, public-ID enforcement, mapping
│   ├── extract-page.test.mjs    # parser coverage
│   ├── analyzer.test.mjs        # all 36 evaluators with fixture assertions
│   ├── crawler.test.mjs         # robots, sitemap, normalization, dedupe
│   ├── storage.test.mjs         # FS layout, reload
│   ├── compare.test.mjs         # delta math, coverage warnings
│   ├── reporter.test.mjs        # Markdown structure, AIVB-xxx IDs only
│   ├── scoring.test.mjs         # weight + bucket boundaries
│   ├── cli.test.mjs             # checklist/doctor/analyze CLI smoke
│   ├── language.test.mjs        # no Cyrillic in public docs
│   └── plugin-structure.test.mjs # manifest, commands/skills/agents shape
├── docs/
│   ├── spec.md
│   ├── plan.md
│   ├── source-research.md
│   ├── development-log.md
│   ├── testing.md
│   ├── community-submission.md
│   └── fresh-session-test.md
├── README.md
├── LICENSE
├── package.json
└── .gitignore
```

## Tests to write first (RED)

For each module, write the failing tests before any production code. Order:

1. `tests/checklist.test.mjs`
   - Exactly 36 checks.
   - IDs equal `["AIVB-001", ..., "AIVB-036"]` in order.
   - `sourceId` mapping equals the table in `docs/source-research.md`.
   - No duplicates.
   - Every check has `id`, `sourceId`, `title`, `description`, `severity`,
     `gapCategory`, `scope`, `evaluationMode`, `minimalFix`, `sourceEvidence`.
   - `severity` is one of `Critical|High|Medium|Low`.
   - `evaluationMode` is one of
     `deterministic|heuristic|needs-claude-review`.
   - Source IDs are not used as primary `id`.
2. `tests/extract-page.test.mjs`
   - Parses title, meta robots, canonical, lang, headings, links, images,
     JSON-LD, forms/labels, breadcrumbs, body text, sentence/list/table
     counts on the fixture pages.
3. `tests/analyzer.test.mjs`
   - For every `AIVB-NNN`, at least one fixture asserts a known verdict.
   - Verdicts are one of `PASS|FAIL|N/A|NEEDS_REVIEW`.
   - `evidence` is non-empty for `PASS|FAIL|NEEDS_REVIEW`.
   - Verdicts use `checkId: "AIVB-NNN"` as primary key.
4. `tests/crawler.test.mjs`
   - Parses sitemap fixture, robots fixture.
   - Normalizes same-origin URLs and deduplicates by canonical.
   - Honors `--limit`.
5. `tests/storage.test.mjs`
   - Creates `.ai-visibility` layout, writes/reads each artifact.
6. `tests/scoring.test.mjs`
   - Per-page score = 100 - sum(weights for FAIL) - 0.5 * NEEDS_REVIEW count,
     clamped to `[0, 100]`.
   - Bucket boundaries: 95/90/80/60.
7. `tests/compare.test.mjs`
   - Per-check FAIL rate target vs competitor; coverage warning when
     analyzed page count < 10 on either side.
8. `tests/reporter.test.mjs`
   - Markdown contains all required sections; uses `AIVB-xxx` IDs; never
     uses `Sxxx` as a primary report ID; English-only.
9. `tests/cli.test.mjs`
   - `node bin/aiv.mjs checklist` exits 0, prints 36 `AIVB-xxx` IDs.
   - `node bin/aiv.mjs doctor` exits 0.
   - Unknown command exits non-zero.
   - End-to-end fixture: `crawl tests/fixtures/site` →
     `analyze fixture.local --all` → `report fixture.local --format md`.
10. `tests/language.test.mjs`
    - README, docs/*, commands/*, skills/**/*.md, agents/* contain no
      Cyrillic characters (regex matches the U+0400 — U+04FF block).
11. `tests/plugin-structure.test.mjs`
    - `.claude-plugin/plugin.json` parseable, name `ai-visibility-booster`,
      version, description, author, homepage, repository, license, keywords.
    - All 8 commands exist with frontmatter.
    - All 3 skills have SKILL.md with valid frontmatter.
    - All 2 agents exist with frontmatter.
    - README mentions install, usage, examples, limitations.

Each test file gets stubbed first; running `node --test` yields RED.

## Implementation sequence (GREEN)

1. `lib/utils.mjs` — pure helpers (URL normalize, hash, sleep, clamp).
2. `lib/scoring.mjs` — severity weights and bucket boundaries.
3. `lib/checks.mjs` — 36 check definitions in source order.
4. `lib/extract-page.mjs` — minimal HTML parser.
5. `lib/analyzer.mjs` — per-check evaluators.
6. `lib/crawler.mjs` — sitemap + robots parsing, same-origin BFS.
7. `lib/storage.mjs` — FS layout, JSON serialization.
8. `lib/compare.mjs` — target vs competitor deltas.
9. `lib/reporter.mjs` — Markdown report.
10. `lib/cli-args.mjs` — argv parser.
11. `bin/aiv.mjs` — wires subcommands.
12. Commands, skills, agents, plugin manifest, README, LICENSE, package.json.

## Verification (per Phase 11)

```
npm test
npm run check           # node --test && checklist && doctor
node bin/aiv.mjs checklist
node bin/aiv.mjs doctor
node bin/aiv.mjs crawl tests/fixtures/site --limit 20 --out .tmp/aiv-fixture
node bin/aiv.mjs analyze fixture.local --all --artifacts .tmp/aiv-fixture
node bin/aiv.mjs report fixture.local --artifacts .tmp/aiv-fixture --format md
git status --ignored
git ls-files | grep -E '(^_source/|^\.tmp/|^\.ai-visibility/|node_modules)'
```

The last command must return empty.

## Release (per Phase 12)

1. Commit feature branch, push.
2. Merge to `main` once tests pass.
3. Tag `v0.1.0`, push tag.
4. `gh repo edit` to set description and topics.
5. `gh release create v0.1.0`.
6. Owner submits to https://clau.de/plugin-directory-submission via the form.
