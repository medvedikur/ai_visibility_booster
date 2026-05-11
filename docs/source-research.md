# Source Research and Provenance

## Source repository

- URL: https://github.com/medvedikur/a1qa_com_ai_visibility
- Commit SHA studied: `0c371f93b853dab9f091cd091651d77d262d90c7`
- Working copy: `_source/a1qa_com_ai_visibility` (gitignored, not committed)

## What the source is

The source is an internal research project that audited site.com and several
competitors for AI Visibility (Semrush term: how often a brand surfaces in
answers from ChatGPT, Perplexity, Gemini, Google AI). It contains:

- a full Russian/English checklist
  (`ai_visibility_methodology_ru_en.md`, `ai_visibility_checklist_ru_en.xlsx`),
- a Next.js audit app that crawls and scores sites against the full checklist,
- production scripts that collapse the checklist into a practical "BASIC"
  hot-list of 36 IDs (`lib/checklist/scope.ts` exports `HOT_LIST_BASIC_IDS`),
- a runner (`scripts/run_basic_lite.mjs`) that evaluates pages against those
  36 IDs through an LLM judge,
- benchmark output (`outputs/basic-benchmark/*`) that ranks fixes by impact
  and groups pages into quality buckets.

## Why 36 checks, not 25 and not the full checklist

The full checklist contains many more items, but the source's empirical
findings (`CLAUDE.md` in the source) are:

> Methodology has weak correlation with Semrush AI Vis — only 6 of 36
> hot-list checks show clear HIGH-vs-LOW separation. Most checks are
> hygiene-like or NEUT/NEG correlation.

The 36 hot-list IDs are the BASIC checks that ever produced a FAIL on the
fully-analyzed corpus (site.com, site2.com, itransition.com — 2497 pages
as of 2026-05-04, per source). Checks outside that set were always PASS or
N/A and add cost without insight.

`AI Visibility Booster v0.1.0` adopts those exact 36 hot-list IDs as its
runtime scope. It is **not** a 25-check subset. Anyone who reads "25 checks"
about this product is reading stale material.

## Public ID model

The source IDs (`Sxxx`) are not stable across revisions and are tied to the
source's internal Excel checklist row order. The public plugin re-numbers the
36 hot-list items as `AIVB-001` through `AIVB-036` in source order, and stores
the original `Sxxx` only as `sourceId` provenance metadata.

Rules (also enforced by tests):

- The primary `id` field on every check is `AIVB-001`..`AIVB-036`.
- The `sourceId` field carries the legacy `Sxxx` value.
- CLI output, Markdown reports, and JSON artifacts use `AIVB-xxx` as the
  primary identifier.
- The string `Sxxx` may appear in JSON artifacts only inside `sourceId` /
  `legacySourceId` keys, in this `docs/source-research.md` file, and in any
  appendix table that explicitly explains provenance.

## Canonical mapping (source order)

