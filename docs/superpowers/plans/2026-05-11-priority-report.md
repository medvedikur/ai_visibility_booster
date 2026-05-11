# Priority Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-site priority report (`/aiv-priority`) plus the input pipeline needed to make it faithful: an opt-in `--thorough` mode on `/aiv-analyze` that uses the existing `aiv-page-auditor` subagent to resolve `NEEDS_REVIEW`, and corrections to five buggy detectors that systematically misclassify pages.

**Architecture:** Pure-function `lib/priority.mjs` consumes the existing `verdicts.json` and emits priority rows; pure-function `lib/priority-report-html.mjs` renders the rows into a self-contained HTML page. Detector corrections live in `lib/analyzer.mjs`. The judge step is a new module `lib/judge.mjs` invoked from `cmdAnalyze` when `--thorough` is set. Everything stays Node 20 built-ins; no new npm deps.

**Tech Stack:** Node 20 `--test`, ES modules, the existing `aiv-page-auditor` subagent (via Claude Code's Task tool — abstracted behind an injected `invokeAgent` callback so the judge module is unit-testable without the harness).

---

## File map

```
commands/
  aiv-priority.md            NEW
  aiv-analyze.md             EDIT — document --thorough
lib/
  priority.mjs               NEW — compute priority rows from verdicts.json
  priority-report-html.mjs   NEW — render priority rows to HTML
  judge.mjs                  NEW — orchestrate aiv-page-auditor subagent calls
  page-type.mjs              NEW — classify URL/snapshot into service/blog/news/etc.
  analyzer.mjs               EDIT — detector corrections for AIVB-012/019/030/034/035; mark AIVB-029
  checks.mjs                 EDIT — add priorityProblem; add excludeFromPriority on AIVB-029
bin/aiv.mjs                  EDIT — wire /aiv-priority subcommand and --thorough flag
agents/aiv-page-auditor.md   EDIT — confirm prompt covers AIVB-012/019/030/035
tests/
  priority.test.mjs          NEW
  priority-report.test.mjs   NEW
  judge.test.mjs             NEW
  page-type.test.mjs         NEW
  analyzer.test.mjs          EDIT — fixtures + assertions for the 5 corrected detectors
  checklist.test.mjs         EDIT — assert priorityProblem present
  cli.test.mjs               EDIT — smoke /aiv-priority on fixture site
  fixtures/
    image-heavy-page.html    NEW — for AIVB-019 detector
    service-landing.html     NEW — for AIVB-012 page-type classifier
    blog-no-author.html      NEW — for AIVB-012 page-type classifier
    single-language-page.html NEW — for AIVB-034
    multilingual-page.html   NEW — for AIVB-034
    marketing-title-page.html NEW — for AIVB-035 (semantic align)
docs/
  spec.md                    EDIT — describe /aiv-priority, --thorough, formula
  source-research.md         EDIT — note the 5 detector corrections
```

Files that change together:
- `lib/checks.mjs` + `tests/checklist.test.mjs` (Task 1)
- `lib/analyzer.mjs` + new fixtures + `tests/analyzer.test.mjs` (Tasks 5-9)
- `lib/priority.mjs` + `tests/priority.test.mjs` (Task 10)
- `lib/priority-report-html.mjs` + `tests/priority-report.test.mjs` (Task 11)
- `lib/judge.mjs` + `tests/judge.test.mjs` (Task 12)
- `bin/aiv.mjs` + `commands/*.md` + `tests/cli.test.mjs` (Tasks 13-14)
- `docs/spec.md` + `docs/source-research.md` (Task 15)

---

## Task 1: Add priorityProblem + excludeFromPriority to checks.mjs

**Files:**
- Modify: `lib/checks.mjs`
- Test: `tests/checklist.test.mjs`

- [ ] **Step 1: Extend checklist test to require priorityProblem on every check and excludeFromPriority on AIVB-029**

Add to `tests/checklist.test.mjs` immediately before the final `test(...)` block (after the "every check has required fields" test):

```javascript
test("every check has non-empty priorityProblem", () => {
  for (const check of CHECKS) {
    assert.ok(
      typeof check.priorityProblem === "string" && check.priorityProblem.length > 0,
      `${check.id} missing priorityProblem`
    );
  }
});

test("AIVB-029 is excluded from priority computation", () => {
  const c = CHECKS_BY_ID.get("AIVB-029");
  assert.equal(c.excludeFromPriority, true);
});

test("no other check is excluded from priority computation", () => {
  const excluded = CHECKS.filter((c) => c.excludeFromPriority === true).map((c) => c.id);
  assert.deepEqual(excluded, ["AIVB-029"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/checklist.test.mjs 2>&1 | tail -20`

Expected: 3 new tests fail with `priorityProblem missing` / `c.excludeFromPriority` undefined.

- [ ] **Step 3: Update the check() helper in lib/checks.mjs to accept priorityProblem and excludeFromPriority**

Replace the `check({...})` helper (lines 12-39 of `lib/checks.mjs`) with:

```javascript
function check({
  publicNumber,
  sourceId,
  title,
  description,
  severity,
  gapCategory,
  scope = "page",
  evaluationMode,
  minimalFix,
  priorityProblem,
  excludeFromPriority = false
}) {
  const id = `AIVB-${String(publicNumber).padStart(3, "0")}`;
  return {
    id,
    sourceId,
    title,
    description,
    severity,
    gapCategory,
    scope,
    evaluationMode,
    minimalFix,
    priorityProblem,
    excludeFromPriority,
    sourceEvidence: {
      repository: SOURCE_REPO,
      files: SOURCE_FILES
    }
  };
}
```

- [ ] **Step 4: Add priorityProblem to each of the 36 checks**

Insert a `priorityProblem` line after `minimalFix` in each check definition. Full mapping (English, business-language, one sentence per check, paraphrased from the source's BUSINESS_DESCR table):

```javascript
// AIVB-001 (S001)
priorityProblem: "The page returns a 4xx/5xx or chains through several redirects instead of a clean 200, so crawlers and AI bots skip it."

// AIVB-002 (S002)
priorityProblem: "The page exists but is not listed in any XML sitemap, so search engines and AI bots may never discover it."

// AIVB-003 (S004)
priorityProblem: "Multiple URLs answer the same primary intent, so traffic and AI citations get split between near-duplicates."

// AIVB-004 (S006)
priorityProblem: "No other page on the site links to this one, so AI bots have trouble finding it and rank it as secondary."

// AIVB-005 (S008)
priorityProblem: "meta robots=noindex blocks the page from indexing entirely, so it will not appear in any AI answer."

// AIVB-006 (S012)
priorityProblem: "nosnippet/max-snippet:0 restricts what previews can show, so AI Overviews and rich snippets may skip the page."

// AIVB-007 (S023)
priorityProblem: "There is no single clear H1 or there are several conflicting ones, so AI bots cannot tell what the page is about."

// AIVB-008 (S030)
priorityProblem: "Sentences average over 22 words, so AI crawlers split paragraphs into less coherent fragments and citation rate drops."

// AIVB-009 (S031)
priorityProblem: "Processes, comparisons, and lists are described as prose, so AI cannot extract structure and rarely surfaces step-by-step or comparison answers."

// AIVB-010 (S035)
priorityProblem: "No visible publication date, so AI is reluctant to cite the content on time-sensitive topics."

// AIVB-011 (S036)
priorityProblem: "No visible update or review date, so AI bots may treat fast-changing content as potentially stale."

// AIVB-012 (S037)
priorityProblem: "Expertise-sensitive content has no named author or reviewer, weakening the E-E-A-T signal AI uses for trust."

// AIVB-013 (S040)
priorityProblem: "Heading hierarchy is broken or there are no H2 sections, so AI cannot parse the document structure."

// AIVB-014 (S041)
priorityProblem: "Subheadings are generic template labels (Approach, More, Get in touch) instead of describing the section, so they carry no topic signal."

// AIVB-015 (S042)
priorityProblem: "Critical content is hidden behind tabs or click-only JS, so AI crawlers without JS rendering miss it entirely."

// AIVB-016 (S044)
priorityProblem: "Internal anchors use generic phrases (click here, read more), so AI cannot infer link context."

// AIVB-017 (S045)
priorityProblem: "Deep URLs have no breadcrumbs or BreadcrumbList, so Google and AI build a poor map of the site."

// AIVB-018 (S046)
priorityProblem: "Meaningful images use empty src or data: placeholders, so non-JS AI crawlers do not see them at all."

// AIVB-019 (S047)
priorityProblem: "Most meaningful images lack alt text, so to AI bots those images and what they show do not exist."

// AIVB-020 (S048)
priorityProblem: "Important screenshots, infographics, and charts have no nearby caption or text companion, so AI reads only the surrounding prose and skips the visual signal."

// AIVB-021 (S049)
priorityProblem: "There is no og:image or schema image, so social and AI cards render without a preview illustration."

// AIVB-022 (S050)
priorityProblem: "Important image filenames are generic (770x500.png, image-01.png), so AI cannot pull extra meaning from the asset URL."

// AIVB-023 (S051)
priorityProblem: "The primary image is low resolution, a text-only banner, or has an extreme aspect ratio, so AI preview cards look poor."

// AIVB-024 (S052)
priorityProblem: "Video has no transcript, summary, or VideoObject schema, so AI cannot index the video and skips the page when answering."

// AIVB-025 (S054)
priorityProblem: "JSON-LD type is generic WebPage where Article, NewsArticle, or CaseStudy is expected, so Google and AI cannot recognise the page type."

// AIVB-026 (S055)
priorityProblem: "Schema is present but missing required rich-result fields, so Google will not show a rich snippet and AI gets weaker signals."

// AIVB-027 (S057)
priorityProblem: "FAQPage/QAPage schema is present but the visible page does not contain the matching Q&A, which violates Google guidelines."

// AIVB-028 (S058)
priorityProblem: "The mobile version hides part of the content or CTA via display:none, and Google indexes mobile-first, so that part is lost."

// AIVB-029 (S060)
priorityProblem: "Core Web Vitals (LCP/INP/CLS) are out of the Good range, so Google downranks the page and AI Overview cites it less."

// AIVB-030 (S061)
priorityProblem: "Cookie consent, popup, or auth wall covers the main content on first visit, so AI crawlers do not reach the useful text."

// AIVB-031 (S062)
priorityProblem: "Interactive elements lack accessibility labels, so agents (ChatGPT Atlas and similar) cannot interact with the page."

// AIVB-032 (S063)
priorityProblem: "Main content renders only via JavaScript and is missing from the static HTML, so non-rendering AI crawlers skip the page."

// AIVB-033 (S065)
priorityProblem: "Privacy/legal pages have the wrong index/noindex intent, exposing pages that should be private or hiding ones that should be indexed."

// AIVB-034 (S066)
priorityProblem: "Multilingual pages have no hreflang signals, so AI and Google cannot tell which version matches which language or region."

// AIVB-035 (S067)
priorityProblem: "Title, H1, schema name, and og:title disagree, so AI receives conflicting signals about the same page."

// AIVB-036 (S070)
priorityProblem: "The page targets one primary query and ignores 2-3 related secondary queries, leaving the long tail of AI citations on the table."
```

Edit each of the 36 check definitions in `lib/checks.mjs` (lines 41-403) to add the `priorityProblem` line. For check `AIVB-029` (the entry at `publicNumber: 29`, `sourceId: "S060"`), additionally add `excludeFromPriority: true,` immediately before the closing `}`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/checklist.test.mjs 2>&1 | tail -20`

Expected: all checklist tests pass.

- [ ] **Step 6: Run full test suite to confirm nothing regressed**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: `pass 73` (was 70; +3 new tests). Zero fails.

- [ ] **Step 7: Commit**

```bash
git add lib/checks.mjs tests/checklist.test.mjs
git commit -m "$(cat <<'EOF'
Add priorityProblem and excludeFromPriority on every check

Adds a business-language one-line priorityProblem field to every
AIVB-001..AIVB-036 entry, used by the upcoming /aiv-priority report.
Marks AIVB-029 (Core Web Vitals) with excludeFromPriority=true because
it requires third-party PageSpeed/CrUX data the plugin does not call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Page-type classifier (lib/page-type.mjs)

**Files:**
- Create: `lib/page-type.mjs`
- Test: `tests/page-type.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/page-type.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPageType } from "../lib/page-type.mjs";

function snapshot(over = {}) {
  return {
    url: "https://example.com/",
    jsonLdTypes: [],
    headings: { h1: [], h2: [] },
    title: "",
    bodyTextLength: 600,
    ...over
  };
}

test("classifies services/, solutions/, industries/, products/ as 'service'", () => {
  for (const p of ["/services/qa-outsourcing", "/solutions/cloud", "/industries/banking", "/products/widget"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "service");
  }
});

test("classifies /about, /contact, /careers as 'corporate'", () => {
  for (const p of ["/about-us", "/contact", "/careers"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "corporate");
  }
});

test("classifies /privacy, /legal, /terms, /cookies as 'legal'", () => {
  for (const p of ["/privacy", "/legal", "/terms-of-use", "/cookies"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "legal");
  }
});

test("classifies /blog/*, /news/*, /insights/* as 'article'", () => {
  for (const p of ["/blog/post-1", "/news/2026-event", "/insights/whitepaper"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "article");
  }
});

test("classifies /portfolio/, /case-studies/, /case-study/ as 'case'", () => {
  for (const p of ["/portfolio/community-portal", "/case-studies/bank", "/case-study/abc"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "case");
  }
});

test("uses JSON-LD @type as a strong signal when URL is ambiguous", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["Article"] })), "article");
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["NewsArticle"] })), "article");
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["Service"] })), "service");
});

test("falls back to 'other' when nothing matches", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo" })), "other");
});

test("homepage / classifies as 'home'", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/" })), "home");
});

test("expertiseSensitiveTypes includes article and case but not service or legal", () => {
  const { EXPERTISE_SENSITIVE_TYPES } = require_or_import_holder;
  // see actual import in next step
});
```

The last test is a placeholder; replace it with a real one in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/page-type.test.mjs 2>&1 | tail -20`

Expected: All tests fail with "Cannot find module '../lib/page-type.mjs'".

- [ ] **Step 3: Write the implementation**

Create `lib/page-type.mjs`:

```javascript
const URL_PATTERNS = [
  [/^\/$|^\/index/i, "home"],
  [/^\/(services|solutions|industries|industry|product|products|use-cases?|platform)\b/i, "service"],
  [/^\/(blog|news|insights|articles?|posts?)\b/i, "article"],
  [/^\/(portfolio|case-stud(?:y|ies)|customers?|clients?)\b/i, "case"],
  [/^\/(events?|webinars?|conferences?)\b/i, "event"],
  [/^\/(privacy|legal|terms|cookies?)\b/i, "legal"],
  [/^\/(about|contact|careers?|jobs?|team)\b/i, "corporate"]
];

const SCHEMA_HINTS = {
  Article: "article",
  NewsArticle: "article",
  BlogPosting: "article",
  TechArticle: "article",
  CaseStudy: "case",
  Service: "service",
  Product: "service",
  Event: "event",
  Person: "corporate",
  Organization: "corporate",
  WebSite: "home"
};

export const EXPERTISE_SENSITIVE_TYPES = new Set(["article", "case", "event"]);

export function classifyPageType(snapshot) {
  let pathname = "/";
  try { pathname = new URL(snapshot.url).pathname; } catch {}

  for (const [re, type] of URL_PATTERNS) {
    if (re.test(pathname)) return type;
  }

  const types = snapshot.jsonLdTypes || [];
  for (const t of types) {
    const hint = SCHEMA_HINTS[String(t)];
    if (hint) return hint;
  }

  return "other";
}

export function isExpertiseSensitive(snapshot) {
  return EXPERTISE_SENSITIVE_TYPES.has(classifyPageType(snapshot));
}
```

- [ ] **Step 4: Replace the placeholder test in tests/page-type.test.mjs**

Replace the last test in `tests/page-type.test.mjs` (the `EXPERTISE_SENSITIVE_TYPES` placeholder) with:

```javascript
import { isExpertiseSensitive } from "../lib/page-type.mjs";

test("isExpertiseSensitive returns true for article/case/event and false for service/legal/home/corporate/other", () => {
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/blog/post" })), true);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/case-studies/x" })), true);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/services/qa" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/privacy" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/about" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/foo" })), false);
});
```

Also remove the stale `require_or_import_holder` placeholder line.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/page-type.test.mjs 2>&1 | tail -20`

