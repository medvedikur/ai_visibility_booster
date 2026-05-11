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

## v0.1.1 — canonical host redirect fix

### Bug summary

Manual plugin smoke test against the v0.1.0 plugin showed that
`/ai-visibility-booster:aiv-crawl https://a1qa.com --limit 200 --depth 3`
returned `Total candidates: 1, Pages fetched: 1`.

The site `https://a1qa.com` redirects to `https://www.a1qa.com`. The v0.1.0
crawler computes `baseHost` from the original seed (`a1qa.com`). `fetch`
follows redirects internally but `fetchText` discards `res.url`, so the
crawler never learns about the canonical host. Every discovered sitemap or
in-page link on `www.a1qa.com` is then rejected by
`if (host !== baseHost) continue;`. The seed itself is fetched once (via
the implicit redirect) but no further URLs are queued, hence
`Pages fetched: 1`.

### Expected behaviour

- The crawler must surface `res.url` (and `res.redirected`) from `fetch`.
- For non-local crawls, the seed is fetched first and its final URL is
  used to determine the canonical crawl origin.
- If the seed redirects between apex and `www.` of the same host (and only
  in that case), both hosts are accepted as crawl aliases. Redirects to an
  unrelated host record a warning and do **not** expand the crawl scope.
- `robots.txt` and `sitemap.xml` are fetched from the canonical origin.
- Sitemap-index recursion is followed (with a hard cap) so child sitemaps
  contribute candidate URLs.
- The 36-check scope is unchanged. Public IDs remain `AIVB-001` ..
  `AIVB-036`. `Sxxx` remains provenance-only.

### Reproduction (manual)

```
rm -rf .tmp/repro-a1qa
node bin/aiv.mjs crawl https://a1qa.com --limit 200 --depth 3 \
  --out .tmp/repro-a1qa
```

v0.1.0 result: `Total candidates: 1`, `Pages fetched: 1`,
no `www.a1qa.com` URLs in `urls.json`. Live network repro at this branch
cut: same outcome — `stats.json` shows `totalCandidates: 1`, `fetched: 1`,
`statusCounts: {"200":1}`, and `urls.json` contains only
`https://a1qa.com`. Captured under
`.tmp/repro-a1qa/sites/a1qa.com/crawl-runs/.../`.

### Superpowers / TDD workflow

- `using-superpowers` and `brainstorming` skills invoked at session
  start. The user's prompt is the prescriptive specification (Phases 0-9);
  no additional creative decisions to extract — design source-of-truth is
  the prompt itself.
- `systematic-debugging`: bug isolated to `fetchText` + same-host filter
  in `lib/crawler.mjs` lines 69-91 / 137 / 191 (v0.1.0).
- `writing-plans`: this section is the spec; the prompt is the plan.
- `test-driven-development`: RED → GREEN → REFACTOR cycle below, with
  tests written and confirmed failing before crawler changes.
- `verification-before-completion`: see Verification section at end.
- `requesting-code-review`: self-review checklist captured at the end.

### TDD cycle for v0.1.1

- **RED** — added five test files:
  - `tests/crawler-helpers.test.mjs` — `stripWww`, `isWwwAliasHost`,
    `hostAliasesFor`, `isAllowedCrawlHost`.
  - `tests/crawler-fetch.test.mjs` — `fetchText` returns
    `finalUrl/redirected/status/ok/text/contentType` against a real Node
    HTTP server with a 302 redirect.
  - `tests/crawler-redirect.test.mjs` — full `crawl()` flow with an
    injected `fetchImpl` covering apex→www redirect, apex→unrelated host,
    canonical-host stats fields, and sitemap-index recursion.
  - `tests/marketplace.test.mjs` — marketplace metadata name, structure,
    GitHub source URL, version pin to `v0.1.1` (also asserts
    `package.json` version).
  - `tests/command-ux.test.mjs` — `commands/aiv-crawl.md` suggests the
    namespaced `/ai-visibility-booster:aiv-analyze` form.
  
  Initial run: all 10 new tests failed, as expected. Helper exports did
  not exist on `lib/crawler.mjs`; `fetchText` was not exported and lacked
  `finalUrl`/`contentType`; marketplace name was `ai-visibility-booster`
  not `ai-visibility-booster-marketplace`; `package.json` was at `0.1.0`;
  `commands/aiv-crawl.md` suggested bare `/aiv-analyze`.

