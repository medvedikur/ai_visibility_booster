import { CHECKS, CHECKS_BY_ID } from "./checks.mjs";
import { urlDepth } from "./utils.mjs";
import { classifyPageType, isExpertiseSensitive } from "./page-type.mjs";

const GENERIC_HEADING_TERMS = new Set([
  "more posts", "more", "get in touch", "contact", "thank you",
  "subscribe", "related", "categories", "tags", "footer", "apply for",
  "newsletter", "follow us", "share", "comments"
]);

const GENERIC_ANCHOR_TERMS = new Set([
  "click here", "here", "read more", "learn more", "more", "details", "this", "click", "link"
]);

const RICH_TYPES = new Set([
  "Article", "NewsArticle", "BlogPosting", "Product", "Recipe",
  "JobPosting", "Event", "HowTo", "FAQPage", "QAPage", "VideoObject"
]);

const STRATEGIC_PATH_RE = /^\/(services|solutions|industries|industry|platform|product|products|use-cases|use-case)\b/i;

function makeVerdict(check, value, evidence, extra = {}) {
  return {
    checkId: check.id,
    sourceId: check.sourceId,
    severity: check.severity,
    gapCategory: check.gapCategory,
    minimalFix: check.minimalFix,
    evaluationMode: check.evaluationMode,
    value,
    evidence: evidence ?? "",
    ...extra
  };
}

function pageIsPublic(page, ctx) {
  return ctx?.fetchedOk !== false && !page.metaRobots.includes("noindex");
}

function evaluateAIVB001(check, page, ctx) {
  const status = ctx?.httpStatus;
  if (typeof status !== "number") {
    return makeVerdict(check, "NEEDS_REVIEW", "HTTP status not provided to evaluator");
  }
  if (status >= 200 && status < 300) {
    return makeVerdict(check, "PASS", `HTTP ${status} OK`);
  }
  return makeVerdict(check, "FAIL", `HTTP ${status}; page is not directly fetchable`);
}