Expected: all page-type tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/page-type.mjs tests/page-type.test.mjs
git commit -m "$(cat <<'EOF'
Add page-type classifier for AIVB-012 detector

Adds lib/page-type.mjs with URL- and JSON-LD-based classification into
service / article / case / event / corporate / legal / home / other.
Used by AIVB-012 (author/reviewer) to mark service-template pages N/A
instead of always returning NEEDS_REVIEW.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix AIVB-012 detector (author/reviewer)

**Files:**
- Modify: `lib/analyzer.mjs:152-165` (the `evaluateAIVB012` function)
- Test: `tests/analyzer.test.mjs` (add new assertions)
- Create: `tests/fixtures/service-landing.html`, `tests/fixtures/blog-no-author.html`

- [ ] **Step 1: Create two new fixtures**

Create `tests/fixtures/service-landing.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QA outsourcing services</title>
  <link rel="canonical" href="https://example.com/services/qa-outsourcing">
  <meta property="og:title" content="QA outsourcing services">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"QA outsourcing"}</script>
</head>
<body>
  <h1>QA outsourcing services</h1>
  <h2>How it works</h2>
  <p>We help enterprises move QA off in-house teams. The service is fully managed.</p>
  <h2>Outcomes</h2>
  <p>Reduced delivery time. Better defect leakage rate. Higher coverage.</p>
</body>
</html>
```

Create `tests/fixtures/blog-no-author.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>How AI changes test automation in 2026</title>
  <link rel="canonical" href="https://example.com/blog/ai-test-automation-2026">
  <meta property="og:title" content="How AI changes test automation in 2026">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"How AI changes test automation in 2026"}</script>
</head>
<body>
  <h1>How AI changes test automation in 2026</h1>
  <p>Test automation is shifting fast. The introduction of AI-driven tooling has compressed the cycle from weeks to days. Engineering teams now ship more.</p>
  <h2>Three patterns we see</h2>
  <p>Generative-first authoring is replacing scripted Selenium for new suites. Self-healing locators have become table stakes. Visual diffing is more reliable than DOM diffing for marketing pages.</p>
</body>
</html>
```

- [ ] **Step 2: Add failing assertions to tests/analyzer.test.mjs**

Append to `tests/analyzer.test.mjs`:

```javascript
test("AIVB-012 returns N/A on service landing pages", async () => {
  const page = await loadPage("service-landing.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-012");
  assert.equal(v.value, "N/A");
  assert.match(v.evidence, /service|page type|byline/i);
});

test("AIVB-012 returns NEEDS_REVIEW on blog pages with no byline", async () => {
  const page = await loadPage("blog-no-author.html", "https://example.com/blog/ai-test-automation-2026");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-012");
  assert.equal(v.value, "NEEDS_REVIEW");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: both new tests fail (service-landing returns NEEDS_REVIEW today; blog-no-author returns NEEDS_REVIEW which actually matches — but evidence won't match the regex).

- [ ] **Step 4: Update lib/analyzer.mjs to use page-type classifier in AIVB-012**

Add at the top of `lib/analyzer.mjs` (near the existing imports):

```javascript
import { classifyPageType, isExpertiseSensitive } from "./page-type.mjs";
```

Replace the existing `evaluateAIVB012` function (lines 152-165) with:

```javascript
function evaluateAIVB012(check, page) {
  const pageType = classifyPageType(page);
  if (!isExpertiseSensitive(page)) {
    return makeVerdict(check, "N/A", `Page type "${pageType}" does not require a named expertise byline.`, { naReason: "not_applicable" });
  }
  if (page.jsonLdBlocks.some((b) => {
    const author = b.author;
    if (!author) return false;
    const authors = Array.isArray(author) ? author : [author];
    return authors.some((a) => a && (a.name || (typeof a === "string" && a.length > 0)));
  })) {
    return makeVerdict(check, "PASS", "Named author present in JSON-LD.");
  }
  if (/by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(page.bodyText)) {
    return makeVerdict(check, "PASS", "Visible byline pattern detected in body text.");
  }
  return makeVerdict(check, "NEEDS_REVIEW", `Expertise-sensitive page (type=${pageType}) has no named author/reviewer; verify via aiv-page-auditor.`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: the two new AIVB-012 tests pass, plus the existing "every AIVB check is exercised" test still passes.

- [ ] **Step 6: Run full test suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 7: Commit**

```bash
git add lib/analyzer.mjs tests/analyzer.test.mjs tests/fixtures/service-landing.html tests/fixtures/blog-no-author.html
git commit -m "$(cat <<'EOF'
Fix AIVB-012 to skip service pages via page-type classifier

Service / industry / legal / corporate landing pages no longer require
a named author byline — they return N/A. Article / case / event pages
that lack a byline return NEEDS_REVIEW so the aiv-page-auditor can
resolve them under --thorough mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fix AIVB-019 detector (alt text)

**Files:**
- Modify: `lib/analyzer.mjs:237-251` (evaluateAIVB019)
- Modify: `lib/extract-page.mjs:155-181` (parseImages) — add an `inLayoutChrome` flag
- Test: `tests/analyzer.test.mjs`
- Create: `tests/fixtures/image-heavy-page.html`

- [ ] **Step 1: Create fixture for an image-heavy page (a1qa-style)**

Create `tests/fixtures/image-heavy-page.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QA awards and certifications</title>
  <link rel="canonical" href="https://example.com/awards">
</head>
<body>
  <header>
    <nav aria-label="primary">
      <img src="/logo.svg" width="120" height="40">
    </nav>
  </header>
  <main>
    <h1>QA awards and certifications</h1>
    <p>We have collected the following recognitions over the past decade.</p>
    <div class="badges">
      <img src="/badges/iaop-100.png" width="200" height="200">
      <img src="/badges/clutch-top.png" width="200" height="200">
      <img src="/badges/iso-9001.png" width="200" height="200">
      <img src="/badges/iso-27001.png" width="200" height="200">
      <img src="/badges/goodfirms.png" width="200" height="200">
      <img src="/badges/glassdoor.png" width="200" height="200">
    </div>
    <h2>Recent awards</h2>
    <img src="/heroes/awards-hero.jpg" width="1200" height="600">
    <img src="/heroes/team-photo.jpg" width="1200" height="600">
    <img src="/heroes/ceremony.jpg" width="1200" height="600">
  </main>
  <footer>
    <img src="/footer-logo.svg" width="120" height="40">
  </footer>
</body>
</html>
```

This page has 11 `<img>` elements: 1 nav logo (chrome), 6 badges in body, 3 heroes in body, 1 footer logo (chrome). Body meaningful images = 9, all missing `alt`.

- [ ] **Step 2: Add failing assertion to tests/analyzer.test.mjs**

Append to `tests/analyzer.test.mjs`:

```javascript
test("AIVB-019 counts in-body images outside nav/header/footer", async () => {
  const page = await loadPage("image-heavy-page.html", "https://example.com/awards");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-019");
  assert.equal(v.value, "FAIL");
  assert.match(v.evidence, /9.*meaningful/i, `evidence should report 9 meaningful images, got: ${v.evidence}`);
});

test("AIVB-019 evidence reports missing-alt percentage", async () => {
  const page = await loadPage("image-heavy-page.html", "https://example.com/awards");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-019");
  assert.match(v.evidence, /100%|9\/9/, `evidence should report 9/9 or 100%, got: ${v.evidence}`);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: both new AIVB-019 tests fail because today's evaluator only counts `og:image`-matched primary images.

- [ ] **Step 4: Update extract-page.mjs to mark images in nav/header/footer as layout chrome**

Replace the `parseImages` function (lines 155-181) in `lib/extract-page.mjs` with:

```javascript
const CHROME_TAG_RE = /<(nav|header|footer)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

function chromeSpans(html) {
  const spans = [];
  const body = bodyOnly(html);
  const offset = html.indexOf(body);
  CHROME_TAG_RE.lastIndex = 0;
  let m;
  while ((m = CHROME_TAG_RE.exec(body)) !== null) {
    spans.push([offset + m.index, offset + m.index + m[0].length]);
  }
  return spans;
}

function isInsideChrome(pos, spans) {
  for (const [a, b] of spans) {
    if (pos >= a && pos < b) return true;
  }
  return false;
}

function parseImages(html, baseUrl) {
  const images = [];
  const body = bodyOnly(html);
  const offset = html.indexOf(body);
  const spans = chromeSpans(html);
  IMG_RE.lastIndex = 0;
  let m;
  while ((m = IMG_RE.exec(body)) !== null) {
    const src = attr(m[1], "src") || attr(m[1], "data-src") || "";
    const alt = attr(m[1], "alt");
    const ariaHidden = attr(m[1], "aria-hidden");
    const role = attr(m[1], "role");
    const width = Number(attr(m[1], "width") || "0");
    const height = Number(attr(m[1], "height") || "0");
    let resolved = "";
    try { resolved = new URL(src, baseUrl).toString(); } catch {}
    const absolutePos = offset + m.index;
    const inChrome = isInsideChrome(absolutePos, spans);
    images.push({
      src,
      resolved,
      alt: alt ?? "",
      altMissing: alt === null,
      decorative: alt === "" || ariaHidden === "true" || role === "presentation",
      filename: filenameOf(src),
      srcEmpty: isInlineSrc(src),
      width,
      height,
      inChrome
    });
  }
  return images;
}
```

- [ ] **Step 5: Update evaluateAIVB019 to use the new meaningful-image filter**

Replace `evaluateAIVB019` (lines 237-251 of `lib/analyzer.mjs`) with:

```javascript
function evaluateAIVB019(check, page) {
  const MEANING_SIZE = 96;
  const meaningful = page.images.filter((i) => {
    if (i.decorative) return false;
    if (i.srcEmpty) return false;
    if (i.inChrome) return false;
    if (i.width > 0 && i.height > 0 && (i.width < MEANING_SIZE || i.height < MEANING_SIZE)) return false;
    return true;
  });
  if (meaningful.length === 0) {
    return makeVerdict(check, "N/A", "No meaningful in-body images to evaluate.", { naReason: "not_applicable" });
  }
  const missingAlt = meaningful.filter((i) => i.altMissing || (i.alt === "" && !i.decorative));
  const ratio = missingAlt.length / meaningful.length;
  const pct = Math.round(ratio * 100);
  const decorativeCount = page.images.filter((i) => i.decorative).length;
  const evidence = `Meaningful in-body images=${meaningful.length}; missing alt=${missingAlt.length}/${meaningful.length} (${pct}%); decorative=${decorativeCount}.`;
  if (ratio >= 0.1) return makeVerdict(check, "FAIL", evidence);
  if (missingAlt.length === 0) return makeVerdict(check, "PASS", evidence);
  return makeVerdict(check, "NEEDS_REVIEW", evidence);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -30`

Expected: new AIVB-019 tests pass; existing `AIVB-019 FAILs when meaningful images missing alt` on `media-page.html` still passes (it should — that fixture also has images missing alt).

- [ ] **Step 7: Run full test suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 8: Commit**

```bash
git add lib/analyzer.mjs lib/extract-page.mjs tests/analyzer.test.mjs tests/fixtures/image-heavy-page.html
git commit -m "$(cat <<'EOF'
Fix AIVB-019 to count all in-body images, not just og:image candidates

Adds inChrome flag on parsed images (true for images inside <nav>,
<header>, or <footer>) and widens the meaningful-image filter to
every in-body img >= 96x96. Evidence now reports missing-alt
percentage. Reproduces the 9/9 missing-alt verdict on the new
image-heavy fixture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Demote AIVB-030 to needs-claude-review

**Files:**
- Modify: `lib/checks.mjs` — change AIVB-030 `evaluationMode`
- Modify: `lib/analyzer.mjs:361-366` (evaluateAIVB030)
- Test: `tests/analyzer.test.mjs`

- [ ] **Step 1: Add failing assertion**

Append to `tests/analyzer.test.mjs`:

```javascript
test("AIVB-030 returns NEEDS_REVIEW when a fixed-position interstitial candidate is detected", async () => {
  const page = await loadPage("failing-page.html", "https://example.com/internal");
  page.interstitialCandidate = true;
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-030");
  assert.equal(v.value, "NEEDS_REVIEW");
  assert.match(v.evidence, /candidate|judge/i);
});

test("AIVB-030 PASSes when no candidate detected", async () => {
  const page = await loadPage("passing-page.html", "https://example.com/services/qa-outsourcing");
  page.interstitialCandidate = false;
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-030");
  assert.equal(v.value, "PASS");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: first new test fails (current behavior returns FAIL, not NEEDS_REVIEW).

- [ ] **Step 3: Change AIVB-030 evaluationMode in lib/checks.mjs**

Find the AIVB-030 entry (publicNumber 30, sourceId "S061") in `lib/checks.mjs` and change:

```javascript
evaluationMode: "heuristic",
```

to:

```javascript
evaluationMode: "needs-claude-review",
```

- [ ] **Step 4: Update evaluateAIVB030 in lib/analyzer.mjs**

Replace `evaluateAIVB030` (lines 361-366) with:

```javascript
function evaluateAIVB030(check, page) {
  if (page.interstitialCandidate) {
    return makeVerdict(check, "NEEDS_REVIEW", "Fixed-position overlay candidate detected; judge whether it actually blocks main content (z-index, dismissibility, viewport coverage).");
  }
  return makeVerdict(check, "PASS", "No interstitial candidate detected in static HTML.");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: both new AIVB-030 tests pass.

- [ ] **Step 6: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 7: Commit**

```bash
git add lib/checks.mjs lib/analyzer.mjs tests/analyzer.test.mjs
git commit -m "$(cat <<'EOF'
Demote AIVB-030 (interstitial) to needs-claude-review

Heuristic flagged any fixed-position cookie banner as FAIL, but in
practice only the subset that actually blocks main content matters
for AI Visibility. Now records the DOM signal and asks the judge to
decide; PASS still applies when no candidate is detected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fix AIVB-034 to detect single-language sites

**Files:**
- Modify: `lib/analyzer.mjs:394-402` (evaluateAIVB034)
- Test: `tests/analyzer.test.mjs`
- Create: `tests/fixtures/single-language-page.html`, `tests/fixtures/multilingual-page.html`

- [ ] **Step 1: Create fixtures**

Create `tests/fixtures/single-language-page.html`:

```html
<!doctype html>
<html lang="en-us">
<head>
  <meta charset="utf-8">
  <title>QA outsourcing services</title>
  <link rel="canonical" href="https://example.com/services/qa-outsourcing">
</head>
<body>
  <h1>QA outsourcing services</h1>
  <p>We help enterprises move QA off in-house teams. The service is fully managed.</p>
</body>
</html>
```

Create `tests/fixtures/multilingual-page.html`:

```html
<!doctype html>
<html lang="en-us">
<head>
  <meta charset="utf-8">
  <title>QA outsourcing services</title>
  <link rel="canonical" href="https://example.com/en/services/qa-outsourcing">
  <link rel="alternate" hreflang="en-us" href="https://example.com/en/services/qa-outsourcing">
  <link rel="alternate" hreflang="de-de" href="https://example.com/de/services/qa-outsourcing">
</head>
<body>
  <h1>QA outsourcing services</h1>
  <p>Service description.</p>
</body>
</html>
```

- [ ] **Step 2: Add failing assertions**

Append to `tests/analyzer.test.mjs`:

```javascript
test("AIVB-034 returns N/A on a single-language site (no other-language signal in crawl)", async () => {
  const page = await loadPage("single-language-page.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext({ siteMultilingual: false }));
  const v = verdicts.find((x) => x.checkId === "AIVB-034");
  assert.equal(v.value, "N/A");
  assert.match(v.evidence, /single-language/i);
});

test("AIVB-034 FAILs on a multilingual site when page has no hreflang", async () => {
  const page = await loadPage("single-language-page.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext({ siteMultilingual: true }));
  const v = verdicts.find((x) => x.checkId === "AIVB-034");
  assert.equal(v.value, "FAIL");
});

test("AIVB-034 PASSes when hreflang links exist on the page", async () => {
  const page = await loadPage("multilingual-page.html", "https://example.com/en/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext({ siteMultilingual: true }));
  const v = verdicts.find((x) => x.checkId === "AIVB-034");
  assert.equal(v.value, "PASS");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: first new test fails (current behavior auto-FAILs on `lang=en-us` without hreflang).

- [ ] **Step 4: Update evaluateAIVB034**

Replace `evaluateAIVB034` (lines 394-402 of `lib/analyzer.mjs`) with:

```javascript
function evaluateAIVB034(check, page, ctx) {
  if (page.hreflang.length > 0) {
    return makeVerdict(check, "PASS", `${page.hreflang.length} hreflang link(s) declared on this page.`);
  }
  const multilingual = ctx?.siteMultilingual === true;
  if (multilingual) {
    return makeVerdict(check, "FAIL", `Site has multilingual signals but this page has no hreflang declared.`);
  }
  return makeVerdict(check, "N/A", "Single-language site; hreflang not required.", { naReason: "not_applicable" });
}
```

- [ ] **Step 5: Update bin/aiv.mjs to compute siteMultilingual and pass it into the analyzer ctx**

In `bin/aiv.mjs`, inside `cmdAnalyze` (lines 172-258), before the `for (const page of selected)` loop, add:

```javascript
const siteMultilingual = crawlData.pages.some((p) => (p.snapshot?.hreflang || []).length > 0)
  || crawlData.pages.some((p) => {
       const urls = (p.snapshot?.links || []).map((l) => l.resolved).filter(Boolean);
       const langCodes = new Set();
       for (const u of urls) {
         try {
           const seg = new URL(u).pathname.split("/").filter(Boolean)[0] || "";
           if (/^[a-z]{2}(-[a-z]{2})?$/i.test(seg)) langCodes.add(seg.toLowerCase());
         } catch {}
       }
       return langCodes.size >= 2;
     });
```

Then in the `ctx` object built inside the loop, add `siteMultilingual,` after `sameOriginPages`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: all three new AIVB-034 tests pass.

- [ ] **Step 7: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 8: Commit**

```bash
git add lib/analyzer.mjs bin/aiv.mjs tests/analyzer.test.mjs tests/fixtures/single-language-page.html tests/fixtures/multilingual-page.html
git commit -m "$(cat <<'EOF'
Fix AIVB-034 to skip hreflang requirement on single-language sites

Adds a siteMultilingual flag derived from the full crawl (any page
with hreflang links, or paths with two or more two-letter language
segments). Single-language sites now return N/A; multilingual sites
with no hreflang on a given page still FAIL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Demote AIVB-035 to needs-claude-review

**Files:**
- Modify: `lib/checks.mjs` — AIVB-035 `evaluationMode`
- Modify: `lib/analyzer.mjs:404-414` (evaluateAIVB035)
- Test: `tests/analyzer.test.mjs`
- Create: `tests/fixtures/marketing-title-page.html`

- [ ] **Step 1: Create fixture**

Create `tests/fixtures/marketing-title-page.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Full-cycle QA services for banking and financial software | a1qa</title>
  <link rel="canonical" href="https://example.com/services/banking-and-financial">
  <meta property="og:title" content="Full-cycle QA services for banking and financial software">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"QA of financial software"}</script>
</head>
<body>
  <h1>QA of financial software</h1>
  <p>Service description.</p>
</body>
</html>
```

This is the exact pattern that produced a false-positive FAIL in the comparison: marketing title + brand vs short H1 category.

- [ ] **Step 2: Add failing assertion**

Append to `tests/analyzer.test.mjs`:

```javascript
test("AIVB-035 returns NEEDS_REVIEW on marketing-title + short-h1 patterns (semantic, not literal)", async () => {
  const page = await loadPage("marketing-title-page.html", "https://example.com/services/banking-and-financial");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-035");
  assert.equal(v.value, "NEEDS_REVIEW");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: new test fails — current evaluator returns FAIL because the strings differ.

- [ ] **Step 4: Change AIVB-035 evaluationMode in lib/checks.mjs**

Find the AIVB-035 entry (publicNumber 35, sourceId "S067") in `lib/checks.mjs` and change:

```javascript
evaluationMode: "deterministic",
```

to:

```javascript
evaluationMode: "needs-claude-review",
```

- [ ] **Step 5: Update evaluateAIVB035 to surface evidence and defer to judge**

Replace `evaluateAIVB035` (lines 404-414 of `lib/analyzer.mjs`) with:

```javascript
function evaluateAIVB035(check, page) {
  const titles = [page.title, page.headings.h1[0] || "", page.ogTitle].filter(Boolean);
  const headlines = page.jsonLdBlocks.map((b) => b.headline || b.name).filter(Boolean);
  if (headlines.length) titles.push(...headlines);
  const unique = new Set(titles.map((t) => String(t).toLowerCase().trim()));
  if (unique.size <= 1) return makeVerdict(check, "PASS", `All ${titles.length} title sources match.`);
  const variants = [...unique].slice(0, 4).join(" | ");
  return makeVerdict(check, "NEEDS_REVIEW", `Title sources have ${unique.size} variants: ${variants}. Judge whether the variants are semantically aligned (e.g. marketing title + short H1 category is OK).`);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/analyzer.test.mjs 2>&1 | tail -20`

Expected: new AIVB-035 test passes.

- [ ] **Step 7: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 8: Commit**

```bash
git add lib/checks.mjs lib/analyzer.mjs tests/analyzer.test.mjs tests/fixtures/marketing-title-page.html
git commit -m "$(cat <<'EOF'
Demote AIVB-035 (title alignment) to needs-claude-review

Heuristic was string-comparing title/H1/og:title/schema name and
flagging the marketing-title + short-H1-category pattern as FAIL.
That pattern is semantically aligned in practice. Now records the
divergence as evidence and asks the judge to confirm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Priority computation module (lib/priority.mjs)

**Files:**
- Create: `lib/priority.mjs`
- Test: `tests/priority.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/priority.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriorityRows, severityFactor, bucketForPriority } from "../lib/priority.mjs";

function verdict(checkId, value) {
  return { checkId, value };
}

function buildAnalysis(perPage) {
  return {
    verdicts: perPage.map((vs, i) => ({
      url: `https://example.com/p${i}`,
      verdicts: vs.map((v) => verdict(v.checkId, v.value))
    }))
  };
}

test("severityFactor returns Critical=1.0 / High=0.85 / Medium=0.7 / Low=0.5", () => {
  assert.equal(severityFactor("Critical"), 1.0);
  assert.equal(severityFactor("High"), 0.85);
  assert.equal(severityFactor("Medium"), 0.7);
  assert.equal(severityFactor("Low"), 0.5);
  assert.equal(severityFactor("Unknown"), 0);
});

test("bucketForPriority uses 50/20/5 thresholds", () => {
  assert.equal(bucketForPriority(100), "HIGH");
  assert.equal(bucketForPriority(50), "HIGH");
  assert.equal(bucketForPriority(49.99), "MEDIUM");
  assert.equal(bucketForPriority(20), "MEDIUM");
  assert.equal(bucketForPriority(19.99), "LOW");
  assert.equal(bucketForPriority(5), "LOW");
  assert.equal(bucketForPriority(4.99), "NONE");
  assert.equal(bucketForPriority(0), "NONE");
});

test("computePriorityRows returns one row per non-excluded check", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "PASS" }]
  ]));
  // Should have 35 rows because AIVB-029 is excluded.
  assert.equal(rows.length, 35);
  assert.ok(!rows.some((r) => r.checkId === "AIVB-029"));
});

