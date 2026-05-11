import { decodeEntities } from "./utils.mjs";

// A purpose-built static HTML scanner sufficient for the 36 BASIC checks.
// We intentionally avoid runtime dependencies; this is not a generic DOM
// parser. Limitations are documented in docs/spec.md.

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const META_RE = /<meta\b([^>]*)>/gi;
const LINK_TAG_RE = /<link\b([^>]*)>/gi;
const SCRIPT_LD_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const HEADING_RE = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const IMG_RE = /<img\b([^>]*)\/?>/gi;
const FORM_RE = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
const INPUT_RE = /<(input|select|textarea)\b([^>]*)\/?>/gi;
const LABEL_RE = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
const BUTTON_RE = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const HTML_RE = /<html\b([^>]*)>/i;
const LIST_RE = /<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const TABLE_RE = /<table\b/gi;
const NAV_RE = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
const FIGCAPTION_RE = /<figcaption\b/gi;

function attr(attrs, name) {
  const re = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = attrs?.match(re);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function stripTags(html) {
  if (!html) return "";
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function visibleText(html) {
  if (!html) return "";
  // Remove script, style, noscript, template before extracting text.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ");
  return stripTags(cleaned);
}

function bodyOnly(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

function isInlineSrc(src) {
  if (!src) return true;
  const trimmed = src.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("data:")) return true;
  if (/^https?:\/\/.{0,5}$/.test(trimmed)) return true;
  return false;
}

function filenameOf(src) {
  if (!src) return "";
  return src.split("?")[0].split("#")[0].split("/").pop() || "";
}

function parseMetaRobots(html) {
  let combined = "";
  const matches = html.match(/<meta[^>]*name=["']robots["'][^>]*>/gi) || [];
  for (const m of matches) {
    const c = attr(m, "content") || "";
    combined += (combined ? "," : "") + c;
  }
  return combined.toLowerCase();
}

function parseMetas(html) {
  const out = { ogTitle: "", ogImage: "", ogDescription: "", description: "" };
  const matches = html.match(META_RE) || [];
  for (const m of matches) {
    const property = attr(m, "property")?.toLowerCase();
    const name = attr(m, "name")?.toLowerCase();
    const content = attr(m, "content") || "";
    if (property === "og:title") out.ogTitle = content;
    else if (property === "og:image") out.ogImage = content;
    else if (property === "og:description") out.ogDescription = content;
    else if (name === "description") out.description = content;
  }
  return out;
}

function parseCanonical(html) {
  const matches = html.match(LINK_TAG_RE) || [];
  for (const m of matches) {
    const rel = attr(m, "rel")?.toLowerCase();
    if (rel === "canonical") return attr(m, "href") || "";
  }
  return "";
}

function parseHreflang(html) {
  const out = [];
  const matches = html.match(LINK_TAG_RE) || [];
  for (const m of matches) {
    const rel = attr(m, "rel")?.toLowerCase();
    if (rel === "alternate") {
      const hl = attr(m, "hreflang");
      if (hl) out.push({ hreflang: hl, href: attr(m, "href") || "" });
    }
  }
  return out;
}

function parseHeadings(html) {
  const result = { h1: [], h2: [], h3: [], h4: [], all: [] };
  const body = bodyOnly(html);
  HEADING_RE.lastIndex = 0;
  let m;
  while ((m = HEADING_RE.exec(body)) !== null) {
    const level = Number(m[1]);
    const text = stripTags(m[3]);
    if (!text) continue;
    if (level >= 1 && level <= 4) result[`h${level}`].push(text);
    result.all.push({ level, text });
  }
  return result;
}

function parseLinks(html, baseUrl) {
  const links = [];
  const body = bodyOnly(html);
  ANCHOR_RE.lastIndex = 0;
  let m;
  while ((m = ANCHOR_RE.exec(body)) !== null) {
    const href = attr(m[1], "href");
    if (!href) continue;
    const rel = attr(m[1], "rel") || "";
    let resolved = "";
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      resolved = "";
    }
    links.push({
      href,
      resolved,
      text: stripTags(m[2]),
      rel,
      nofollow: /\bnofollow\b/i.test(rel)
    });
  }
  return links;
}

function parseImages(html, baseUrl) {
  const images = [];
  const body = bodyOnly(html);
  IMG_RE.lastIndex = 0;
  let m;
  while ((m = IMG_RE.exec(body)) !== null) {
    const src = attr(m[1], "src") || attr(m[1], "data-src") || "";
    const alt = attr(m[1], "alt");
    const ariaHidden = attr(m[1], "aria-hidden");
    const width = Number(attr(m[1], "width") || "0");
    const height = Number(attr(m[1], "height") || "0");
    let resolved = "";
    try { resolved = new URL(src, baseUrl).toString(); } catch {}
    images.push({
      src,
      resolved,
      alt: alt ?? "",
      altMissing: alt === null,
      decorative: alt === "" || ariaHidden === "true",
      filename: filenameOf(src),
      srcEmpty: isInlineSrc(src),
      width,
      height
    });
  }
  return images;
}

function parseJsonLd(html) {
  const out = { types: [], dates: [], blocks: [] };
  SCRIPT_LD_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_LD_RE.exec(html)) !== null) {
    let parsed;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : (parsed["@graph"] && Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]);
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      out.blocks.push(item);
      const type = item["@type"];
      if (typeof type === "string") out.types.push(type);
      else if (Array.isArray(type)) out.types.push(...type);
      if (item.datePublished) out.dates.push(`datePublished=${String(item.datePublished)}`);
      if (item.dateModified) out.dates.push(`dateModified=${String(item.dateModified)}`);
    }
  }
  return out;
}

