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