function evaluateAIVB002(check, page, ctx) {
  if (ctx?.inSitemap === true) {
    return makeVerdict(check, "PASS", "Canonical URL found in XML sitemap.");
  }
  if (ctx?.inSitemap === false) {
    return makeVerdict(check, "FAIL", "Canonical URL not found in any discovered sitemap.");
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Sitemap membership not provided to evaluator.", { naReason: "missing_data" });
}

function evaluateAIVB003(check, page, ctx) {
  const others = ctx?.sameOriginPages || [];
  if (!others.length) {
    return makeVerdict(check, "NEEDS_REVIEW", "No other crawled pages available to compare intent.", { naReason: "missing_data" });
  }
  const sig = `${(page.title || "").toLowerCase().trim()}|${(page.headings.h1[0] || "").toLowerCase().trim()}`;
  const dupes = others
    .filter((o) => o.url !== page.url)
    .filter((o) => `${(o.title || "").toLowerCase().trim()}|${(o.h1 || "").toLowerCase().trim()}` === sig && sig !== "|");
  if (dupes.length === 0) {
    return makeVerdict(check, "PASS", "No identical title+H1 sibling pages detected.");
  }
  return makeVerdict(check, "FAIL", `Identical title+H1 found on ${dupes.length} other page(s): ${dupes.slice(0, 3).map((d) => d.url).join(", ")}`);
}

function evaluateAIVB004(check, page, ctx) {
  if (ctx?.hasInternalInboundLink === true) {
    return makeVerdict(check, "PASS", "At least one same-origin inbound link found.");
  }
  if (ctx?.hasInternalInboundLink === false) {
    return makeVerdict(check, "FAIL", "No crawlable internal HTML link points to this page.");
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Inbound link data not provided to evaluator.", { naReason: "missing_data" });
}

function evaluateAIVB005(check, page) {
  if (page.metaRobots.includes("noindex")) {
    return makeVerdict(check, "FAIL", `meta robots contains noindex (${page.metaRobots})`);
  }
  return makeVerdict(check, "PASS", page.metaRobots ? `meta robots = ${page.metaRobots}` : "no noindex directive");
}

function evaluateAIVB006(check, page) {
  if (/\bnosnippet\b/.test(page.metaRobots) || /max-snippet\s*:\s*0/.test(page.metaRobots)) {
    return makeVerdict(check, "FAIL", `meta robots contains snippet restriction (${page.metaRobots})`);
  }
  return makeVerdict(check, "PASS", "No snippet restriction detected.");
}

function evaluateAIVB007(check, page) {
  const h1s = page.headings.h1.length;
  if (h1s === 0) return makeVerdict(check, "FAIL", "No H1 found.");
  if (h1s === 1) return makeVerdict(check, "PASS", `Single H1: "${page.headings.h1[0].slice(0, 80)}"`);
  return makeVerdict(check, "FAIL", `${h1s} H1s detected: ${page.headings.h1.slice(0, 3).map((t) => `"${t.slice(0, 40)}"`).join(", ")}`);
}

function evaluateAIVB008(check, page) {
  if (page.sentenceCount < 5) {
    return makeVerdict(check, "N/A", "Body has fewer than 5 sentences; readability check skipped.", { naReason: "not_applicable" });
  }
  const avg = page.averageSentenceWords;
  if (avg <= 28) return makeVerdict(check, "PASS", `Average sentence length ${avg.toFixed(1)} words`);
  if (avg <= 36) return makeVerdict(check, "NEEDS_REVIEW", `Average sentence length ${avg.toFixed(1)} words; borderline`);
  return makeVerdict(check, "FAIL", `Average sentence length ${avg.toFixed(1)} words is too long for AI extraction`);
}

function evaluateAIVB009(check, page) {
  if (page.listCount > 0 || page.tableCount > 0) {
    return makeVerdict(check, "PASS", `Body contains ${page.listCount} list(s) and ${page.tableCount} table(s).`);
  }
  if (page.bodyTextLength < 500) {
    return makeVerdict(check, "N/A", "Page body too short to evaluate list/table structure.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", "No <ul>/<ol>/<table> found; review whether body has list-shaped content that could be structured.");
}

function evaluateAIVB010(check, page) {
  if (page.jsonLdDates.some((d) => d.startsWith("datePublished="))) {
    return makeVerdict(check, "PASS", "datePublished present in JSON-LD.");
  }
  if (/Published(?: on)?:?\s+\d{4}/i.test(page.bodyText)) {
    return makeVerdict(check, "PASS", "Visible 'Published' date in body text.");
  }
  if (page.bodyTextLength < 400) {
    return makeVerdict(check, "N/A", "Page body too short to require publication date.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", "No visible publication date and no datePublished in JSON-LD; verify whether page is time-sensitive.");
}

function evaluateAIVB011(check, page) {
  if (page.jsonLdDates.some((d) => d.startsWith("dateModified="))) {
    return makeVerdict(check, "PASS", "dateModified present in JSON-LD.");
  }
  if (/Reviewed(?: on)?:?\s+\d{4}/i.test(page.bodyText) || /Updated(?: on)?:?\s+\d{4}/i.test(page.bodyText)) {
    return makeVerdict(check, "PASS", "Visible 'Reviewed/Updated' date in body text.");
  }
  if (page.bodyTextLength < 400) {
    return makeVerdict(check, "N/A", "Page body too short to require freshness date.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", "No visible review/update date; verify whether topic is fast-changing.");
}

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

function evaluateAIVB013(check, page) {
  const h1 = page.headings.h1.length;
  const h2 = page.headings.h2.length;
  if (h1 === 0) return makeVerdict(check, "FAIL", "Heading hierarchy invalid: no H1.");
  if (page.bodyTextLength > 600 && h2 === 0) {
    return makeVerdict(check, "FAIL", "Long body has no H2 sections.");
  }
  return makeVerdict(check, "PASS", `Hierarchy h1=${h1} h2=${h2} h3=${page.headings.h3.length}`);
}

function evaluateAIVB014(check, page) {
  const headings = [...page.headings.h2, ...page.headings.h3];
  if (headings.length === 0) {
    return makeVerdict(check, "N/A", "No subheadings to evaluate.", { naReason: "not_applicable" });
  }
  const generic = headings.filter((t) => GENERIC_HEADING_TERMS.has(t.trim().toLowerCase()) || /^\d+$/.test(t.trim()));
  const ratio = generic.length / headings.length;
  if (ratio >= 0.6) {
    return makeVerdict(check, "FAIL", `${generic.length}/${headings.length} subheadings are generic template labels.`);
  }
  return makeVerdict(check, "PASS", `${generic.length}/${headings.length} generic; remainder are descriptive.`);
}

function evaluateAIVB015(check, page) {
  if (page.bodyTextLength < 200 && page.htmlLength > 4000) {
    return makeVerdict(check, "FAIL", "Body text is short relative to HTML size; critical content may be hidden behind interactive UI.");
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Static analysis cannot prove tab/accordion content visibility; manual or rendered review required.");
}

function evaluateAIVB016(check, page) {
  const internal = page.links.filter((l) => l.text);
  if (internal.length === 0) {
    return makeVerdict(check, "N/A", "No anchor text to evaluate.", { naReason: "not_applicable" });
  }
  const generic = internal.filter((l) => GENERIC_ANCHOR_TERMS.has(l.text.trim().toLowerCase()));
  const ratio = generic.length / internal.length;
  if (ratio >= 0.4) {
    return makeVerdict(check, "FAIL", `${generic.length}/${internal.length} anchors use generic text (e.g. 'click here', 'read more').`);
  }
  if (ratio >= 0.2) {
    return makeVerdict(check, "NEEDS_REVIEW", `${generic.length}/${internal.length} anchors are generic; review.`);
  }
  return makeVerdict(check, "PASS", `${internal.length} anchors, ${generic.length} generic.`);
}

function evaluateAIVB017(check, page) {
  const depth = urlDepth(page.url);
  if (depth <= 2) {
    return makeVerdict(check, "N/A", `URL depth ${depth} ≤ 2; breadcrumb not required.`, { naReason: "not_applicable" });
  }
  if (page.hasBreadcrumbList && page.hasVisibleBreadcrumb) {
    return makeVerdict(check, "PASS", "Visible breadcrumb and BreadcrumbList schema both present.");
  }
  return makeVerdict(check, "FAIL", `URL depth ${depth} but breadcrumb missing (visible=${page.hasVisibleBreadcrumb}, schema=${page.hasBreadcrumbList}).`);
}

function evaluateAIVB018(check, page) {
  const total = page.images.length;
  if (total === 0) {
    return makeVerdict(check, "N/A", "No images on page.", { naReason: "not_applicable" });
  }
  const empty = page.images.filter((i) => i.srcEmpty).length;
  const ratio = empty / total;
  if (ratio >= 0.30) {
    return makeVerdict(check, "FAIL", `${empty}/${total} images have empty/data: src.`);
  }
  return makeVerdict(check, "PASS", `${empty}/${total} images have empty src; under threshold.`);
}

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

function evaluateAIVB020(check, page) {
  const meaningful = page.images.filter((i) => !i.decorative && !i.srcEmpty);
  if (meaningful.length === 0) {
    return makeVerdict(check, "N/A", "No meaningful images to evaluate.", { naReason: "not_applicable" });
  }
  if (page.figcaptionCount >= meaningful.length) {
    return makeVerdict(check, "PASS", `${page.figcaptionCount} <figcaption> elements cover the meaningful images.`);
  }
  return makeVerdict(check, "NEEDS_REVIEW", `${page.figcaptionCount} captions for ${meaningful.length} meaningful images; verify each significant image has a nearby companion.`);
}

function evaluateAIVB021(check, page) {
  if (page.ogImage) return makeVerdict(check, "PASS", `og:image = ${page.ogImage}`);
  const schemaImage = page.jsonLdBlocks.some((b) => b.image || b.primaryImageOfPage);
  if (schemaImage) return makeVerdict(check, "PASS", "Schema image present.");
  return makeVerdict(check, "FAIL", "No og:image and no schema image defined.");
}

function evaluateAIVB022(check, page) {
  const meaningful = page.images.filter((i) => !i.decorative && !i.srcEmpty && i.filename);
  if (meaningful.length === 0) {
    return makeVerdict(check, "N/A", "No meaningful images with filenames to evaluate.", { naReason: "not_applicable" });
  }
  const generic = meaningful.filter((i) => /^\d+x\d+\.[a-z]+$/i.test(i.filename) || /^(image|photo|img|pic|picture)[-_]?\d+\.[a-z]+$/i.test(i.filename));
  if (generic.length / meaningful.length >= 0.5) {
    return makeVerdict(check, "FAIL", `${generic.length}/${meaningful.length} images have generic filenames.`);
  }
  return makeVerdict(check, "PASS", `${generic.length}/${meaningful.length} generic filenames; under threshold.`);
}

function evaluateAIVB023(check, page) {
  const primary = page.images.find((i) => i.resolved && (i.resolved === page.ogImage || (i.width >= 600 && i.height >= 300)));
  if (!primary) {
    return makeVerdict(check, "N/A", "No primary image candidate detected.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", `Primary image candidate: ${primary.filename} (${primary.width}x${primary.height}); verify quality and aspect ratio.`);
}

function evaluateAIVB024(check, page) {
  const hasVideoObject = page.jsonLdTypes.some((t) => String(t).toLowerCase() === "videoobject");
  const hasVideoTag = /<video\b/i.test(page.bodyText) || /youtube\.com\/embed|player\.vimeo\.com\/video/i.test(page.bodyText);
  if (!hasVideoObject && !hasVideoTag) {
    return makeVerdict(check, "N/A", "No video detected on page.", { naReason: "not_applicable" });
  }
  if (hasVideoObject) return makeVerdict(check, "PASS", "VideoObject metadata present.");
  return makeVerdict(check, "NEEDS_REVIEW", "Video present but no VideoObject schema or transcript detected.");
}

function evaluateAIVB025(check, page) {
  if (page.jsonLdTypes.length === 0) {
    return makeVerdict(check, "FAIL", "No JSON-LD type defined.");
  }
  const onlyWebPage = page.jsonLdTypes.every((t) => /^(WebPage|WebSite|Organization)$/i.test(String(t)));
  const isBlog = /\/blog\/|\/news\/|\/insights\//.test(page.url);
  if (onlyWebPage && isBlog) {
    return makeVerdict(check, "FAIL", `Page looks like a blog/news article but JSON-LD types are only ${page.jsonLdTypes.join(",")}.`);
  }
  return makeVerdict(check, "PASS", `JSON-LD types: ${page.jsonLdTypes.join(",")}.`);
}

function evaluateAIVB026(check, page) {
  const richBlock = page.jsonLdBlocks.find((b) => RICH_TYPES.has(String(b["@type"] || "")));
  if (!richBlock) {
    return makeVerdict(check, "N/A", "No rich-result-eligible JSON-LD type present.", { naReason: "not_applicable" });
  }
  const t = String(richBlock["@type"]);
  const required = {
    Article: ["headline", "author", "datePublished"],
    NewsArticle: ["headline", "author", "datePublished"],
    BlogPosting: ["headline", "author", "datePublished"],
    Product: ["name", "image"],
    Recipe: ["name", "recipeInstructions", "recipeIngredient"],
    JobPosting: ["title", "datePosted", "hiringOrganization"],
    Event: ["name", "startDate", "location"],
    HowTo: ["name", "step"],
    FAQPage: ["mainEntity"],
    QAPage: ["mainEntity"],
    VideoObject: ["name", "thumbnailUrl", "uploadDate"]
  }[t] || [];
  const missing = required.filter((field) => !richBlock[field]);
  if (missing.length === 0) return makeVerdict(check, "PASS", `${t} schema has all required fields.`);
  return makeVerdict(check, "FAIL", `${t} schema missing: ${missing.join(", ")}.`);
}

function evaluateAIVB027(check, page) {
  const hasFaqSchema = page.jsonLdTypes.some((t) => /^(FAQPage|QAPage)$/i.test(String(t)));
  if (!hasFaqSchema) {
    return makeVerdict(check, "N/A", "No FAQPage/QAPage schema present.", { naReason: "not_applicable" });
  }
  const hasQAText = /\?\s*<\/?h[1-6]>?/i.test(page.bodyText) || /(Q:|A:)\s/i.test(page.bodyText) || /\?\s/.test(page.bodyText);
  if (!hasQAText) {
    return makeVerdict(check, "FAIL", "FAQPage/QAPage schema present but visible Q&A blocks not detected.");
  }
  return makeVerdict(check, "PASS", "FAQPage/QAPage schema and visible Q&A both detected.");
}

function evaluateAIVB028() {
  const check = CHECKS_BY_ID.get("AIVB-028");
  return makeVerdict(check, "NEEDS_REVIEW", "Static analysis cannot prove mobile-rendered visibility; verify in mobile viewport.");
}

function evaluateAIVB029(check, page) {
  if (page.htmlLength > 1_500_000) {
    return makeVerdict(check, "FAIL", `HTML payload ${(page.htmlLength / 1024).toFixed(0)} KB suggests heavy LCP risk.`);
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Lighthouse/CrUX evidence not collected by this plugin; review via PageSpeed Insights.");
}

function evaluateAIVB030(check, page) {
  if (page.interstitialCandidate) {
    return makeVerdict(check, "NEEDS_REVIEW", "Fixed-position overlay candidate detected; judge whether it actually blocks main content (z-index, dismissibility, viewport coverage).");
  }
  return makeVerdict(check, "PASS", "No interstitial candidate detected in static HTML.");
}

function evaluateAIVB031(check, page) {
  if (page.totalControlsScanned === 0) {
    return makeVerdict(check, "N/A", "No form controls on page.", { naReason: "not_applicable" });
  }
  const unlabeled = page.unlabeledFormFields;
  if (unlabeled > 2 || (unlabeled > 0 && page.totalControlsScanned <= 5)) {
    return makeVerdict(check, "FAIL", `${unlabeled}/${page.totalControlsScanned} form controls are unlabeled.`);
  }
  return makeVerdict(check, "PASS", `${unlabeled}/${page.totalControlsScanned} unlabeled controls; under threshold.`);
}

function evaluateAIVB032(check, page) {
  if (page.htmlLength > 2000 && page.bodyTextLength < 200) {
    return makeVerdict(check, "FAIL", `HTML is ${page.htmlLength} bytes but visible text is only ${page.bodyTextLength} chars; likely JS-only render.`);
  }
  return makeVerdict(check, "PASS", `Visible text ${page.bodyTextLength} chars present in source HTML.`);
}

function evaluateAIVB033(check, page) {
  const isLegal = /\/(privacy|legal|terms|cookies?)/i.test(page.url);
  if (!isLegal) {
    return makeVerdict(check, "N/A", "Page is not a legal/privacy/sensitive URL.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Legal/privacy page detected; verify index/noindex intent matches policy.");
}

function evaluateAIVB034(check, page) {
  if (page.hreflang.length > 0) {
    return makeVerdict(check, "PASS", `${page.hreflang.length} hreflang link(s) declared.`);
  }
  if (page.lang && page.lang !== "en") {
    return makeVerdict(check, "FAIL", `Page lang=${page.lang} but no hreflang declared.`);
  }
  return makeVerdict(check, "N/A", "No multilingual signals detected; hreflang not required.", { naReason: "not_applicable" });
}

function evaluateAIVB035(check, page) {
  const titles = [page.title, page.headings.h1[0] || "", page.ogTitle].filter(Boolean);
  const headlines = page.jsonLdBlocks.map((b) => b.headline || b.name).filter(Boolean);
  if (headlines.length) titles.push(...headlines);
  const unique = new Set(titles.map((t) => String(t).toLowerCase().trim()));
  if (unique.size <= 1) return makeVerdict(check, "PASS", `All ${titles.length} title sources match.`);
  if (unique.size === 2 && titles.length >= 3) {
    return makeVerdict(check, "NEEDS_REVIEW", `Title sources have ${unique.size} variants: ${[...unique].join(" | ")}`);
  }
  return makeVerdict(check, "FAIL", `Title sources diverge: ${[...unique].join(" | ")}`);
}

function evaluateAIVB036(check, page) {
  const isStrategic = STRATEGIC_PATH_RE.test(new URL(page.url, "https://x").pathname);
  if (!isStrategic) {
    return makeVerdict(check, "N/A", "Not a strategic services/solutions page.", { naReason: "not_applicable" });
  }
  return makeVerdict(check, "NEEDS_REVIEW", "Strategic page detected; verify it has at least 3 distinct prompt/query mappings (visible Q&A, FAQ block, or recorded prompts).");
}

const EVALUATORS = {
  "AIVB-001": evaluateAIVB001,
  "AIVB-002": evaluateAIVB002,
  "AIVB-003": evaluateAIVB003,
  "AIVB-004": evaluateAIVB004,
  "AIVB-005": evaluateAIVB005,
  "AIVB-006": evaluateAIVB006,
  "AIVB-007": evaluateAIVB007,
  "AIVB-008": evaluateAIVB008,
  "AIVB-009": evaluateAIVB009,
  "AIVB-010": evaluateAIVB010,
  "AIVB-011": evaluateAIVB011,
  "AIVB-012": evaluateAIVB012,
  "AIVB-013": evaluateAIVB013,
  "AIVB-014": evaluateAIVB014,
  "AIVB-015": evaluateAIVB015,
  "AIVB-016": evaluateAIVB016,
  "AIVB-017": evaluateAIVB017,
  "AIVB-018": evaluateAIVB018,
  "AIVB-019": evaluateAIVB019,
  "AIVB-020": evaluateAIVB020,
  "AIVB-021": evaluateAIVB021,
  "AIVB-022": evaluateAIVB022,
  "AIVB-023": evaluateAIVB023,
  "AIVB-024": evaluateAIVB024,
  "AIVB-025": evaluateAIVB025,
  "AIVB-026": evaluateAIVB026,
  "AIVB-027": evaluateAIVB027,
  "AIVB-028": evaluateAIVB028,
  "AIVB-029": evaluateAIVB029,
  "AIVB-030": evaluateAIVB030,
  "AIVB-031": evaluateAIVB031,
  "AIVB-032": evaluateAIVB032,
  "AIVB-033": evaluateAIVB033,
  "AIVB-034": evaluateAIVB034,
  "AIVB-035": evaluateAIVB035,
  "AIVB-036": evaluateAIVB036
};

export function analyzePage(page, ctx = {}) {
  const verdicts = [];
  for (const check of CHECKS) {
    const fn = EVALUATORS[check.id];
    if (!fn) {
      verdicts.push(makeVerdict(check, "NEEDS_REVIEW", `No evaluator wired for ${check.id}; treat as needs review.`));
      continue;
    }
    try {
      verdicts.push(fn(check, page, ctx));
    } catch (err) {
      verdicts.push(makeVerdict(check, "NEEDS_REVIEW", `Evaluator error: ${err.message}`));
    }
  }
  return verdicts;
}

export function summarizeVerdicts(perPage) {
  const checkSummary = {};
  for (const check of CHECKS) {
    checkSummary[check.id] = { PASS: 0, FAIL: 0, "N/A": 0, NEEDS_REVIEW: 0 };
  }
  for (const page of perPage) {
    for (const v of page.verdicts) {
      const bucket = checkSummary[v.checkId];
      if (bucket && bucket[v.value] !== undefined) bucket[v.value] += 1;
    }
  }
  return checkSummary;
}