| Public ID | Source ID | Severity | Gap category | Scope | Mode | Title |
|---|---|---|---|---|---|---|
| AIVB-001 | S001 | Critical | Indexing | page | deterministic | HTTP success and clean access |
| AIVB-002 | S002 | High | Indexing | page | deterministic | Canonical indexable URL in XML sitemap |
| AIVB-003 | S004 | Medium | Indexing | site | heuristic | No competing canonical page with same primary intent |
| AIVB-004 | S006 | High | Indexing | site | heuristic | At least one crawlable internal HTML link points to page |
| AIVB-005 | S008 | Critical | Indexing | page | deterministic | No noindex on intended AI/organic page |
| AIVB-006 | S012 | High | Snippet controls | page | deterministic | No nosnippet or overly restrictive snippet controls |
| AIVB-007 | S023 | High | Headings | page | deterministic | One primary visible H1 describing the page topic |
| AIVB-008 | S030 | Medium | Readability | page | heuristic | Average sentence length is extractable/readable |
| AIVB-009 | S031 | Medium | Structure | page | heuristic | Processes/comparisons/lists are structured where applicable |
| AIVB-010 | S035 | Medium | Freshness | page | heuristic | Visible publication date where applicable |
| AIVB-011 | S036 | Medium | Freshness | page | heuristic | Visible update/review/dateModified freshness where applicable |
| AIVB-012 | S037 | Medium | Authority | page | needs-claude-review | Named author/reviewer/content owner on expertise-sensitive content |
| AIVB-013 | S040 | Medium | Headings | page | deterministic | Clear heading hierarchy and body sections |
| AIVB-014 | S041 | Medium | Headings | page | heuristic | Headings are specific, not generic template labels |
| AIVB-015 | S042 | Medium | Rendering | page | needs-claude-review | Critical content is not hidden behind click-only UI |
| AIVB-016 | S044 | Medium | Internal linking | page | heuristic | Internal anchor text is descriptive |
| AIVB-017 | S045 | Medium | Internal linking | page | heuristic | Breadcrumbs and BreadcrumbList for deep URLs where applicable |
| AIVB-018 | S046 | High | Media | page | deterministic | Meaningful images do not rely on empty src/data placeholders |
| AIVB-019 | S047 | High | Media | page | heuristic | Meaningful images have descriptive alt text or SVG title |
| AIVB-020 | S048 | Medium | Media | page | needs-claude-review | Important image information has nearby text/caption/table companion |
| AIVB-021 | S049 | Medium | Media | page | deterministic | Preferred image via og:image or schema image where applicable |
| AIVB-022 | S050 | Low | Media | page | heuristic | Important image filenames are short and descriptive |
| AIVB-023 | S051 | Low | Media | page | needs-claude-review | Primary image quality and preview suitability |
| AIVB-024 | S052 | Medium | Media | page | heuristic | Video has transcript, summary, or VideoObject metadata where applicable |
| AIVB-025 | S054 | High | Schema | page | heuristic | JSON-LD type matches page purpose |
| AIVB-026 | S055 | Medium | Schema | page | heuristic | Rich-result schema has required fields where applicable |
| AIVB-027 | S057 | Medium | Schema | page | heuristic | FAQPage/QAPage schema only for visible matching Q&A |
| AIVB-028 | S058 | High | Rendering | page | needs-claude-review | Mobile/rendered page does not hide critical content |
| AIVB-029 | S060 | Low | Performance | page | needs-claude-review | Core Web Vitals/performance evidence available or not obviously poor |
| AIVB-030 | S061 | High | Rendering | page | heuristic | Interstitial/cookie/auth overlays do not block main content |
| AIVB-031 | S062 | High | Accessibility | page | heuristic | Buttons/forms/menus have labels/roles/states for agents/accessibility |
| AIVB-032 | S063 | High | Rendering | page | heuristic | Main content is available in source/rendered HTML, not JS-only |
| AIVB-033 | S065 | Medium | Indexing | page | needs-claude-review | Legal/privacy/sensitive index/noindex intent is correct |
| AIVB-034 | S066 | Medium | Internationalization | page | deterministic | Hreflang present for multilingual pages where applicable |
| AIVB-035 | S067 | Medium | Consistency | page | deterministic | Title, H1, schema title/name, and og:title are aligned |
| AIVB-036 | S070 | Medium | Prompt coverage | page | needs-claude-review | Strategic page has at least three relevant distinct prompt/query mappings where applicable |

## Per-check notes

For each check below the columns are: legacy source ID, public ID, English
title, severity, gap category, evaluation mode, and the minimal-fix family
that the plugin recommends. Pass criteria summaries are paraphrases of the
source's `pass_criteria_en` text where present; full original text lives in
the source repository's checklist Excel.

### AIVB-001 — HTTP success and clean access (S001)

- Severity: Critical, Mode: deterministic.
- Pass when the page returns a successful HTTP status (2xx, or a permanent
  redirect that resolves to a 2xx canonical URL) without authentication walls,
  CAPTCHA, or WAF blocks for a normal anonymous user agent.
- Minimal fix family: server config, redirect chain cleanup, WAF/CDN rule
  exception for public same-origin pages.

### AIVB-002 — Canonical indexable URL in XML sitemap (S002)

- Severity: High, Mode: deterministic.
- Pass when the canonical URL of an intended public page is present in at
  least one XML sitemap referenced by `robots.txt` or `/sitemap.xml`.
- Minimal fix family: add the URL to the appropriate sitemap shard, regenerate
  sitemap index.

### AIVB-003 — No competing canonical page with same primary intent (S004)

- Severity: Medium, Mode: heuristic (cross-page).
- Pass when no other canonical indexable page on the same site answers the
  same primary intent without a distinct scope (audience, region, product,
  depth).
- Minimal fix family: choose one canonical, redirect duplicates, or scope each
  page differently in title and H1.