- **GREEN** — extended `lib/crawler.mjs`:
  - `fetchText` exported; returns
    `{ ok, status, text, finalUrl, redirected, contentType, error }`.
    Accepts `fetchImpl` for tests; production uses `globalThis.fetch`.
  - Added `stripWww`, `isWwwAliasHost`, `hostAliasesFor`,
    `isAllowedCrawlHost`, `classifySitemap`.
  - Refactored `crawl()` into `crawlLocal` (fixture path, untouched
    semantics) and `crawlRemote` (new canonical-resolution flow).
  - `crawlRemote` pre-fetches the seed once, derives canonical host from
    `res.url`, and expands `hostAliases` only via `isWwwAliasHost`.
    Unrelated redirect targets emit a warning and keep the crawl on the
    requested host (no cross-domain expansion).
  - `robots.txt` and the default `sitemap.xml` are fetched from
    `crawlOrigin`. Sitemap-index files are parsed and child sitemaps
    enqueued, capped at 50 sitemap fetches total.
  - BFS uses `pageBase = result.finalUrl || url` as the link-resolution
    base; only hosts in `hostAliases` are accepted. `nofollow` preserved.
  - Stats expose the new canonical fields plus existing
    `totalCandidates`, `fetched`, `failed`, `statusCounts`, `sitemapCount`,
    `sitemapEntries`, `startedAt`, `completedAt` (backward-compatible).
  - `USER_AGENT` bumped to
    `AIVisibilityBooster/0.1.1 (+https://github.com/medvedikur/ai_visibility_booster)`.
  - Crawler returns `domain: normalizeDomain(requestedHost)` so artifacts
    are stored under the apex regardless of which host the redirect lands
    on (e.g. `https://a1qa.com` and the canonical `www.a1qa.com` both
    write to `.ai-visibility/sites/a1qa.com/`).
  - Initial scoped-variable bug in `crawlLocal` (`seedUrl`) caught by
    `tests/cli.test.mjs::end-to-end fixture pipeline`; fixed by hoisting
    the binding.

- **REFACTOR** — split the existing single `crawl()` function into two
  separate paths to keep the local-fixture branch trivial and the remote
  branch focused on canonical-host resolution. No public API change for
  callers — `crawl()` and `isLocalCrawlSeed()` keep their signatures;
  new helpers and `fetchText` are additive exports.

## Verification (v0.1.1)

All commands run in `/Users/m.urbanovich/Documents/urbagent/ai_visibility_booster`.

- `npm test` → **70/70 pass** (was 56; +10 new RED-then-GREEN tests for
  redirect, fetch helper, alias helpers, sitemap index, marketplace
  packaging, command UX, plus the prior 60 still passing).
- `npm run check` → tests pass; `checklist` prints 36 `AIVB-001..AIVB-036`
  rows; `doctor` reports `name=ai-visibility-booster v0.1.1` and
  `Doctor: OK`.
- Fixture smoke pipeline (zero-network):
  - Crawled 7 pages, analyzed 7, average score 88.57, report written under
    `.tmp/aiv-fixture/reports/`.
