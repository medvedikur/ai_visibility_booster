# Testing Guide

## Running tests

```
npm test           # node --test on tests/
npm run check      # tests + checklist + doctor
```

## Categories

- **Checklist integrity** — `tests/checklist.test.mjs` enforces 36 checks,
  exact `AIVB-001..AIVB-036` order, exact `sourceId` mapping, no duplicates,
  schema completeness, public-ID rule (no `Sxxx` as primary `id`).
- **Page extraction** — `tests/extract-page.test.mjs` parses fixture HTML
  for title, meta robots, canonical, lang, headings, links, images, JSON-LD,
  forms/labels, breadcrumbs, body text, sentence/list/table counts.
- **Per-check evaluators** — `tests/analyzer.test.mjs` asserts at least one
  known verdict per `AIVB-NNN`.
- **Crawler** — `tests/crawler.test.mjs` parses robots and sitemap fixtures,
  normalizes same-origin URLs, honors limits.
- **Storage** — `tests/storage.test.mjs` writes and reloads the
  `.ai-visibility/` layout.
- **Scoring** — `tests/scoring.test.mjs` validates weights and bucket
  boundaries.
- **Compare** — `tests/compare.test.mjs` validates delta math and coverage
  warnings.
- **Reporter** — `tests/reporter.test.mjs` ensures Markdown contains required
  sections, uses `AIVB-xxx` IDs only, English-only.
- **CLI** — `tests/cli.test.mjs` smoke-tests `checklist`, `doctor`, and a
  full fixture pipeline.
- **Language** — `tests/language.test.mjs` scans public docs for Cyrillic
  characters.
- **Plugin structure** — `tests/plugin-structure.test.mjs` validates
  `.claude-plugin/plugin.json`, commands, skills, agents, and README
  contents.

## Fixture smoke

The fixture site at `tests/fixtures/site/` is a tiny static site (a small
HTML file tree plus a sitemap). The CLI accepts a local path or
`file://` URL as the crawl seed for offline testing:

```
node bin/aiv.mjs crawl tests/fixtures/site --limit 20 --out .tmp/aiv-fixture
node bin/aiv.mjs analyze fixture.local --all --artifacts .tmp/aiv-fixture
node bin/aiv.mjs report fixture.local --artifacts .tmp/aiv-fixture --format md
```

## What we deliberately do not test

- Network-bound crawl of real third-party sites is not part of the test suite.
  It requires manual smoke testing per `docs/fresh-session-test.md`.
- Lighthouse / Core Web Vitals collection is not part of v0.1.0.
- Browser rendering / JS execution is not part of v0.1.0; checks that need
  it return `NEEDS_REVIEW`.