### AIVB-004 — At least one crawlable internal HTML link points to page (S006)

- Severity: High, Mode: heuristic.
- Pass when at least one canonical indexable page contains a crawlable HTML
  link to this page (rendered DOM, not nofollow, not JS-only navigation).
- Minimal fix family: add an internal link from a relevant section of the
  site, or add the page to a hub.

### AIVB-005 — No noindex on intended AI/organic page (S008)

- Severity: Critical, Mode: deterministic.
- Pass when the page does not have `<meta name="robots" content="...noindex...">`
  or an `X-Robots-Tag: noindex` header for any major search/AI bot.
- Minimal fix family: remove the noindex directive on intended public pages.

### AIVB-006 — No nosnippet or overly restrictive snippet controls (S012)

- Severity: High, Mode: deterministic.
- Pass when the page does not declare `nosnippet`, `max-snippet:0`, or an
  overly restrictive `max-snippet`.
- Minimal fix family: remove the directive or raise `max-snippet`.

### AIVB-007 — One primary visible H1 describing the page topic (S023)

- Severity: High, Mode: deterministic.
- Pass when there is exactly one primary visible H1 that describes the page
  topic. Multiple H1s are allowed only if they do not conflict.
- Minimal fix family: demote secondary H1s to H2, or rewrite the H1 to match
  the page intent without changing the page meaning.

### AIVB-008 — Average sentence length is extractable/readable (S030)

- Severity: Medium, Mode: heuristic.
- Pass when the average body sentence length stays in a readable range
  (target ~12–24 words; FAIL above ~32 average).
- Minimal fix family: split overly long sentences without changing meaning.

### AIVB-009 — Processes/comparisons/lists are structured where applicable (S031)

- Severity: Medium, Mode: heuristic.
- Pass when process descriptions, comparisons, or list-shaped paragraphs are
  rendered as `<ul>`, `<ol>`, or `<table>`. NEEDS_REVIEW when no list/table is
  present but the body looks list-shaped.
- Minimal fix family: convert existing prose lists into bullets/tables.

### AIVB-010 — Visible publication date where applicable (S035)

- Severity: Medium, Mode: heuristic.
- Pass when a visible publication date or `datePublished` JSON-LD value is
  present on time-sensitive content.
- Minimal fix family: add a visible "Published on YYYY-MM-DD" line, or add
  `datePublished` to the page's JSON-LD.

### AIVB-011 — Visible update/review/dateModified freshness where applicable (S036)

- Severity: Medium, Mode: heuristic.
- Pass when a visible review/update date or `dateModified` JSON-LD value
  exists and is within a reasonable freshness window for the topic.
- Minimal fix family: add a "Reviewed on YYYY-MM-DD" line, refresh the
  `dateModified`.

### AIVB-012 — Named author/reviewer/content owner on expertise-sensitive content (S037)

- Severity: Medium, Mode: needs-claude-review.
- Pass when expertise-sensitive content (technical guides, opinion, analysis,
  methodology) names a human author or reviewer. Brand name alone is not
  sufficient. N/A for pure product/service landing pages.
- Minimal fix family: add a visible byline, link author to a profile page,
  add `Person` JSON-LD.

### AIVB-013 — Clear heading hierarchy and body sections (S040)

- Severity: Medium, Mode: deterministic.
- Pass when the page uses an ordered heading hierarchy (H1 → H2 → H3 …) with
  at least one body section, no skipped levels at the top.
- Minimal fix family: re-tag headings into a coherent outline.

### AIVB-014 — Headings are specific, not generic template labels (S041)