test("computePriorityRows: all-PASS site -> every priority is 0 and bucket NONE", () => {
  // Build a verdict matrix where every check on every page is PASS.
  const allChecks = ["AIVB-001","AIVB-002","AIVB-003","AIVB-004","AIVB-005","AIVB-006","AIVB-007","AIVB-008","AIVB-009","AIVB-010","AIVB-011","AIVB-012","AIVB-013","AIVB-014","AIVB-015","AIVB-016","AIVB-017","AIVB-018","AIVB-019","AIVB-020","AIVB-021","AIVB-022","AIVB-023","AIVB-024","AIVB-025","AIVB-026","AIVB-027","AIVB-028","AIVB-029","AIVB-030","AIVB-031","AIVB-032","AIVB-033","AIVB-034","AIVB-035","AIVB-036"];
  const pages = Array.from({ length: 3 }, () => allChecks.map((id) => ({ checkId: id, value: "PASS" })));
  const rows = computePriorityRows(buildAnalysis(pages));
  for (const r of rows) {
    assert.equal(r.priority, 0, `${r.checkId} should be 0`);
    assert.equal(r.bucket, "NONE");
    assert.equal(r.failPct, 0);
  }
});

test("computePriorityRows: 100% FAIL on a Critical check -> priority 100 / HIGH", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "FAIL" }],
    [{ checkId: "AIVB-001", value: "FAIL" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-001");
  assert.equal(row.failPct, 100);
  assert.equal(row.priority, 100);
  assert.equal(row.bucket, "HIGH");
});

test("computePriorityRows: 67% FAIL on a High check -> ~57 / HIGH", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-019", value: "FAIL" }],
    [{ checkId: "AIVB-019", value: "FAIL" }],
    [{ checkId: "AIVB-019", value: "PASS" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-019");
  assert.equal(row.failPct, Math.round((2 / 3) * 100));
  // 66.67% * 0.85 ~ 56.67 ~ 57
  assert.ok(row.priority >= 55 && row.priority <= 58, `priority should be ~57, got ${row.priority}`);
  assert.equal(row.bucket, "HIGH");
});

test("computePriorityRows excludes NEEDS_REVIEW from the denominator", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "FAIL" }],
    [{ checkId: "AIVB-001", value: "PASS" }],
    [{ checkId: "AIVB-001", value: "NEEDS_REVIEW" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-001");
  // denominator = 2 (PASS+FAIL), numerator = 1 -> 50%
  assert.equal(row.failPct, 50);
  assert.equal(row.needsReviewCount, 1);
});