- Live network smoke for the bug fix:
  ```
  node bin/aiv.mjs crawl https://a1qa.com --limit 50 --depth 3 \
    --out .tmp/aiv-a1qa
  ```
  - `totalCandidates: 792`, `fetched: 50`, `statusCounts: {"200": 50}`.
  - `stats.seedUrl = "https://a1qa.com"`,
    `stats.seedFinalUrl = "https://www.a1qa.com/"`,
    `stats.requestedHost = "a1qa.com"`,
    `stats.canonicalHost = "www.a1qa.com"`,
    `stats.hostAliases = ["a1qa.com", "www.a1qa.com"]`,
    `stats.redirectedSeed = true`,
    `stats.crawlOrigin = "https://www.a1qa.com"`,
    `stats.sitemapIndexCount = 1`, `stats.sitemapFetched = 8`.
  - All 50 fetched URLs are on `www.a1qa.com`. No cross-domain
    expansion. No entries on unrelated hosts.
  - `node bin/aiv.mjs analyze a1qa.com --random 5 --seed 42 --artifacts
    .tmp/aiv-a1qa` → analyzed 5 pages, average score 87, artifacts
    under `.tmp/aiv-a1qa/sites/a1qa.com/analyses/`. Apex-domain key
    works after a www-canonical crawl.
- `git ls-files | grep -E '^(_source/|\.tmp/|\.ai-visibility/|node_modules)'`
  returns empty.
- 36-check / public-ID / language regression tests all pass
  (`tests/checklist.test.mjs`, `tests/language.test.mjs`,
  `tests/plugin-structure.test.mjs`).

## Self-review (v0.1.1)

Verified against the user's review checklist:

- **No arbitrary cross-domain crawl expansion.** `crawlRemote` derives
  `hostAliases` strictly via `isWwwAliasHost`. Unrelated redirect
  targets keep `hostAliases = [requestedHost]` and emit a warning.
  Sitemap and BFS link filters both call `isAllowedCrawlHost`, so a
  redirected or sitemap-listed URL on an unrelated host is dropped.
- **Apex/www aliases only.** `isWwwAliasHost` checks `stripWww` equality
  and rejects identical-host pairs, so siblings like
  `a1qa.com`/`www.a1qa.com` are aliased while `sub.a1qa.com` /
  `a1qa.com` are not.
- **Sitemap recursion capped.** `SITEMAP_FETCH_CAP = 50`; the loop
  exits when the cap is reached. Sitemap-index `loc` entries are pushed
  onto the same fetch stack and de-duplicated via `sitemapFetched`.
- **Artifacts backward-compatible.** `stats.json` keeps every prior
  field (`totalCandidates`, `fetched`, `failed`, `statusCounts`,
  `sitemapCount`, `sitemapEntries`, `startedAt`, `completedAt`) and adds
  the new canonical-host fields. `urls.json` keeps prior fields and
  adds `finalUrl`. `pages/<hash>.json` keeps prior fields and adds
  `finalUrl`, `redirected`, `host`. `storage.mjs` is read-through and
  needs no changes.
- **Install instructions accurate.** README documents the self-hosted
  marketplace path with marketplace name
  `ai-visibility-booster-marketplace` distinct from the plugin name
  `ai-visibility-booster`, plus a `/reload-plugins` step. The README
  no longer claims Anthropic marketplace acceptance.
- **Commands use namespaced examples.** `commands/aiv-crawl.md`,
  `aiv-analyze.md`, `aiv-add-competitor.md`, and `aiv-status.md` all
  suggest the `/ai-visibility-booster:aiv-*` form with an explicit note
  about the namespaced form being the reliable form.
- **Version consistently 0.1.1.** `package.json`,
  `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (both
  the plugin entry version and the source ref),
  `lib/crawler.mjs::USER_AGENT`, `lib/reporter.mjs` fallback,
  `bin/aiv.mjs` fallback. Historical references to `v0.1.0` in
  `docs/spec.md`, `docs/plan.md`, `docs/source-research.md`, and
  `docs/development-log.md` are deliberately preserved as they
  document the initial release; current-version statements in
  `README.md`, `docs/testing.md`, `docs/fresh-session-test.md`, and
  `docs/community-submission.md` were updated.
- **Scope unchanged.** `tests/checklist.test.mjs` still asserts 36
  checks and the `AIVB-001..AIVB-036` mapping with `Sxxx` provenance
  only. `tests/language.test.mjs` still passes (no Cyrillic in
  README/docs/commands/skills/agents).
