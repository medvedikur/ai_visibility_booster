# Development Log — AI Visibility Booster

## Source research

- Source repository: https://github.com/medvedikur/a1qa_com_ai_visibility
- Source commit SHA at start: `0c371f93b853dab9f091cd091651d77d262d90c7`
- Cloned into `_source/a1qa_com_ai_visibility` (gitignored).
- Studied: `scripts/run_basic_lite.mjs`, `lib/checklist/import.ts`,
  `lib/checklist/scope.ts`, `lib/benchmark/basic.ts`,
  `outputs/basic-benchmark/*`, `CLAUDE.md`, `README.md`,
  `ai_visibility_methodology_ru_en.md`.

The source defines a 36-item BASIC hot-list (`HOT_LIST_BASIC_IDS` in
`lib/checklist/scope.ts`). The hot-list is the practical baseline that the
research narrowed to from a much larger checklist. We adopt those exact 36
IDs as the runtime scope of v0.1.0 and re-number them as
`AIVB-001` through `AIVB-036` in source order.

## Methodology and Superpowers status

Auto Mode is active and the user provided a fully-formed, prescriptive
specification (file structure, commands, skills, agents, scoring buckets,
public ID model). Equivalent of brainstorming was therefore done by the user
in the prompt; this log records the equivalent Superpowers steps:

- using-superpowers: invoked at session start.
- brainstorming: prompt is the design source-of-truth. No additional creative
  decisions to extract from the user.
- writing-plans: see `docs/plan.md`.
- test-driven-development: tests under `tests/` are written and run before
  implementation; cycles recorded below.
- verification-before-completion: see Verification section.
- requesting-code-review: self-review checklist captured at the bottom.

## Decisions

- Public IDs are `AIVB-001`..`AIVB-036`; old `Sxxx` IDs become `sourceId`
  metadata only. Tests fail if a Public ID is `Sxxx` or if checklist length is
  not 36.
- Public docs and code must be English-only. A test scans
  README/docs/commands/skills/agents for Cyrillic characters.
- Runtime has no external npm dependencies. Tests use `node --test` and Node
  20+ built-ins (`fetch`, `node:test`, `node:fs/promises`, etc.).
- HTML parsing is a small purpose-built scanner sufficient for the 36 checks.
  Justification: keeping zero runtime deps keeps Claude Code plugin install
  trivial and avoids npm requirement.
- Crawler is same-origin by default, default limit 200, default timeout 15s,
  default concurrency 3, fixed user agent, no auth/CAPTCHA bypass, robots
  parsing limited to sitemap discovery and obvious disallow notes.

## TDD cycles

- RED: wrote `tests/checklist.test.mjs`, `tests/extract-page.test.mjs`,
  `tests/analyzer.test.mjs`, `tests/crawler.test.mjs`,
  `tests/storage.test.mjs`, `tests/scoring.test.mjs`,
  `tests/compare.test.mjs`, `tests/reporter.test.mjs`,
  `tests/cli.test.mjs`, `tests/language.test.mjs`,
  `tests/plugin-structure.test.mjs` plus fixtures. Initial run failed with
  `Cannot find module .../tests` on Node 25 — `node --test tests/` is
  ambiguous; switched to glob `node --test 'tests/*.test.mjs'`. After the
  glob fix, all 56 tests failed because production code was absent.
- GREEN: implemented `lib/checks.mjs`, `lib/utils.mjs`, `lib/scoring.mjs`,
  `lib/extract-page.mjs`, `lib/analyzer.mjs`, `lib/crawler.mjs`,
  `lib/storage.mjs`, `lib/compare.mjs`, `lib/reporter.mjs`,
  `lib/cli-args.mjs`, `bin/aiv.mjs`. Fixture `passing-page.html` was
  missed in the first pass and added once `extract-page.test.mjs` flagged
  it as missing. Plugin manifest, README, LICENSE, commands, skills,
  agents added to satisfy `tests/plugin-structure.test.mjs` and
  `tests/cli.test.mjs::doctor`. The language scan caught one Cyrillic
  glyph used as a regex in `docs/plan.md`; replaced the inline regex
  with a textual description (the test regex itself lives only in
  `tests/language.test.mjs`, which is not in the scanned set).
- REFACTOR: scoring penalty multiplier kept at 1.0 (documented in
  `docs/spec.md`); evaluators kept thin and per-check; the analyzer fans
  out to 36 small functions to keep each evaluator inspectable.

## Verification

All commands run in `/Users/m.urbanovich/Documents/urbagent/ai_visibility_booster`.

- `node --test 'tests/*.test.mjs'` — **56/56 pass**, 0 fail.
- `node bin/aiv.mjs checklist` — prints 36 `AIVB-001`..`AIVB-036` rows.
- `node bin/aiv.mjs doctor` — `Doctor: OK` (Node 25, manifest, checklist
  length, CLI binary, English-only docs, artifact directory creation).
- Fixture smoke pipeline (zero-network):
  ```
  node bin/aiv.mjs crawl tests/fixtures/site --limit 20 --out .tmp/aiv-fixture
  node bin/aiv.mjs analyze fixture.local --all --artifacts .tmp/aiv-fixture
  node bin/aiv.mjs report fixture.local --artifacts .tmp/aiv-fixture --format md
  ```
  Crawled 7 pages, analyzed 7, average score 88.57, report written under
  `.tmp/aiv-fixture/reports/`. Report uses `AIVB-xxx` as primary IDs in
  every table row.
- `git ls-files | grep -E '(^_source/|^\.tmp/|^\.ai-visibility/|node_modules)'`
  returns empty.
- The fresh-session test (loading the plugin into a live Claude Code
  session and pressing `/aiv-*` commands) was **not executed
  non-interactively**; the manual procedure is documented in
  `docs/fresh-session-test.md`.