test("computePriorityRows handles checks with all N/A: failPct null, bucket NONE", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-017", value: "N/A" }],
    [{ checkId: "AIVB-017", value: "N/A" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-017");
  assert.equal(row.failPct, null);
  assert.equal(row.priority, 0);
  assert.equal(row.bucket, "NONE");
  assert.match(row.note || "", /no applicable pages/i);
});

test("computePriorityRows sorts rows by priority desc, then failPct desc, then ID asc", () => {
  const rows = computePriorityRows(buildAnalysis([
    [
      { checkId: "AIVB-001", value: "FAIL" }, // Critical, 100%
      { checkId: "AIVB-019", value: "FAIL" }, // High, 100%
      { checkId: "AIVB-008", value: "FAIL" }  // Medium, 100%
    ]
  ]));
  const top3 = rows.slice(0, 3).map((r) => r.checkId);
  assert.deepEqual(top3, ["AIVB-001", "AIVB-019", "AIVB-008"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/priority.test.mjs 2>&1 | tail -20`

Expected: all 9 tests fail with module-not-found.

- [ ] **Step 3: Write lib/priority.mjs**

Create `lib/priority.mjs`:

```javascript
import { CHECKS } from "./checks.mjs";
import { clamp } from "./utils.mjs";

const SEVERITY_FACTOR = {
  Critical: 1.0,
  High: 0.85,
  Medium: 0.7,
  Low: 0.5
};

export function severityFactor(severity) {
  return SEVERITY_FACTOR[severity] ?? 0;
}

export function bucketForPriority(score) {
  if (score >= 50) return "HIGH";
  if (score >= 20) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "NONE";
}

function countsForCheck(analysis, checkId) {
  let pass = 0;
  let fail = 0;
  let needs = 0;
  let na = 0;
  for (const page of analysis.verdicts || []) {
    for (const v of page.verdicts || []) {
      if (v.checkId !== checkId) continue;
      if (v.value === "PASS") pass += 1;
      else if (v.value === "FAIL") fail += 1;
      else if (v.value === "NEEDS_REVIEW") needs += 1;
      else if (v.value === "N/A") na += 1;
    }
  }
  return { pass, fail, needs, na };
}

export function computePriorityRows(analysis) {
  const rows = [];
  for (const check of CHECKS) {
    if (check.excludeFromPriority) continue;
    const c = countsForCheck(analysis, check.id);
    const denom = c.pass + c.fail;
    const failPct = denom > 0 ? Math.round((c.fail / denom) * 100) : null;
    const sevFactor = severityFactor(check.severity);
    let priority = 0;
    let note = "";
    if (failPct === null) {
      note = "No applicable pages on this site.";
    } else {
      priority = clamp(0, 100, Math.round(failPct * sevFactor));
    }
    rows.push({
      checkId: check.id,
      sourceId: check.sourceId,
      title: check.title,
      severity: check.severity,
      severityFactor: sevFactor,
      priorityProblem: check.priorityProblem,
      minimalFix: check.minimalFix,
      passCount: c.pass,
      failCount: c.fail,
      needsReviewCount: c.needs,
      naCount: c.na,
      failPct,
      priority,
      bucket: bucketForPriority(priority),
      note
    });
  }
  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const af = a.failPct ?? -1;
    const bf = b.failPct ?? -1;
    if (bf !== af) return bf - af;
    return a.checkId.localeCompare(b.checkId);
  });
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/priority.test.mjs 2>&1 | tail -20`

Expected: all 9 priority tests pass.

- [ ] **Step 5: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 6: Commit**

```bash
git add lib/priority.mjs tests/priority.test.mjs
git commit -m "$(cat <<'EOF'
Add lib/priority.mjs with failPct x severity formula

Computes priority rows from analysis verdicts: failPct over PASS+FAIL
denominator, severity factor (1.0/0.85/0.7/0.5), clamp 0-100, sorted
by priority desc with stable tiebreak. AIVB-029 is excluded via the
excludeFromPriority flag on the check definition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Priority report HTML renderer

**Files:**
- Create: `lib/priority-report-html.mjs`
- Test: `tests/priority-report.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/priority-report.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPriorityReportHtml } from "../lib/priority-report-html.mjs";

function row(over = {}) {
  return {
    checkId: "AIVB-001",
    sourceId: "S001",
    title: "HTTP success and clean access",
    severity: "Critical",
    severityFactor: 1.0,
    priorityProblem: "Page returns 4xx/5xx; bots skip it.",
    minimalFix: "Fix server config.",
    passCount: 0,
    failCount: 10,
    needsReviewCount: 0,
    naCount: 0,
    failPct: 100,
    priority: 100,
    bucket: "HIGH",
    note: "",
    ...over
  };
}

const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

test("HTML contains the domain in title and h1", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 10, totalUrls: 100, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /<title>AI Visibility fix-priority — example\.com<\/title>/);
  assert.match(html, /<h1>AI Visibility fix-priority — example\.com<\/h1>/);
});

test("HTML contains a bucket divider for every transition", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ priority: 100, bucket: "HIGH" }), row({ checkId: "AIVB-008", priority: 30, bucket: "MEDIUM" }), row({ checkId: "AIVB-022", priority: 10, bucket: "LOW" }), row({ checkId: "AIVB-002", priority: 0, bucket: "NONE" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /HIGH PRIORITY/);
  assert.match(html, /MEDIUM PRIORITY/);
  assert.match(html, /LOW PRIORITY/);
  assert.match(html, /NO PROBLEM/);
});

test("HTML contains 'What's wrong' and 'What to fix' for rows with failPct >= 5", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: 67, priority: 57, bucket: "HIGH" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /What.s wrong/);
  assert.match(html, /What to fix/);
});

test("HTML uses 'Not worth fixing' phrasing for failPct < 5", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: 2, priority: 0, bucket: "NONE" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /Not worth fixing/);
});

test("HTML uses 'No applicable pages' phrasing for failPct === null", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: null, priority: 0, bucket: "NONE", note: "No applicable pages on this site." })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /No applicable pages/);
});

test("HTML mentions AIVB-029 as excluded in the footer", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /AIVB-029/);
  assert.match(html, /Core Web Vitals/i);
  assert.match(html, /excluded/i);
});

test("HTML contains no Cyrillic characters anywhere", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row(), row({ checkId: "AIVB-019", priority: 100 })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.ok(!CYRILLIC.test(html), "HTML contains Cyrillic");
});

test("HTML warns when --thorough was not used", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 5, thorough: false },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /not LLM-resolved|--thorough/i);
});

test("HTML escapes <, >, and & in user-supplied text", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ title: "Title with <tag> & ampersand" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /Title with &lt;tag&gt; &amp; ampersand/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/priority-report.test.mjs 2>&1 | tail -20`

Expected: all 9 tests fail with module-not-found.

- [ ] **Step 3: Write the renderer**

Create `lib/priority-report-html.mjs`:

```javascript
const BUCKET_STYLE = {
  HIGH:   { bg: "#fdecea", color: "#8b1a16", label: "HIGH PRIORITY — fix first" },
  MEDIUM: { bg: "#fff8e0", color: "#8a6d10", label: "MEDIUM PRIORITY" },
  LOW:    { bg: "#f3fbf6", color: "#1d6f42", label: "LOW PRIORITY" },
  NONE:   { bg: "#fafafa", color: "#888",    label: "NO PROBLEM — nothing to fix here" }
};

const SEVERITY_LABEL = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whyCell(row) {
  if (row.failPct === null) {
    return `<strong>No applicable pages on this site.</strong>`;
  }
  if (row.failPct < 5) {
    return `<strong>Not worth fixing</strong> — only ${row.failPct}% of pages have this issue.`;
  }
  return `<strong>What's wrong:</strong> ${escapeHtml(row.priorityProblem)}<br/><strong>What to fix:</strong> ${escapeHtml(row.minimalFix)}`;
}

function failPctCell(row) {
  if (row.failPct === null) return `<span title="No applicable pages">N/A</span>`;
  const cls = row.failPct >= 60 ? "fail-high" : row.failPct >= 25 ? "fail-mid" : "fail-low";
  return `<span class="${cls}">${row.failPct}%</span>`;
}

function renderRow(row) {
  const style = BUCKET_STYLE[row.bucket] || BUCKET_STYLE.NONE;
  const scoreTip = `Priority ${row.priority} (${row.failPct === null ? "no data" : `${row.failPct}% of pages fail`} × severity ${row.severityFactor.toFixed(2)})`;
  const ruleTip = `${row.title} (provenance: ${row.sourceId})`;
  return `<tr style="background:${style.bg}">
  <td class="score-cell" title="${escapeHtml(scoreTip)}"><span class="bucket-tag" style="background:${style.bg};color:${style.color};border:1px solid ${style.color}33;">${row.priority}</span></td>
  <td class="cid" title="${escapeHtml(ruleTip)}">${escapeHtml(row.checkId)}</td>
  <td>${escapeHtml(SEVERITY_LABEL[row.severity] || row.severity)}</td>
  <td class="rule" title="${escapeHtml(ruleTip)}">${escapeHtml(row.title)}</td>
  <td class="num">${failPctCell(row)}${row.needsReviewCount ? ` <span class="needs-review" title="Verdicts that remained NEEDS_REVIEW">(+${row.needsReviewCount} unresolved)</span>` : ""}</td>
  <td class="rule-full">${whyCell(row)}</td>
</tr>`;
}

function renderDivider(bucket, colspan) {
  const style = BUCKET_STYLE[bucket];
  const icon = bucket === "HIGH" ? "🔴" : bucket === "MEDIUM" ? "🟡" : bucket === "LOW" ? "🟢" : "⚪";
  return `<tr class="section-divider"><td colspan="${colspan}">${icon} ${style.label}</td></tr>`;
}

function renderRowsWithDividers(rows) {
  const colspan = 6;
  let out = "";
  let last = "";
  for (const row of rows) {
    if (row.bucket !== last) {
      out += renderDivider(row.bucket, colspan);
      last = row.bucket;
    }
    out += renderRow(row);
  }
  return out;
}

function renderCoverageWarning(coverage) {
  if (coverage.thorough) {
    if (coverage.residualNeedsReview > 0) {
      return `<p>${coverage.residualNeedsReview} verdicts remained NEEDS_REVIEW after the --thorough pass; they are excluded from the priority denominator.</p>`;
    }
    return `<p>Analysis was run with --thorough; all heuristic NEEDS_REVIEW verdicts were resolved by the page auditor.</p>`;
  }
  return `<p><strong>Heads up:</strong> the underlying analysis was not LLM-resolved (--thorough not used). Priority scores for heuristic and needs-claude-review checks are likely understated. Run <code>/aiv-analyze ${escapeHtml(coverage.domain || "<domain>")} --thorough</code> and regenerate the report.</p>`;
}

export function buildPriorityReportHtml({ domain, rows, coverage, plugin }) {
  const generatedAt = new Date().toISOString();
  const cov = { ...coverage, domain };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AI Visibility fix-priority — ${escapeHtml(domain)}</title>
<style>
body { font: 13px/1.45 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #111; background: #fafafa; }
h1 { margin: 0 0 4px; }
.summary-box { background: #fff; border: 1px solid #e3e3e3; border-radius: 6px; padding: 14px 16px; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-size: 12px; background: #fff; }
th, td { padding: 7px 8px; border-bottom: 1px solid #ececec; vertical-align: top; }
th { background: #f6f6f6; text-align: left; position: sticky; top: 0; z-index: 5; }
td.cid { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; white-space: nowrap; cursor: help; font-weight: 600; }
td.rule { max-width: 480px; cursor: help; word-wrap: break-word; }
td.rule-full { max-width: 420px; word-wrap: break-word; line-height: 1.45; font-size: 12px; color: #333; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.score-cell { text-align: center; font-weight: 700; font-size: 16px; cursor: help; }
.bucket-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; min-width: 60px; text-align: center; }
.section-divider td { background: linear-gradient(to right, #ddd, #fafafa); padding: 4px 8px; font-size: 11px; color: #666; font-weight: 600; }
.fail-low { color: #1d6f42; }
.fail-mid { color: #b3711a; }
.fail-high { color: #8b1a16; font-weight: 600; }
.needs-review { color: #8a6d10; font-size: 10px; }
code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
</style>
</head>
<body>
<h1>AI Visibility fix-priority — ${escapeHtml(domain)}</h1>
<div class="summary-box">
  <strong>How to read this table:</strong> top rows are the most important fixes; bottom rows are checks where the problem barely exists. Row background tracks priority (red → yellow → green → gray). The <strong>PRIORITY</strong> column is a 0-100 importance score. Severity and Priority scales are explained below the table.
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
${renderRowsWithDividers(rows)}
</tbody>
</table>

<div class="summary-box" style="margin-top:24px;">
<h3 style="margin:0 0 8px 0;">What "Severity" means</h3>
<p>The intrinsic criticality of the check, regardless of whether your site fails it.</p>
<ul>
  <li><strong>Critical</strong> — without this the page cannot enter the index or AI answers at all.</li>
  <li><strong>High</strong> — strongly reduces AI citation likelihood.</li>
  <li><strong>Medium</strong> — noticeably hurts quality but does not block.</li>
  <li><strong>Low</strong> — minor hygiene.</li>
</ul>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">What "Priority" means</h3>
<p>Score from 0 to 100 = how much you should fix this check on this site. Combines two factors:</p>
<ol>
  <li>What share of your pages currently fail the check.</li>
  <li>Severity of the check itself (Critical weighs more than Low).</li>
</ol>
<p>Bucketing:</p>
<ul>
  <li><strong style="color:#8b1a16">🔴 HIGH (50-100)</strong> — high-severity check failing on a lot of pages. Fix first.</li>
  <li><strong style="color:#8a6d10">🟡 MEDIUM (20-49)</strong> — real problem, lower severity or smaller footprint.</li>
  <li><strong style="color:#1d6f42">🟢 LOW (5-19)</strong> — background hygiene.</li>
  <li><strong style="color:#666">⚪ NONE (&lt;5)</strong> — nothing meaningful to fix.</li>
</ul>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">Checks excluded from priority computation</h3>
<p>AIVB-029 (Core Web Vitals) is excluded because it requires a third-party performance data source the plugin does not call. Run PageSpeed Insights or CrUX separately to evaluate this check.</p>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">Coverage</h3>
<p>Analyzed ${cov.pagesAnalyzed} pages from a crawl of ${cov.totalUrls} URLs.</p>
${renderCoverageWarning(cov)}
<p style="margin-top:8px;font-size:11px;color:#666">Generated ${escapeHtml(generatedAt)} by ${escapeHtml(plugin.name)} v${escapeHtml(plugin.version)}.</p>
</div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/priority-report.test.mjs 2>&1 | tail -20`

Expected: all 9 tests pass.

- [ ] **Step 5: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 6: Commit**

```bash
git add lib/priority-report-html.mjs tests/priority-report.test.mjs
git commit -m "$(cat <<'EOF'
Add lib/priority-report-html.mjs renderer

Pure-function renderer that takes priority rows + coverage metadata
and emits a self-contained English HTML page with bucket dividers,
What's wrong / What to fix cells, severity and priority explainers,
and a coverage warning when --thorough was not used.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Judge module (lib/judge.mjs) with injected invoker

**Files:**
- Create: `lib/judge.mjs`
- Test: `tests/judge.test.mjs`

The judge module exposes `judgeAnalysis({ analysis, snapshots, invoke })`. The `invoke` callback is the seam where the CLI wires the real Claude Code Task tool (or a stub in tests). This keeps the judge module unit-testable.

- [ ] **Step 1: Write the failing tests**

Create `tests/judge.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeAnalysis } from "../lib/judge.mjs";

function pageVerdicts(checkValues) {
  return Object.entries(checkValues).map(([checkId, value]) => ({
    checkId,
    sourceId: checkId.replace("AIVB-", "S"),
    severity: "Medium",
    value,
    evidence: "heuristic evidence"
  }));
}

test("judgeAnalysis upgrades NEEDS_REVIEW to PASS/FAIL using invoke return value", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-001": "PASS" }) },
      { url: "https://x/2", hash: "h2", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-001": "PASS" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" }, h2: { url: "https://x/2" } };
  const calls = [];
  const invoke = async ({ pageUrl, checkId }) => {
    calls.push({ pageUrl, checkId });
    return { value: "FAIL", evidence: "judge says fail", confidence: 0.9 };
  };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(result.judged, 2);
  assert.equal(result.unchanged, 0);
  assert.equal(calls.length, 2);
  for (const page of result.analysis.verdicts) {
    const v = page.verdicts.find((x) => x.checkId === "AIVB-012");
    assert.equal(v.value, "FAIL");
    assert.equal(v.judgedBy, "aiv-page-auditor");
    assert.equal(v.evidence, "judge says fail");
  }
});

test("judgeAnalysis preserves NEEDS_REVIEW when invoke throws", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  const invoke = async () => { throw new Error("agent unavailable"); };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  const v = result.analysis.verdicts[0].verdicts[0];
  assert.equal(v.value, "NEEDS_REVIEW");
  assert.match(v.evidence, /agent unavailable|judge failed/);
  assert.equal(result.failed, 1);
});

test("judgeAnalysis does not call invoke for PASS/FAIL/N/A verdicts", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-001": "PASS", "AIVB-002": "FAIL", "AIVB-003": "N/A" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  let calls = 0;
  const invoke = async () => { calls += 1; return { value: "PASS", evidence: "x" }; };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(calls, 0);
  assert.equal(result.judged, 0);
});

test("judgeAnalysis returns residualNeedsReview count for the coverage block", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-013": "NEEDS_REVIEW" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  // Judge resolves AIVB-012 but not AIVB-013 (returns null).
  const invoke = async ({ checkId }) => {
    if (checkId === "AIVB-012") return { value: "PASS", evidence: "ok" };
    return null;
  };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(result.judged, 1);
  assert.equal(result.residualNeedsReview, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/judge.test.mjs 2>&1 | tail -20`

Expected: all 4 tests fail with module-not-found.

- [ ] **Step 3: Write the judge module**

Create `lib/judge.mjs`:

```javascript
export async function judgeAnalysis({ analysis, snapshots = {}, invoke, onProgress }) {
  let judged = 0;
  let failed = 0;
  let unchanged = 0;
  let residualNeedsReview = 0;
  const cloned = {
    ...analysis,
    verdicts: (analysis.verdicts || []).map((page) => ({
      ...page,
      verdicts: page.verdicts.map((v) => ({ ...v }))
    }))
  };
  for (const page of cloned.verdicts) {
    const snapshot = snapshots[page.hash] || null;
    for (const v of page.verdicts) {
      if (v.value !== "NEEDS_REVIEW") continue;
      try {
        if (typeof onProgress === "function") {
          onProgress({ pageUrl: page.url, checkId: v.checkId });
        }
        const result = await invoke({
          pageUrl: page.url,
          checkId: v.checkId,
          sourceId: v.sourceId,
          severity: v.severity,
          heuristicEvidence: v.evidence,
          snapshot
        });
        if (!result || !result.value || result.value === "NEEDS_REVIEW") {
          residualNeedsReview += 1;
          unchanged += 1;
          v.judgedBy = "aiv-page-auditor";
          v.evidence = result?.evidence || `${v.evidence} (judge inconclusive)`;
          continue;
        }
        v.value = result.value;
        v.evidence = result.evidence || v.evidence;
        v.judgedBy = "aiv-page-auditor";
        if (typeof result.confidence === "number") v.confidence = result.confidence;
        judged += 1;
      } catch (err) {
        failed += 1;
        residualNeedsReview += 1;
        v.evidence = `judge failed: ${err.message}`;
      }
    }
  }
  return { analysis: cloned, judged, failed, unchanged, residualNeedsReview };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/judge.test.mjs 2>&1 | tail -20`

Expected: all 4 judge tests pass.

- [ ] **Step 5: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 6: Commit**

```bash
git add lib/judge.mjs tests/judge.test.mjs
git commit -m "$(cat <<'EOF'
Add lib/judge.mjs for --thorough verdict resolution

Pure-function judge module that walks an analysis's NEEDS_REVIEW
verdicts and applies an injected invoke callback (in production the
aiv-page-auditor subagent; in tests a stub). Preserves NEEDS_REVIEW
and records the failure reason when the agent is unavailable or
returns no decision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Wire /aiv-priority subcommand into bin/aiv.mjs

**Files:**
- Modify: `bin/aiv.mjs`
- Modify: `lib/storage.mjs` (add `writeReportNamed` helper)
- Test: `tests/cli.test.mjs` (smoke test added later)

- [ ] **Step 1: Add a writeReportNamed helper in lib/storage.mjs**

Append to `lib/storage.mjs`:

```javascript
export async function writeReportNamed(root, domain, suffix, content, format = "md") {
  await ensureRoot(root);
  const id = nowStamp();
  const filePath = path.join(root, "reports", `${id}-${normalizeDomain(domain)}-${suffix}.${format}`);
  await fs.writeFile(filePath, content);
  return filePath;
}
```

- [ ] **Step 2: Add cmdPriority to bin/aiv.mjs**

Add the following near `cmdReport` in `bin/aiv.mjs`:

```javascript
import { computePriorityRows } from "../lib/priority.mjs";
import { buildPriorityReportHtml } from "../lib/priority-report-html.mjs";
import { writeReportNamed } from "../lib/storage.mjs";

async function cmdPriority(positional, flags) {
  const target = normalizeDomain(positional[0]);
  if (!target) exitErr("priority requires a target domain");
  const root = resolveArtifactsDir(flags.artifacts);
  const analysis = await readLatestAnalysis(root, target);
  if (!analysis) exitErr(`no analysis artifacts for ${target}; run /aiv-analyze first`);
  const crawlData = await readLatestCrawl(root, target);

  const rows = computePriorityRows({ verdicts: analysis.verdicts });
  const residualNeedsReview = analysis.verdicts.reduce((sum, page) =>
    sum + page.verdicts.filter((v) => v.value === "NEEDS_REVIEW").length, 0);
  const thorough = analysis.input?.args?.thorough === true || analysis.input?.args?.thorough === "true";
  const coverage = {
    pagesAnalyzed: analysis.verdicts.length,
    totalUrls: crawlData?.urls?.length ?? analysis.verdicts.length,
    residualNeedsReview,
    thorough
  };
  const html = buildPriorityReportHtml({ domain: target, rows, coverage, plugin: PLUGIN });
  const htmlPath = await writeReportNamed(root, target, "priority", html, "html");

  const jsonPayload = {
    domain: target,
    generatedAt: new Date().toISOString(),
    plugin: PLUGIN,
    coverage,
    rows
  };
  const jsonPath = await writeReportNamed(root, target, "priority", `${JSON.stringify(jsonPayload, null, 2)}\n`, "json");

  process.stdout.write(`Priority report written: ${htmlPath}\n`);
  process.stdout.write(`Priority JSON written:   ${jsonPath}\n`);
  process.stdout.write(`- Rows: ${rows.length}\n`);
  const byBucket = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  for (const r of rows) byBucket[r.bucket] += 1;
  process.stdout.write(`- Buckets: HIGH=${byBucket.HIGH}, MEDIUM=${byBucket.MEDIUM}, LOW=${byBucket.LOW}, NONE=${byBucket.NONE}\n`);
  if (!thorough && residualNeedsReview > 0) {
    process.stdout.write(`- Warning: analysis was not run with --thorough; ${residualNeedsReview} verdict(s) remained NEEDS_REVIEW and are excluded from priority denominator.\n`);
  }
}
```

In the `switch (subcommand)` block (line ~365), add the case before the default:

```javascript
case "priority":
  return cmdPriority(positional, flags);
```

Also update the usage line in the default case:

```javascript
process.stderr.write(`usage: aiv <checklist|doctor|crawl|analyze|add-competitor|compare|report|status|priority> [options]\n`);
```

- [ ] **Step 3: Smoke-test the new command manually**

Run: `node bin/aiv.mjs priority 2>&1 | head -5`

Expected: `error: priority requires a target domain` and exit code 1.

Run: `node bin/aiv.mjs priority fixture.local --artifacts /tmp/aiv-nonexistent 2>&1 | head -5`

Expected: `error: no analysis artifacts for fixture.local; run /aiv-analyze first`.

- [ ] **Step 4: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 5: Commit**

```bash
git add bin/aiv.mjs lib/storage.mjs
git commit -m "$(cat <<'EOF'
Wire /aiv-priority subcommand into the CLI

Adds cmdPriority that reads the latest analysis, computes priority
rows, renders priority-report.html + priority.json under
.ai-visibility/reports/, and prints a bucket summary. Reads
analysis.input.args.thorough to decide whether to warn about
unresolved NEEDS_REVIEW.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Wire --thorough flag into /aiv-analyze

**Files:**
- Modify: `bin/aiv.mjs` (`cmdAnalyze`)

The implementation here cannot truly call the Claude Code Task tool from Node — the CLI runs in a child process spawned by Claude Code. The skill-driven flow is: the user-facing `/aiv-analyze` slash command invokes `aiv-page-auditor` from Claude Code itself, and the resolved verdicts are written back via the agent's Write tool.

For the CLI side, we add the `--thorough` flag plumbing that:
1. Records `args: { thorough: true }` on the input.json so /aiv-priority knows the analysis was run with it.
2. Writes an additional `needs-review-queue.json` under the analysis directory listing every `(pageHash, checkId)` pair that needs the page auditor's attention.

The `commands/aiv-analyze.md` change (Task 14) wires the slash-command-level loop where Claude reads the queue file and invokes the agent.

- [ ] **Step 1: Update cmdAnalyze to record `--thorough` and emit the queue file**

In `bin/aiv.mjs`, in `cmdAnalyze` near the end (after `writeAnalysis`), add:

```javascript
const thorough = flags.thorough === true || flags.thorough === "true";
if (thorough) {
  const queue = [];
  for (const page of verdicts) {
    for (const v of page.verdicts) {
      if (v.value === "NEEDS_REVIEW") {
        queue.push({ url: page.url, hash: page.hash, checkId: v.checkId, sourceId: v.sourceId, heuristicEvidence: v.evidence });
      }
    }
  }
  const queuePath = path.join(root, "sites", domain, "analyses", id, "needs-review-queue.json");
  await fs.writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
  process.stdout.write(`- --thorough: ${queue.length} verdict(s) queued for aiv-page-auditor in ${queuePath}\n`);
}
```

Also update the `input` object passed to `writeAnalysis` so `args` includes `thorough`. The current line is:

```javascript
input: { target: domain, args: flags, runId: crawlData.runId, urls: selected.map((s) => s.url) },
```

That already passes the full `flags` object, which includes `thorough`. Verify by reading the test.

- [ ] **Step 2: Add a CLI smoke test for the queue file**

Append to `tests/cli.test.mjs` (the existing end-to-end smoke test) the following — find the existing `node bin/aiv.mjs analyze fixture.local --all` invocation and add a separate test below that runs `analyze --all --thorough` and asserts the queue file exists.

If the existing cli.test.mjs already has a fixture site flow, add this test at the end:

```javascript
test("/aiv-analyze --thorough writes needs-review-queue.json", async () => {
  const out = path.join(os.tmpdir(), `aiv-thorough-${Date.now()}`);
  try {
    await execFile("node", ["bin/aiv.mjs", "crawl", "tests/fixtures/site", "--limit", "5", "--out", out]);
    await execFile("node", ["bin/aiv.mjs", "analyze", "fixture.local", "--all", "--thorough", "--artifacts", out]);
    const analysesDir = path.join(out, "sites", "fixture.local", "analyses");
    const ids = (await fs.readdir(analysesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const last = ids[ids.length - 1];
    const queuePath = path.join(analysesDir, last, "needs-review-queue.json");
    const raw = await fs.readFile(queuePath, "utf8");
    const queue = JSON.parse(raw);
    assert.ok(Array.isArray(queue), "queue should be an array");
  } finally {
    await fs.rm(out, { recursive: true, force: true });
  }
});
```

If `tests/cli.test.mjs` uses a different invocation style, mirror that style. Read the file first.

- [ ] **Step 3: Run the test to confirm pass**

Run: `node --test tests/cli.test.mjs 2>&1 | tail -20`

Expected: all CLI tests including the new `--thorough` test pass.

- [ ] **Step 4: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 5: Commit**

```bash
git add bin/aiv.mjs tests/cli.test.mjs
git commit -m "$(cat <<'EOF'
Wire --thorough flag into /aiv-analyze (CLI plumbing)

Records --thorough in input.json args so /aiv-priority knows the
analysis is judge-resolved, and emits needs-review-queue.json with
the (url, hash, checkId) tuples for the slash-command loop to feed
into the aiv-page-auditor agent. The actual subagent invocation
lives in commands/aiv-analyze.md (next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: New /aiv-priority command frontmatter

**Files:**
- Create: `commands/aiv-priority.md`

- [ ] **Step 1: Write commands/aiv-priority.md**

Create `commands/aiv-priority.md`:

```markdown
---
description: Generate a single-site priority HTML report from the latest analysis.
argument-hint: "<domain> [--run-id ID] [--artifacts DIR]"
allowed-tools: Bash, Read
---

Compute the AI Visibility fix-priority for the latest analysis of the
domain and write a self-contained HTML report.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs priority $ARGUMENTS
```

2. Summarize for the user:
   - the path to `priority.html` and `priority.json`;
   - the HIGH / MEDIUM / LOW / NONE bucket counts;
   - whether the analysis was run with `--thorough` (if not, recommend
     re-running `/aiv-analyze <domain> --thorough` and then `/aiv-priority`).

3. Recommend the next step using the namespaced command form:
   - `/ai-visibility-booster:aiv-analyze <domain> --thorough` if the
     analysis was heuristic-only.
   - Open `priority.html` in a browser to review the rows.

Rules:
- The priority report is single-site; do not pull in competitor data.
- Use `AIVB-xxx` public IDs in everything you show the user.
- Do not promise AI ranking outcomes.
- Do not call any external service.
```

- [ ] **Step 2: Verify plugin-structure test still passes**

Run: `node --test tests/plugin-structure.test.mjs 2>&1 | tail -20`

Expected: all plugin structure tests pass (the new command is discovered automatically by the test that scans `commands/*.md`).

- [ ] **Step 3: Run language test (no Cyrillic in the new file)**

Run: `node --test tests/language.test.mjs 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 4: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 5: Commit**

```bash
git add commands/aiv-priority.md
git commit -m "$(cat <<'EOF'
Add /aiv-priority slash command

User-facing entry point that runs the priority CLI and summarizes
the bucket counts. Recommends re-running /aiv-analyze --thorough
when the underlying analysis was heuristic-only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Update /aiv-analyze to drive aiv-page-auditor when --thorough is set

**Files:**
- Modify: `commands/aiv-analyze.md`

- [ ] **Step 1: Rewrite commands/aiv-analyze.md to handle --thorough**

Replace `commands/aiv-analyze.md` entirely with:

```markdown
---
description: Analyze selected pages against the 36 AIVB checks; --thorough resolves NEEDS_REVIEW via aiv-page-auditor.
argument-hint: "<domain> [--random N --seed N] [--all] [--urls csv] [--run-id ID] [--thorough]"
allowed-tools: Bash, Read, Write, Task
---

Run the 36 `AIVB-001`..`AIVB-036` evaluators on the selected pages and save
verdicts under `./.ai-visibility/sites/<domain>/analyses/<timestamp>/`.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs analyze $ARGUMENTS
```

2. Read `verdicts.json`, `summary.json`, and `check-matrix.json` from the
   reported analysis directory. Always use the public `AIVB-xxx` IDs in
   anything you show the user.

3. Summarize:
   - pages analyzed;
   - average score and bucket distribution;
   - top failed checks (with `AIVB-xxx`, severity, fail count);
   - top NEEDS_REVIEW items.

4. **If `--thorough` was passed**:
   a. Read `needs-review-queue.json` from the analysis directory.
   b. For each `{url, hash, checkId, heuristicEvidence}` entry:
      - Read the corresponding page snapshot from
        `crawl-runs/<runId>/pages/<hash>.json`.
      - Invoke the `aiv-page-auditor` subagent with the snapshot, the
        check definition, and the heuristic evidence.
      - Apply the returned `{value, evidence, confidence}` patch to the
        in-memory verdicts.
   c. Write the patched verdicts back to `verdicts.json` (preserve the
      original heuristic verdict under `heuristicValue` / `heuristicEvidence`
      on each judged entry; set `value` and `evidence` to the judge's
      values; set `judgedBy: "aiv-page-auditor"`).
   d. Recompute `summary.json` and `check-matrix.json` from the patched
      verdicts and overwrite them.

5. Recommend the next step using the namespaced command form:
   - `/ai-visibility-booster:aiv-priority <domain>` to generate the
     single-site priority HTML report.
   - `/ai-visibility-booster:aiv-report <domain>` for the Markdown report.

Rules:
- Never recommend rewriting page content.
- Never present `Sxxx` as a primary public ID.
- Never claim PASS for a check without quoting evidence from the artifact.
- When `--thorough` is used, the judge is the page auditor subagent;
  do not call any external LLM or service.
```

- [ ] **Step 2: Run language and plugin-structure tests**

Run: `node --test tests/language.test.mjs tests/plugin-structure.test.mjs 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 3: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 4: Commit**

```bash
git add commands/aiv-analyze.md
git commit -m "$(cat <<'EOF'
Document --thorough and the aiv-page-auditor loop in /aiv-analyze

Adds Task as an allowed tool, describes how the slash command reads
the needs-review-queue and drives the page auditor subagent to
resolve NEEDS_REVIEW verdicts, and updates the next-step
recommendation to point at /aiv-priority.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update docs (spec.md and source-research.md)

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/source-research.md`

- [ ] **Step 1: Update docs/spec.md**

In `docs/spec.md`, update the commands table (section 4) to add a row for `/aiv-priority` and update the `/aiv-analyze` row to mention `--thorough`. The minimal patch (add after the `/aiv-report` row):

```
| `/aiv-priority <target-domain> [opts]` | Generate the single-site priority HTML+JSON report. |
```

Update the `/aiv-analyze` row to:

```
| `/aiv-analyze <domain> [opts]` | Analyze selected pages against the 36 `AIVB-xxx` checks. With `--thorough`, resolve NEEDS_REVIEW via the `aiv-page-auditor` subagent. |
```

Add a new section after section 8 (Scoring):

```
## 8a. Priority scoring (/aiv-priority)

The priority report uses a separate single-axis score:

```
fail_pct(c)        = 100 * count(verdict == FAIL on c) /
                     count(verdict in {PASS, FAIL} on c)
severity_factor(c) = Critical 1.0 | High 0.85 | Medium 0.7 | Low 0.5
priority(c)        = clamp(0, 100, fail_pct(c) * severity_factor(c))
```

NEEDS_REVIEW and N/A verdicts are excluded from the denominator. AIVB-029
(Core Web Vitals) is excluded entirely from the priority report because it
requires PageSpeed Insights or CrUX data the plugin does not call.

Buckets: HIGH ≥ 50, MEDIUM 20-49, LOW 5-19, NONE < 5.

This is a single-site signal. The report does not include competitor
columns; competitor comparison lives in /aiv-compare and /aiv-report.
```

Update output formats section to mention HTML output for the priority report.

- [ ] **Step 2: Update docs/source-research.md**

Append a new section to `docs/source-research.md`:

```
## Detector corrections (post-launch)

After comparing plugin verdicts against an LLM-judged baseline on a real
site, five detectors were corrected to remove systematic false positives
and false negatives. The public IDs and source IDs are unchanged; only
the evaluation strategy moved.

| Public ID | Source ID | Old mode | New behaviour |
|---|---|---|---|
| AIVB-012 | S037 | needs-claude-review | Page-type classifier returns N/A on service/industry/legal/corporate landing pages; NEEDS_REVIEW only on expertise-sensitive page types (article/case/event) without a byline. |
| AIVB-019 | S047 | heuristic (FAIL on missing alt of any "meaningful" image) | Now counts every in-body img >= 96x96 outside nav/header/footer; reports missing-alt percentage. FAILs at >= 10% missing alt. |
| AIVB-029 | S060 | needs-claude-review | Marked `excludeFromPriority: true`; reported in /aiv-analyze but not in /aiv-priority because Core Web Vitals require PSI/CrUX. |
| AIVB-030 | S061 | heuristic (FAIL on any fixed-position cookie banner) | Demoted to needs-claude-review. Heuristic only records the candidate; judge decides whether the overlay actually blocks main content. |
| AIVB-034 | S066 | deterministic (FAIL on lang=en-us without hreflang) | Detects site-level multilingual signal (any hreflang link anywhere in the crawl, or two distinct language path segments) before failing. Single-language sites return N/A. |
| AIVB-035 | S067 | deterministic (string compare title/H1/og/schema) | Demoted to needs-claude-review. Heuristic records the divergence; judge decides whether marketing title + short H1 are semantically aligned. |
```

- [ ] **Step 3: Run language test**

Run: `node --test tests/language.test.mjs 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 4: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 5: Commit**

```bash
git add docs/spec.md docs/source-research.md
git commit -m "$(cat <<'EOF'
Document /aiv-priority, --thorough, and the 5 detector corrections

Adds priority scoring section to the spec, lists the new commands,
and documents the detector corrections (AIVB-012/019/030/034/035
modes + AIVB-029 priority exclusion) in source-research.md so the
provenance trail stays auditable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: End-to-end smoke

**Files:**
- Test: `tests/cli.test.mjs` (verify /aiv-priority on fixture site)

- [ ] **Step 1: Add an end-to-end test that runs the full pipeline on the fixture site**

Append to `tests/cli.test.mjs`:

```javascript
test("end-to-end: crawl fixture -> analyze --all -> priority writes priority.html and priority.json", async () => {
  const out = path.join(os.tmpdir(), `aiv-e2e-${Date.now()}`);
  try {
    await execFile("node", ["bin/aiv.mjs", "crawl", "tests/fixtures/site", "--limit", "5", "--out", out]);
    await execFile("node", ["bin/aiv.mjs", "analyze", "fixture.local", "--all", "--artifacts", out]);
    const { stdout } = await execFile("node", ["bin/aiv.mjs", "priority", "fixture.local", "--artifacts", out]);
    assert.match(stdout, /Priority report written:.*priority\.html/);
    assert.match(stdout, /Priority JSON written:.*priority\.json/);
    assert.match(stdout, /Rows: 35/); // 36 - AIVB-029 excluded
    assert.match(stdout, /Buckets:/);
    const reportsDir = path.join(out, "reports");
    const files = await fs.readdir(reportsDir);
    assert.ok(files.some((f) => f.endsWith("-priority.html")), `expected priority.html in ${files.join(",")}`);
    assert.ok(files.some((f) => f.endsWith("-priority.json")), `expected priority.json in ${files.join(",")}`);
  } finally {
    await fs.rm(out, { recursive: true, force: true });
  }
});
```

(Adjust imports — `os`, `path`, `fs/promises`, `execFile` from `node:child_process` promisified — to match the existing patterns in `tests/cli.test.mjs`.)

- [ ] **Step 2: Run the test**

Run: `node --test tests/cli.test.mjs 2>&1 | tail -20`

Expected: end-to-end test passes.

- [ ] **Step 3: Run full suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -10`

Expected: zero fails.

- [ ] **Step 4: Manually inspect a generated priority.html**

Run: `node bin/aiv.mjs crawl tests/fixtures/site --limit 5 --out /tmp/aiv-inspect && node bin/aiv.mjs analyze fixture.local --all --artifacts /tmp/aiv-inspect && node bin/aiv.mjs priority fixture.local --artifacts /tmp/aiv-inspect && ls /tmp/aiv-inspect/reports/`

Expected: directory listing shows `<ts>-fixture.local-priority.html` and `<ts>-fixture.local-priority.json`.

- [ ] **Step 5: Commit**

```bash
git add tests/cli.test.mjs
git commit -m "$(cat <<'EOF'
Add end-to-end smoke for crawl -> analyze -> priority pipeline

Exercises the full happy path on the fixture site and asserts the
expected output files and stdout summary. Confirms 35-row count
(36 minus AIVB-029 which is excluded from priority).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

After completing all 16 tasks, the implementation engineer should:

1. Run `node --test tests/*.test.mjs` — expect 70 baseline + new tests, zero fails.
2. Run `node bin/aiv.mjs doctor` — expect Doctor: OK.
3. Run `node bin/aiv.mjs checklist` — expect 36 lines.
4. Run the manual smoke from Task 16, Step 4.
5. Open `priority.html` in a browser to visually verify the rendering matches the spec's Section 7 layout.

## Verification

Spec coverage check — each spec section maps to a task:

- Spec Section 3 (PRIORITY formula): Task 8 (computePriorityRows + tests).
- Spec Section 4 (Input pipeline / --thorough): Tasks 10, 12, 14.
- Spec Section 5 (Detector corrections): Tasks 3, 4, 5, 6, 7.
- Spec Section 6 (priorityProblem field): Task 1.
- Spec Section 7 (HTML report): Task 9, Task 11.
- Spec Section 8 (File map): all tasks taken together.
- Spec Section 9 (E2E UX): Tasks 11, 13, 14, 16.
- Spec Section 10 (Non-goals): enforced by reuse of existing modules; no external network in priority.mjs / priority-report-html.mjs / judge.mjs.
- Spec Section 11 (Acceptance): Task 16 (smoke) + the per-task unit tests.

No placeholders remain. Every step contains the full code or command.
