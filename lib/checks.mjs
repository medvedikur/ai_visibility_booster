// 36 BASIC AI Visibility checks. Public IDs are AIVB-001..AIVB-036.
// Source IDs (Sxxx) are stored only as provenance metadata.
// See docs/source-research.md for the canonical mapping rationale.

const SOURCE_REPO = "medvedikur/a1qa_com_ai_visibility";
const SOURCE_FILES = [
  "lib/checklist/scope.ts",
  "scripts/run_basic_lite.mjs",
  "ai_visibility_methodology_ru_en.md"
];

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

export const CHECKS = [
  check({
    publicNumber: 1,
    sourceId: "S001",
    title: "HTTP success and clean access",
    description: "Page returns a successful HTTP status (2xx, or a permanent redirect that resolves to a 2xx canonical URL) without authentication walls, CAPTCHA, or WAF blocks for an anonymous user agent.",
    severity: "Critical",
    gapCategory: "Indexing",
    evaluationMode: "deterministic",
    minimalFix: "Fix server config, redirect chain, or WAF/CDN rule so the page returns 2xx for anonymous fetchers.",
    priorityProblem: "The page returns a 4xx/5xx or chains through several redirects instead of a clean 200, so crawlers and AI bots skip it."
  }),
  check({
    publicNumber: 2,
    sourceId: "S002",
    title: "Canonical indexable URL in XML sitemap",
    description: "The canonical URL of an intended public page is present in at least one XML sitemap referenced by robots.txt or /sitemap.xml.",
    severity: "High",
    gapCategory: "Indexing",
    evaluationMode: "deterministic",
    minimalFix: "Add the canonical URL to the appropriate sitemap shard and regenerate the sitemap index.",
    priorityProblem: "The page exists but is not listed in any XML sitemap, so search engines and AI bots may never discover it."
  }),
  check({
    publicNumber: 3,
    sourceId: "S004",
    title: "No competing canonical page with same primary intent",
    description: "No other canonical indexable page on the same site answers the same primary intent without a distinct scope (audience, region, product, depth).",
    severity: "Medium",
    gapCategory: "Indexing",
    scope: "site",
    evaluationMode: "heuristic",
    minimalFix: "Choose one canonical page, redirect duplicates, or scope each page differently in title and H1.",
    priorityProblem: "Multiple URLs answer the same primary intent, so traffic and AI citations get split between near-duplicates."
  }),
  check({
    publicNumber: 4,
    sourceId: "S006",
    title: "At least one crawlable internal HTML link points to page",
    description: "At least one canonical indexable page contains a crawlable HTML link to this page (rendered DOM, not nofollow, not JS-only navigation).",
    severity: "High",
    gapCategory: "Indexing",
    scope: "site",
    evaluationMode: "heuristic",
    minimalFix: "Add an internal link from a relevant section of the site, or add the page to a hub.",
    priorityProblem: "No other page on the site links to this one, so AI bots have trouble finding it and rank it as secondary."
  }),
  check({
    publicNumber: 5,
    sourceId: "S008",
    title: "No noindex on intended AI/organic page",
    description: "The page does not declare meta robots noindex or X-Robots-Tag noindex for major search/AI bots.",
    severity: "Critical",
    gapCategory: "Indexing",
    evaluationMode: "deterministic",
    minimalFix: "Remove the noindex directive on intended public pages.",
    priorityProblem: "meta robots=noindex blocks the page from indexing entirely, so it will not appear in any AI answer."
  }),
  check({
    publicNumber: 6,
    sourceId: "S012",
    title: "No nosnippet or overly restrictive snippet controls",
    description: "The page does not declare nosnippet, max-snippet:0, or an overly restrictive max-snippet that prevents use of the main content in search snippets and AI Overviews.",
    severity: "High",
    gapCategory: "Snippet controls",
    evaluationMode: "deterministic",
    minimalFix: "Remove the directive or raise max-snippet.",
    priorityProblem: "nosnippet/max-snippet:0 restricts what previews can show, so AI Overviews and rich snippets may skip the page."
  }),
  check({
    publicNumber: 7,
    sourceId: "S023",
    title: "One primary visible H1 describing the page topic",
    description: "Exactly one primary visible H1 describes the page topic. Multiple H1s are allowed only if they do not conflict.",
    severity: "High",
    gapCategory: "Headings",
    evaluationMode: "deterministic",
    minimalFix: "Demote secondary H1s to H2, or rewrite the H1 to match page intent without changing page meaning.",
    priorityProblem: "There is no single clear H1 or there are several conflicting ones, so AI bots cannot tell what the page is about."
  }),
  check({
    publicNumber: 8,
    sourceId: "S030",
    title: "Average sentence length is extractable/readable",
    description: "Average body sentence length stays in a readable range. FAIL when average is well above ~32 words.",
    severity: "Medium",
    gapCategory: "Readability",
    evaluationMode: "heuristic",
    minimalFix: "Split overly long sentences without changing meaning.",
    priorityProblem: "Sentences average over 22 words, so AI crawlers split paragraphs into less coherent fragments and citation rate drops."
  }),
  check({
    publicNumber: 9,
    sourceId: "S031",
    title: "Processes/comparisons/lists are structured where applicable",
    description: "Process descriptions, comparisons, or list-shaped paragraphs are rendered as <ul>, <ol>, or <table>. NEEDS_REVIEW when no list/table is present but body looks list-shaped.",
    severity: "Medium",
    gapCategory: "Structure",
    evaluationMode: "heuristic",
    minimalFix: "Convert existing prose lists or comparisons into bullets or tables without changing meaning.",
    priorityProblem: "Processes, comparisons, and lists are described as prose, so AI cannot extract structure and rarely surfaces step-by-step or comparison answers."
  }),
  check({
    publicNumber: 10,
    sourceId: "S035",
    title: "Visible publication date where applicable",
    description: "A visible publication date or JSON-LD datePublished value is present on time-sensitive content.",
    severity: "Medium",
    gapCategory: "Freshness",
    evaluationMode: "heuristic",
    minimalFix: "Add a visible 'Published on YYYY-MM-DD' line, or add datePublished to the page's JSON-LD.",
    priorityProblem: "No visible publication date, so AI is reluctant to cite the content on time-sensitive topics."
  }),
  check({
    publicNumber: 11,
    sourceId: "S036",
    title: "Visible update/review/dateModified freshness where applicable",
    description: "A visible review/update date or JSON-LD dateModified value exists and is within a reasonable freshness window for the topic.",
    severity: "Medium",
    gapCategory: "Freshness",
    evaluationMode: "heuristic",
    minimalFix: "Add a 'Reviewed on YYYY-MM-DD' line and refresh the dateModified value.",
    priorityProblem: "No visible update or review date, so AI bots may treat fast-changing content as potentially stale."
  }),
  check({
    publicNumber: 12,
    sourceId: "S037",
    title: "Named author/reviewer/content owner on expertise-sensitive content",
    description: "Expertise-sensitive content (technical guides, opinion, analysis, methodology) names a human author or reviewer. Brand name alone is not sufficient. N/A for pure product/service landing pages.",
    severity: "Medium",
    gapCategory: "Authority",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a visible byline, link the author to a profile page, and add Person JSON-LD.",
    priorityProblem: "Expertise-sensitive content has no named author or reviewer, weakening the E-E-A-T signal AI uses for trust."
  }),
  check({
    publicNumber: 13,
    sourceId: "S040",
    title: "Clear heading hierarchy and body sections",
    description: "Page uses an ordered heading hierarchy (H1 → H2 → H3 …) with at least one body section, no skipped levels at the top.",
    severity: "Medium",
    gapCategory: "Headings",
    evaluationMode: "deterministic",
    minimalFix: "Re-tag headings into a coherent outline.",
    priorityProblem: "Heading hierarchy is broken or there are no H2 sections, so AI cannot parse the document structure."
  }),
  check({
    publicNumber: 14,
    sourceId: "S041",
    title: "Headings are specific, not generic template labels",
    description: "FAIL when most non-template heading text is generic ('More posts', 'Get in touch', 'Subscribe', numeric-only step labels, etc.).",
    severity: "Medium",
    gapCategory: "Headings",
    evaluationMode: "heuristic",
    minimalFix: "Rewrite generic headings into specific ones that reflect the section content.",
    priorityProblem: "Subheadings are generic template labels (Approach, More, Get in touch) instead of describing the section, so they carry no topic signal."
  }),
  check({
    publicNumber: 15,
    sourceId: "S042",
    title: "Critical content is not hidden behind click-only UI",
    description: "Content critical to the page intent is rendered in the initial HTML or by SSR; FAIL when it requires a user click and is missing from initial DOM.",
    severity: "Medium",
    gapCategory: "Rendering",
    evaluationMode: "needs-claude-review",
    minimalFix: "Render critical content in the initial HTML.",
    priorityProblem: "Critical content is hidden behind tabs or click-only JS, so AI crawlers without JS rendering miss it entirely."
  }),
  check({
    publicNumber: 16,
    sourceId: "S044",
    title: "Internal anchor text is descriptive",
    description: "FAIL when internal anchor text is dominated by generic phrases ('click here', 'read more', 'learn more', 'here', 'more', 'details').",
    severity: "Medium",
    gapCategory: "Internal linking",
    evaluationMode: "heuristic",
    minimalFix: "Rewrite anchor text to describe the destination topic.",
    priorityProblem: "Internal anchors use generic phrases (click here, read more), so AI cannot infer link context."
  }),
  check({
    publicNumber: 17,
    sourceId: "S045",
    title: "Breadcrumbs and BreadcrumbList for deep URLs where applicable",
    description: "URLs with depth > 2 should expose both a visible breadcrumb and BreadcrumbList JSON-LD. N/A on shallow URLs.",
    severity: "Medium",
    gapCategory: "Internal linking",
    evaluationMode: "heuristic",
    minimalFix: "Add visible breadcrumbs and BreadcrumbList schema.",
    priorityProblem: "Deep URLs have no breadcrumbs or BreadcrumbList, so Google and AI build a poor map of the site."
  }),
  check({
    publicNumber: 18,
    sourceId: "S046",
    title: "Meaningful images do not rely on empty src/data placeholders",
    description: "FAIL when ≥30% of images have empty src, data: placeholder, or near-empty URL.",
    severity: "High",
    gapCategory: "Media",
    evaluationMode: "deterministic",
    minimalFix: "Serve real src URLs to crawlers (SSR, lazy-load with proper data-src and noscript, or loading=lazy with real src).",
    priorityProblem: "Meaningful images use empty src or data: placeholders, so non-JS AI crawlers do not see them at all."
  }),
  check({
    publicNumber: 19,
    sourceId: "S047",
    title: "Meaningful images have descriptive alt text or SVG title",
    description: "Meaningful images have alt text or <title> for SVGs; decorative images correctly use alt=\"\".",
    severity: "High",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Add descriptive alt text for meaningful images.",
    priorityProblem: "Most meaningful images lack alt text, so to AI bots those images and what they show do not exist."
  }),
  check({
    publicNumber: 20,
    sourceId: "S048",
    title: "Important image information has nearby text/caption/table companion",
    description: "Important images (charts, infographics, screenshots, posters) are accompanied by a caption or text block that duplicates the visual meaning.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a <figcaption> or summary line near the image.",
    priorityProblem: "Important screenshots, infographics, and charts have no nearby caption or text companion, so AI reads only the surrounding prose and skips the visual signal."
  }),
  check({
    publicNumber: 21,
    sourceId: "S049",
    title: "Preferred image via og:image or schema image where applicable",
    description: "A preferred image is defined via og:image and/or schema image / primaryImageOfPage, served over HTTPS.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "deterministic",
    minimalFix: "Add og:image and link a schema image.",
    priorityProblem: "There is no og:image or schema image, so social and AI cards render without a preview illustration."
  }),
  check({
    publicNumber: 22,
    sourceId: "S050",
    title: "Important image filenames are short and descriptive",
    description: "FAIL when meaningful image filenames are generic / numeric (770x500.png, image-01.png, photo.png).",
    severity: "Low",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Rename meaningful images to short descriptive filenames.",
    priorityProblem: "Important image filenames are generic (770x500.png, image-01.png), so AI cannot pull extra meaning from the asset URL."
  }),
  check({
    publicNumber: 23,
    sourceId: "S051",
    title: "Primary image quality and preview suitability",
    description: "Primary image has acceptable resolution and aspect ratio for AI/social previews. Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "Low",
    gapCategory: "Media",
    evaluationMode: "needs-claude-review",
    minimalFix: "Replace the primary image with a higher-quality version.",
    priorityProblem: "The primary image is low resolution, a text-only banner, or has an extreme aspect ratio, so AI preview cards look poor."
  }),
  check({
    publicNumber: 24,
    sourceId: "S052",
    title: "Video has transcript, summary, or VideoObject metadata where applicable",
    description: "Each significant video has a transcript, a summary, or VideoObject JSON-LD metadata. N/A when no video.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Add a transcript or VideoObject schema.",
    priorityProblem: "Video has no transcript, summary, or VideoObject schema, so AI cannot index the video and skips the page when answering."
  }),
  check({
    publicNumber: 25,
    sourceId: "S054",
    title: "JSON-LD type matches page purpose",
    description: "FAIL when only WebPage is used on a page that should be Article, Service, Product, etc.",
    severity: "High",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Switch the JSON-LD type to one that matches intent.",
    priorityProblem: "JSON-LD type is generic WebPage where Article, NewsArticle, or CaseStudy is expected, so Google and AI cannot recognise the page type."
  }),
  check({
    publicNumber: 26,
    sourceId: "S055",
    title: "Rich-result schema has required fields where applicable",
    description: "An applicable rich-result type has all required Google rich-result fields (e.g. NewsArticle requires headline, author, datePublished).",
    severity: "Medium",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Add the missing required fields.",
    priorityProblem: "Schema is present but missing required rich-result fields, so Google will not show a rich snippet and AI gets weaker signals."
  }),
  check({
    publicNumber: 27,
    sourceId: "S057",
    title: "FAQPage/QAPage schema only for visible matching Q&A",
    description: "FAIL when FAQPage/QAPage schema is present but the visible page does not contain matching Q&A blocks.",
    severity: "Medium",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Remove the schema or add the matching visible Q&A.",
    priorityProblem: "FAQPage/QAPage schema is present but the visible page does not contain the matching Q&A, which violates Google guidelines."
  }),
  check({
    publicNumber: 28,
    sourceId: "S058",
    title: "Mobile/rendered page does not hide critical content",
    description: "The mobile-rendered version exposes the same critical content as the desktop version. Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "needs-claude-review",
    minimalFix: "Ensure responsive templates render full content on mobile.",
    priorityProblem: "The mobile version hides part of the content or CTA via display:none, and Google indexes mobile-first, so that part is lost."
  }),
  check({
    publicNumber: 29,
    sourceId: "S060",
    title: "Core Web Vitals/performance evidence available or not obviously poor",
    description: "Cannot run Lighthouse synchronously without external tools; mark NEEDS_REVIEW unless the page has obvious heavy assets.",
    severity: "Low",
    gapCategory: "Performance",
    evaluationMode: "needs-claude-review",
    minimalFix: "Investigate via PageSpeed Insights / CrUX, fix LCP/INP.",
    priorityProblem: "Core Web Vitals (LCP/INP/CLS) are out of the Good range, so Google downranks the page and AI Overview cites it less.",
    excludeFromPriority: true
  }),
  check({
    publicNumber: 30,
    sourceId: "S061",
    title: "Interstitial/cookie/auth overlays do not block main content",
    description: "FAIL when DOM contains a fixed-position cookie/auth/interstitial element that overlays main content with no clear dismissal.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "heuristic",
    minimalFix: "Ensure the interstitial is dismissible, deferred, or non-blocking on first paint.",
    priorityProblem: "Cookie consent, popup, or auth wall covers the main content on first visit, so AI crawlers do not reach the useful text."
  }),
  check({
    publicNumber: 31,
    sourceId: "S062",
    title: "Buttons/forms/menus have labels/roles/states for agents/accessibility",
    description: "FAIL when there are unlabeled form controls (no <label for>, aria-label, aria-labelledby, or visible label).",
    severity: "High",
    gapCategory: "Accessibility",
    evaluationMode: "heuristic",
    minimalFix: "Add a <label> with for= matching the input id, or add aria-label.",
    priorityProblem: "Interactive elements lack accessibility labels, so agents (ChatGPT Atlas and similar) cannot interact with the page."
  }),
  check({
    publicNumber: 32,
    sourceId: "S063",
    title: "Main content is available in source/rendered HTML, not JS-only",
    description: "FAIL when the static HTML is essentially empty and main content is rendered client-side only without an SSR fallback.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "heuristic",
    minimalFix: "Enable SSR/SSG for the page template.",
    priorityProblem: "Main content renders only via JavaScript and is missing from the static HTML, so non-rendering AI crawlers skip the page."
  }),
  check({
    publicNumber: 33,
    sourceId: "S065",
    title: "Legal/privacy/sensitive index/noindex intent is correct",
    description: "Index/noindex intent of legal/privacy/sensitive pages is deliberate and correct.",
    severity: "Medium",
    gapCategory: "Indexing",
    evaluationMode: "needs-claude-review",
    minimalFix: "Align robots/meta noindex with the intended policy.",
    priorityProblem: "Privacy/legal pages have the wrong index/noindex intent, exposing pages that should be private or hiding ones that should be indexed."
  }),
  check({
    publicNumber: 34,
    sourceId: "S066",
    title: "Hreflang present for multilingual pages where applicable",
    description: "Multilingual pages declare hreflang reciprocally. N/A for single-language sites.",
    severity: "Medium",
    gapCategory: "Internationalization",
    evaluationMode: "deterministic",
    minimalFix: "Add reciprocal hreflang tags.",
    priorityProblem: "Multilingual pages have no hreflang signals, so AI and Google cannot tell which version matches which language or region."
  }),
  check({
    publicNumber: 35,
    sourceId: "S067",
    title: "Title, H1, schema title/name, and og:title are aligned",
    description: "<title>, <h1>, JSON-LD headline/name, and og:title are consistent.",
    severity: "Medium",
    gapCategory: "Consistency",
    evaluationMode: "deterministic",
    minimalFix: "Align the four titles without rewriting the page.",
    priorityProblem: "Title, H1, schema name, and og:title disagree, so AI receives conflicting signals about the same page."
  }),
  check({
    publicNumber: 36,
    sourceId: "S070",
    title: "Strategic page has at least three relevant distinct prompt/query mappings where applicable",
    description: "Strategic pages have at least three explicit prompt/query mappings (visible Q&A, FAQ block, or recorded prompt list). Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "Medium",
    gapCategory: "Prompt coverage",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a prompt-mapped FAQ block; record prompt mappings in metadata.",
    priorityProblem: "The page targets one primary query and ignores 2-3 related secondary queries, leaving the long tail of AI citations on the table."
  })
];

export const CHECKS_BY_ID = new Map(CHECKS.map((c) => [c.id, c]));
export const CHECKS_BY_SOURCE_ID = new Map(CHECKS.map((c) => [c.sourceId, c]));