function parseForms(html) {
  const result = { forms: [], unlabeledFormFields: 0, totalControlsScanned: 0, buttons: [] };
  const body = bodyOnly(html);

  // Index labels by `for=` attribute across the whole body to mirror real
  // accessibility scoring.
  const labelFor = new Set();
  LABEL_RE.lastIndex = 0;
  let lm;
  while ((lm = LABEL_RE.exec(body)) !== null) {
    const f = attr(lm[1], "for");
    if (f) labelFor.add(f);
  }

  // Scan inputs anywhere in body (modern forms can be unwrapped).
  INPUT_RE.lastIndex = 0;
  let im;
  while ((im = INPUT_RE.exec(body)) !== null) {
    const tag = im[1].toLowerCase();
    const type = (attr(im[2], "type") || "").toLowerCase();
    if (tag === "input" && (type === "hidden" || type === "submit" || type === "button" || type === "reset" || type === "image")) continue;
    result.totalControlsScanned += 1;
    const id = attr(im[2], "id");
    const ariaLabel = attr(im[2], "aria-label");
    const ariaLabelledby = attr(im[2], "aria-labelledby");
    const labeled = (id && labelFor.has(id)) || ariaLabel || ariaLabelledby;
    if (!labeled) result.unlabeledFormFields += 1;
  }

  FORM_RE.lastIndex = 0;
  let fm;
  while ((fm = FORM_RE.exec(body)) !== null) {
    result.forms.push({
      action: attr(fm[1], "action") || "",
      method: (attr(fm[1], "method") || "get").toLowerCase()
    });
  }

  BUTTON_RE.lastIndex = 0;
  let bm;
  while ((bm = BUTTON_RE.exec(body)) !== null) {
    result.buttons.push({
      text: stripTags(bm[2]),
      ariaLabel: attr(bm[1], "aria-label") || ""
    });
  }

  return result;
}

function parseLang(html) {
  const m = html.match(HTML_RE);
  if (!m) return "";
  return (attr(m[1], "lang") || "").toLowerCase();
}

function parseTitle(html) {
  const m = html.match(TITLE_RE);
  return m ? stripTags(m[1]) : "";
}

function countLists(html) {
  const body = bodyOnly(html);
  let n = 0;
  LIST_RE.lastIndex = 0;
  while (LIST_RE.exec(body) !== null) n += 1;
  return n;
}

function countTables(html) {
  const body = bodyOnly(html);
  return (body.match(TABLE_RE) || []).length;
}

function detectBreadcrumb(html, jsonLd) {
  const hasSchema = jsonLd.types.some((t) => String(t).toLowerCase() === "breadcrumblist");
  const body = bodyOnly(html);
  const hasNav = /aria-label\s*=\s*["'][^"']*breadcrumb/i.test(body) || /<nav[^>]*class=["'][^"']*breadcrumb/i.test(body);
  return { hasBreadcrumbList: hasSchema, hasVisibleBreadcrumb: hasNav };
}

function detectInterstitialCandidate(html) {
  const body = bodyOnly(html);
  return /(cookie|gdpr|consent|interstitial|paywall|subscribe-modal|newsletter-modal)/i.test(body) &&
    /position\s*:\s*fixed|class=["'][^"']*(modal|overlay|interstitial|consent)/i.test(body);
}

function bodyTextLength(html) {
  const text = visibleText(bodyOnly(html));
  return text.length;
}

function sentenceStats(text) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/u).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return { count: 0, averageWords: 0 };
  const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0);
  return { count: sentences.length, averageWords: totalWords / sentences.length };
}

export function extractPage(html, url) {
  const safeHtml = html || "";
  const title = parseTitle(safeHtml);
  const lang = parseLang(safeHtml);
  const metaRobots = parseMetaRobots(safeHtml);
  const metas = parseMetas(safeHtml);
  const canonical = parseCanonical(safeHtml);
  const hreflang = parseHreflang(safeHtml);
  const headings = parseHeadings(safeHtml);
  const links = parseLinks(safeHtml, url);
  const images = parseImages(safeHtml, url);
  const jsonLd = parseJsonLd(safeHtml);
  const forms = parseForms(safeHtml);
  const listCount = countLists(safeHtml);
  const tableCount = countTables(safeHtml);
  const breadcrumb = detectBreadcrumb(safeHtml, jsonLd);
  const bodyText = visibleText(bodyOnly(safeHtml));
  const stats = sentenceStats(bodyText);
  const figcaptionCount = (bodyOnly(safeHtml).match(FIGCAPTION_RE) || []).length;

  return {
    url,
    title,
    canonical,
    lang,
    metaRobots,
    ogTitle: metas.ogTitle,
    ogImage: metas.ogImage,
    metaDescription: metas.description,
    headings,
    links,
    images,
    jsonLdTypes: jsonLd.types,
    jsonLdDates: jsonLd.dates,
    jsonLdBlocks: jsonLd.blocks,
    forms: forms.forms,
    buttons: forms.buttons,
    unlabeledFormFields: forms.unlabeledFormFields,
    totalControlsScanned: forms.totalControlsScanned,
    listCount,
    tableCount,
    figcaptionCount,
    hasBreadcrumbList: breadcrumb.hasBreadcrumbList,
    hasVisibleBreadcrumb: breadcrumb.hasVisibleBreadcrumb,
    interstitialCandidate: detectInterstitialCandidate(safeHtml),
    hreflang,
    bodyText,
    bodyTextLength: bodyText.length,
    sentenceCount: stats.count,
    averageSentenceWords: stats.averageWords,
    htmlLength: safeHtml.length
  };
}
