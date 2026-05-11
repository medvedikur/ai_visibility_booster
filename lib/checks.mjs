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
  minimalFix
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
    minimalFix: "Fix server config, redirect chain, or WAF/CDN rule so the page returns 2xx for anonymous fetchers."
  }),
  check({
    publicNumber: 2,
    sourceId: "S002",
    title: "Canonical indexable URL in XML sitemap",
    description: "The canonical URL of an intended public page is present in at least one XML sitemap referenced by robots.txt or /sitemap.xml.",
    severity: "High",
    gapCategory: "Indexing",
    evaluationMode: "deterministic",
    minimalFix: "Add the canonical URL to the appropriate sitemap shard and regenerate the sitemap index."
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
    minimalFix: "Choose one canonical page, redirect duplicates, or scope each page differently in title and H1."
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
    minimalFix: "Add an internal link from a relevant section of the site, or add the page to a hub."
  }),
  check({
    publicNumber: 5,
    sourceId: "S008",
    title: "No noindex on intended AI/organic page",
    description: "The page does not declare meta robots noindex or X-Robots-Tag noindex for major search/AI bots.",
    severity: "Critical",
    gapCategory: "Indexing",
    evaluationMode: "deterministic",
    minimalFix: "Remove the noindex directive on intended public pages."
  }),
  check({
    publicNumber: 6,
    sourceId: "S012",
    title: "No nosnippet or overly restrictive snippet controls",
    description: "The page does not declare nosnippet, max-snippet:0, or an overly restrictive max-snippet that prevents use of the main content in search snippets and AI Overviews.",
    severity: "High",
    gapCategory: "Snippet controls",
    evaluationMode: "deterministic",
    minimalFix: "Remove the directive or raise max-snippet."
  }),
  check({
    publicNumber: 7,
    sourceId: "S023",
    title: "One primary visible H1 describing the page topic",
    description: "Exactly one primary visible H1 describes the page topic. Multiple H1s are allowed only if they do not conflict.",
    severity: "High",
    gapCategory: "Headings",
    evaluationMode: "deterministic",
    minimalFix: "Demote secondary H1s to H2, or rewrite the H1 to match page intent without changing page meaning."
  }),
  check({
    publicNumber: 8,
    sourceId: "S030",
    title: "Average sentence length is extractable/readable",
    description: "Average body sentence length stays in a readable range. FAIL when average is well above ~32 words.",
    severity: "Medium",
    gapCategory: "Readability",
    evaluationMode: "heuristic",
    minimalFix: "Split overly long sentences without changing meaning."
  }),
  check({
    publicNumber: 9,
    sourceId: "S031",
    title: "Processes/comparisons/lists are structured where applicable",
    description: "Process descriptions, comparisons, or list-shaped paragraphs are rendered as <ul>, <ol>, or <table>. NEEDS_REVIEW when no list/table is present but body looks list-shaped.",
    severity: "Medium",
    gapCategory: "Structure",
    evaluationMode: "heuristic",
    minimalFix: "Convert existing prose lists or comparisons into bullets or tables without changing meaning."
  }),
  check({
    publicNumber: 10,
    sourceId: "S035",
    title: "Visible publication date where applicable",
    description: "A visible publication date or JSON-LD datePublished value is present on time-sensitive content.",
    severity: "Medium",
    gapCategory: "Freshness",
    evaluationMode: "heuristic",
    minimalFix: "Add a visible 'Published on YYYY-MM-DD' line, or add datePublished to the page's JSON-LD."
  }),
  check({
    publicNumber: 11,
    sourceId: "S036",
    title: "Visible update/review/dateModified freshness where applicable",
    description: "A visible review/update date or JSON-LD dateModified value exists and is within a reasonable freshness window for the topic.",
    severity: "Medium",
    gapCategory: "Freshness",
    evaluationMode: "heuristic",
    minimalFix: "Add a 'Reviewed on YYYY-MM-DD' line and refresh the dateModified value."
  }),
  check({
    publicNumber: 12,
    sourceId: "S037",
    title: "Named author/reviewer/content owner on expertise-sensitive content",
    description: "Expertise-sensitive content (technical guides, opinion, analysis, methodology) names a human author or reviewer. Brand name alone is not sufficient. N/A for pure product/service landing pages.",
    severity: "Medium",
    gapCategory: "Authority",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a visible byline, link the author to a profile page, and add Person JSON-LD."
  }),
  check({
    publicNumber: 13,
    sourceId: "S040",
    title: "Clear heading hierarchy and body sections",
    description: "Page uses an ordered heading hierarchy (H1 → H2 → H3 …) with at least one body section, no skipped levels at the top.",
    severity: "Medium",
    gapCategory: "Headings",
    evaluationMode: "deterministic",
    minimalFix: "Re-tag headings into a coherent outline."
  }),
  check({
    publicNumber: 14,
    sourceId: "S041",
    title: "Headings are specific, not generic template labels",
    description: "FAIL when most non-template heading text is generic ('More posts', 'Get in touch', 'Subscribe', numeric-only step labels, etc.).",
    severity: "Medium",
    gapCategory: "Headings",
    evaluationMode: "heuristic",
    minimalFix: "Rewrite generic headings into specific ones that reflect the section content."
  }),
  check({
    publicNumber: 15,
    sourceId: "S042",
    title: "Critical content is not hidden behind click-only UI",
    description: "Content critical to the page intent is rendered in the initial HTML or by SSR; FAIL when it requires a user click and is missing from initial DOM.",
    severity: "Medium",
    gapCategory: "Rendering",
    evaluationMode: "needs-claude-review",
    minimalFix: "Render critical content in the initial HTML."
  }),
  check({
    publicNumber: 16,
    sourceId: "S044",
    title: "Internal anchor text is descriptive",
    description: "FAIL when internal anchor text is dominated by generic phrases ('click here', 'read more', 'learn more', 'here', 'more', 'details').",
    severity: "Medium",
    gapCategory: "Internal linking",
    evaluationMode: "heuristic",
    minimalFix: "Rewrite anchor text to describe the destination topic."
  }),
  check({
    publicNumber: 17,
    sourceId: "S045",
    title: "Breadcrumbs and BreadcrumbList for deep URLs where applicable",
    description: "URLs with depth > 2 should expose both a visible breadcrumb and BreadcrumbList JSON-LD. N/A on shallow URLs.",
    severity: "Medium",
    gapCategory: "Internal linking",
    evaluationMode: "heuristic",
    minimalFix: "Add visible breadcrumbs and BreadcrumbList schema."
  }),
  check({
    publicNumber: 18,
    sourceId: "S046",
    title: "Meaningful images do not rely on empty src/data placeholders",
    description: "FAIL when ≥30% of images have empty src, data: placeholder, or near-empty URL.",
    severity: "High",
    gapCategory: "Media",
    evaluationMode: "deterministic",
    minimalFix: "Serve real src URLs to crawlers (SSR, lazy-load with proper data-src and noscript, or loading=lazy with real src)."
  }),
  check({
    publicNumber: 19,
    sourceId: "S047",
    title: "Meaningful images have descriptive alt text or SVG title",
    description: "Meaningful images have alt text or <title> for SVGs; decorative images correctly use alt=\"\".",
    severity: "High",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Add descriptive alt text for meaningful images."
  }),
  check({
    publicNumber: 20,
    sourceId: "S048",
    title: "Important image information has nearby text/caption/table companion",
    description: "Important images (charts, infographics, screenshots, posters) are accompanied by a caption or text block that duplicates the visual meaning.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a <figcaption> or summary line near the image."
  }),
  check({
    publicNumber: 21,
    sourceId: "S049",
    title: "Preferred image via og:image or schema image where applicable",
    description: "A preferred image is defined via og:image and/or schema image / primaryImageOfPage, served over HTTPS.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "deterministic",
    minimalFix: "Add og:image and link a schema image."
  }),
  check({
    publicNumber: 22,
    sourceId: "S050",
    title: "Important image filenames are short and descriptive",
    description: "FAIL when meaningful image filenames are generic / numeric (770x500.png, image-01.png, photo.png).",
    severity: "Low",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Rename meaningful images to short descriptive filenames."
  }),
  check({
    publicNumber: 23,
    sourceId: "S051",
    title: "Primary image quality and preview suitability",
    description: "Primary image has acceptable resolution and aspect ratio for AI/social previews. Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "Low",
    gapCategory: "Media",
    evaluationMode: "needs-claude-review",
    minimalFix: "Replace the primary image with a higher-quality version."
  }),
  check({
    publicNumber: 24,
    sourceId: "S052",
    title: "Video has transcript, summary, or VideoObject metadata where applicable",
    description: "Each significant video has a transcript, a summary, or VideoObject JSON-LD metadata. N/A when no video.",
    severity: "Medium",
    gapCategory: "Media",
    evaluationMode: "heuristic",
    minimalFix: "Add a transcript or VideoObject schema."
  }),
  check({
    publicNumber: 25,
    sourceId: "S054",
    title: "JSON-LD type matches page purpose",
    description: "FAIL when only WebPage is used on a page that should be Article, Service, Product, etc.",
    severity: "High",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Switch the JSON-LD type to one that matches intent."
  }),
  check({
    publicNumber: 26,
    sourceId: "S055",
    title: "Rich-result schema has required fields where applicable",
    description: "An applicable rich-result type has all required Google rich-result fields (e.g. NewsArticle requires headline, author, datePublished).",
    severity: "Medium",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Add the missing required fields."
  }),
  check({
    publicNumber: 27,
    sourceId: "S057",
    title: "FAQPage/QAPage schema only for visible matching Q&A",
    description: "FAIL when FAQPage/QAPage schema is present but the visible page does not contain matching Q&A blocks.",
    severity: "Medium",
    gapCategory: "Schema",
    evaluationMode: "heuristic",
    minimalFix: "Remove the schema or add the matching visible Q&A."
  }),
  check({
    publicNumber: 28,
    sourceId: "S058",
    title: "Mobile/rendered page does not hide critical content",
    description: "The mobile-rendered version exposes the same critical content as the desktop version. Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "needs-claude-review",
    minimalFix: "Ensure responsive templates render full content on mobile."
  }),
  check({
    publicNumber: 29,
    sourceId: "S060",
    title: "Core Web Vitals/performance evidence available or not obviously poor",
    description: "Cannot run Lighthouse synchronously without external tools; mark NEEDS_REVIEW unless the page has obvious heavy assets.",
    severity: "Low",
    gapCategory: "Performance",
    evaluationMode: "needs-claude-review",
    minimalFix: "Investigate via PageSpeed Insights / CrUX, fix LCP/INP."
  }),
  check({
    publicNumber: 30,
    sourceId: "S061",
    title: "Interstitial/cookie/auth overlays do not block main content",
    description: "FAIL when DOM contains a fixed-position cookie/auth/interstitial element that overlays main content with no clear dismissal.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "heuristic",
    minimalFix: "Ensure the interstitial is dismissible, deferred, or non-blocking on first paint."
  }),
  check({
    publicNumber: 31,
    sourceId: "S062",
    title: "Buttons/forms/menus have labels/roles/states for agents/accessibility",
    description: "FAIL when there are unlabeled form controls (no <label for>, aria-label, aria-labelledby, or visible label).",
    severity: "High",
    gapCategory: "Accessibility",
    evaluationMode: "heuristic",
    minimalFix: "Add a <label> with for= matching the input id, or add aria-label."
  }),
  check({
    publicNumber: 32,
    sourceId: "S063",
    title: "Main content is available in source/rendered HTML, not JS-only",
    description: "FAIL when the static HTML is essentially empty and main content is rendered client-side only without an SSR fallback.",
    severity: "High",
    gapCategory: "Rendering",
    evaluationMode: "heuristic",
    minimalFix: "Enable SSR/SSG for the page template."
  }),
  check({
    publicNumber: 33,
    sourceId: "S065",
    title: "Legal/privacy/sensitive index/noindex intent is correct",
    description: "Index/noindex intent of legal/privacy/sensitive pages is deliberate and correct.",
    severity: "Medium",
    gapCategory: "Indexing",
    evaluationMode: "needs-claude-review",
    minimalFix: "Align robots/meta noindex with the intended policy."
  }),
  check({
    publicNumber: 34,
    sourceId: "S066",
    title: "Hreflang present for multilingual pages where applicable",
    description: "Multilingual pages declare hreflang reciprocally. N/A for single-language sites.",
    severity: "Medium",
    gapCategory: "Internationalization",
    evaluationMode: "deterministic",
    minimalFix: "Add reciprocal hreflang tags."
  }),
  check({
    publicNumber: 35,
    sourceId: "S067",
    title: "Title, H1, schema title/name, and og:title are aligned",
    description: "<title>, <h1>, JSON-LD headline/name, and og:title are consistent.",
    severity: "Medium",
    gapCategory: "Consistency",
    evaluationMode: "deterministic",
    minimalFix: "Align the four titles without rewriting the page."
  }),
  check({
    publicNumber: 36,
    sourceId: "S070",
    title: "Strategic page has at least three relevant distinct prompt/query mappings where applicable",
    description: "Strategic pages have at least three explicit prompt/query mappings (visible Q&A, FAQ block, or recorded prompt list). Heuristic alone cannot prove this; mark NEEDS_REVIEW.",
    severity: "Medium",
    gapCategory: "Prompt coverage",
    evaluationMode: "needs-claude-review",
    minimalFix: "Add a prompt-mapped FAQ block; record prompt mappings in metadata."
  })
];

export const CHECKS_BY_ID = new Map(CHECKS.map((c) => [c.id, c]));
export const CHECKS_BY_SOURCE_ID = new Map(CHECKS.map((c) => [c.sourceId, c]));