- Severity: Medium, Mode: heuristic.
- FAIL when most non-template heading text is generic ("More posts", "Get in
  touch", "Subscribe", numeric-only step labels, etc.).
- Minimal fix family: rewrite generic headings into specific ones that reflect
  the section content.

### AIVB-015 — Critical content is not hidden behind click-only UI (S042)

- Severity: Medium, Mode: needs-claude-review.
- Pass when content critical to the page intent is rendered in the initial
  HTML or by SSR; FAIL when it requires a user click (tabs, accordions,
  "Load more") and is missing from the initial DOM.
- Minimal fix family: render critical content in the initial HTML.

### AIVB-016 — Internal anchor text is descriptive (S044)

- Severity: Medium, Mode: heuristic.
- FAIL when internal anchor text is dominated by generic phrases ("click
  here", "read more", "learn more", "here", "more", "details").
- Minimal fix family: rewrite anchor text to describe the destination topic.

### AIVB-017 — Breadcrumbs and BreadcrumbList for deep URLs where applicable (S045)

- Severity: Medium, Mode: heuristic.
- Pass on URLs with depth > 2 when both a visible breadcrumb and
  `BreadcrumbList` JSON-LD exist. N/A on shallow URLs.
- Minimal fix family: add visible breadcrumbs and `BreadcrumbList` schema.

### AIVB-018 — Meaningful images do not rely on empty src/data placeholders (S046)

- Severity: High, Mode: deterministic.
- FAIL when ≥30% of images have empty `src`, `data:` placeholder, or
  near-empty URL.
- Minimal fix family: serve real `src` URLs to crawlers (SSR, lazy-load with
  proper `data-src` and `noscript`, or `loading="lazy"` with real src).

### AIVB-019 — Meaningful images have descriptive alt text or SVG title (S047)

- Severity: High, Mode: heuristic.
- Pass when meaningful images have alt text or `<title>` for SVGs;
  decorative images correctly use `alt=""`.
- Minimal fix family: add descriptive alt text for meaningful images.

### AIVB-020 — Important image information has nearby text/caption/table companion (S048)

- Severity: Medium, Mode: needs-claude-review.
- Pass when important images (charts, infographics, screenshots, posters) are
  accompanied by a caption or text block that duplicates the visual meaning.
- Minimal fix family: add a `<figcaption>` or summary line near the image.

### AIVB-021 — Preferred image via og:image or schema image where applicable (S049)

- Severity: Medium, Mode: deterministic.
- Pass when a preferred image is defined via `og:image` and/or schema
  `image` / `primaryImageOfPage`, served over HTTPS.
- Minimal fix family: add `og:image`, link a schema image.

### AIVB-022 — Important image filenames are short and descriptive (S050)

- Severity: Low, Mode: heuristic.
- FAIL when meaningful image filenames are generic / numeric (`770x500.png`,
  `image-01.png`, `photo.png`).
- Minimal fix family: rename meaningful images to short descriptive
  filenames.

### AIVB-023 — Primary image quality and preview suitability (S051)

- Severity: Low, Mode: needs-claude-review.
- Pass when the primary image has acceptable resolution and aspect ratio for
  AI/social previews. Heuristic alone cannot prove this; mark NEEDS_REVIEW.
- Minimal fix family: replace the primary image with a higher-quality version.

### AIVB-024 — Video has transcript, summary, or VideoObject metadata where applicable (S052)

- Severity: Medium, Mode: heuristic.
- Pass when each significant video has a transcript, a summary, or
  `VideoObject` JSON-LD metadata. N/A when no video.
- Minimal fix family: add transcript or `VideoObject` schema.

### AIVB-025 — JSON-LD type matches page purpose (S054)

- Severity: High, Mode: heuristic.
- FAIL when only `WebPage` is used on a page that should be `Article`,
  `Service`, `Product`, etc.
- Minimal fix family: switch the JSON-LD type to one that matches intent.

### AIVB-026 — Rich-result schema has required fields where applicable (S055)

- Severity: Medium, Mode: heuristic.
- Pass when an applicable rich-result type has all required Google rich-result
  fields (e.g. `NewsArticle` requires headline, author, datePublished).
- Minimal fix family: add the missing required fields.

### AIVB-027 — FAQPage/QAPage schema only for visible matching Q&A (S057)

- Severity: Medium, Mode: heuristic.
- FAIL when `FAQPage` / `QAPage` schema is present but the visible page does
  not contain the matching Q&A blocks.
- Minimal fix family: remove the schema or add the matching visible Q&A.

### AIVB-028 — Mobile/rendered page does not hide critical content (S058)

- Severity: High, Mode: needs-claude-review.
- Pass when the mobile-rendered version exposes the same critical content as
  the desktop version. Heuristic alone cannot prove this; mark NEEDS_REVIEW.
- Minimal fix family: ensure responsive templates render full content on mobile.

### AIVB-029 — Core Web Vitals/performance evidence available or not obviously poor (S060)

- Severity: Low, Mode: needs-claude-review.
- The plugin cannot run Lighthouse synchronously without external tools; it
  marks NEEDS_REVIEW unless the page has obvious heavy assets.
- Minimal fix family: investigate via PageSpeed Insights / CrUX, fix LCP/INP.

### AIVB-030 — Interstitial/cookie/auth overlays do not block main content (S061)

- Severity: High, Mode: heuristic.
- FAIL when DOM contains a fixed-position cookie/auth/interstitial element
  that overlays main content with no clear dismissal.
- Minimal fix family: ensure the interstitial is dismissible, deferred, or
  non-blocking on first paint.

### AIVB-031 — Buttons/forms/menus have labels/roles/states for agents/accessibility (S062)

- Severity: High, Mode: heuristic.
- FAIL when there are unlabeled form controls (no `<label for>`,
  `aria-label`, `aria-labelledby`, or visible label).
- Minimal fix family: add `<label>` with `for=` matching the input id, or add
  `aria-label`.

### AIVB-032 — Main content is available in source/rendered HTML, not JS-only (S063)

- Severity: High, Mode: heuristic.
- FAIL when the static HTML is essentially empty and main content is rendered
  client-side only without an SSR fallback.
- Minimal fix family: enable SSR/SSG for the page template.

### AIVB-033 — Legal/privacy/sensitive index/noindex intent is correct (S065)

- Severity: Medium, Mode: needs-claude-review.
- Pass when the index/noindex intent of legal/privacy/sensitive pages is
  deliberate and correct.
- Minimal fix family: align robots/meta noindex with the intended policy.

### AIVB-034 — Hreflang present for multilingual pages where applicable (S066)

- Severity: Medium, Mode: deterministic.
- Pass when multilingual pages declare `hreflang` reciprocally. N/A for single-
  language sites.
- Minimal fix family: add reciprocal `hreflang` tags.

### AIVB-035 — Title, H1, schema title/name, and og:title are aligned (S067)

- Severity: Medium, Mode: deterministic.
- Pass when `<title>`, `<h1>`, JSON-LD `headline`/`name`, and `og:title`
  are consistent.
- Minimal fix family: align the four titles without rewriting the page.

### AIVB-036 — Strategic page has at least three relevant distinct prompt/query mappings where applicable (S070)

- Severity: Medium, Mode: needs-claude-review.
- Pass when a strategic page has at least three explicit prompt/query
  mappings (visible Q&A, FAQ block, or recorded prompt list). Heuristic
  alone cannot prove this; mark NEEDS_REVIEW.
- Minimal fix family: add a prompt-mapped FAQ block; record prompt mappings
  in metadata.

## Detector corrections (post-launch)

After comparing plugin verdicts against an LLM-judged baseline on a real
site, five detectors were corrected to remove systematic false positives
and false negatives. The public IDs and source IDs are unchanged; only
the evaluation strategy moved.

| Public ID | Source ID | Old mode | New behaviour |
|---|---|---|---|
| AIVB-012 | S037 | needs-claude-review | Page-type classifier returns N/A on service/industry/legal/corporate landing pages; NEEDS_REVIEW only on expertise-sensitive page types (article/case/event) without a byline. |
| AIVB-019 | S047 | heuristic (FAIL on missing alt of any "meaningful" image) | Now counts every in-body img >= 96x96 outside nav/header/footer; reports missing-alt percentage. FAILs at >= 10% missing alt. |
| AIVB-029 | S060 | needs-claude-review | Marked `excludeFromPriority: true`; reported in `/aiv-analyze` but not in `/aiv-priority` because Core Web Vitals require PSI/CrUX. |
| AIVB-030 | S061 | heuristic (FAIL on any fixed-position cookie banner) | Demoted to needs-claude-review. Heuristic only records the candidate; judge decides whether the overlay actually blocks main content. |
| AIVB-034 | S066 | deterministic (FAIL on lang=en-us without hreflang) | Detects site-level multilingual signal (any hreflang link anywhere in the crawl, or two distinct language path segments) before failing. Single-language sites return N/A. |
| AIVB-035 | S067 | deterministic (string compare title/H1/og/schema) | Demoted to needs-claude-review. Heuristic records the divergence; judge decides whether marketing title + short H1 are semantically aligned. |

## Provenance summary

The mapping above is canonical. Tests in `tests/checklist.test.mjs` enforce:

- exactly 36 checks,
- exact public ID order from `AIVB-001` to `AIVB-036`,
- exact source ID mapping in the table above,
- no duplicates,
- every check has all required fields.
