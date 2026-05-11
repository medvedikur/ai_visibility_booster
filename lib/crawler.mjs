import fs from "node:fs/promises";
import path from "node:path";
import { sleep, hashUrl, normalizeDomain } from "./utils.mjs";
import { extractPage } from "./extract-page.mjs";

export const USER_AGENT =
  "AIVisibilityBooster/0.1.2 (+https://github.com/medvedikur/ai_visibility_booster)";

const SITEMAP_FETCH_CAP = 50;

export function parseRobots(text) {
  const lines = (text || "").split(/\r?\n/);
  const sitemaps = [];
  const disallow = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("sitemap:")) {
      sitemaps.push(trimmed.slice(8).trim());
    } else if (lower.startsWith("disallow:")) {
      disallow.push(trimmed.slice(9).trim());
    }
  }
  return { sitemaps, disallow };
}

export function parseSitemap(xml) {
  if (!xml) return [];
  const out = [];
  const locRe = /<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = locRe.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

export function classifySitemap(xml) {
  const locs = parseSitemap(xml);
  const isIndex = /<sitemapindex\b/i.test(xml || "");
  return { kind: isIndex ? "index" : "urlset", locs };
}

export function normalizeUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(value);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return "";
  }
}

export function dedupeByCanonical(items) {
  const seen = new Map();
  for (const item of items) {
    const key = normalizeUrl(item.canonical || item.url);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

export function isLocalCrawlSeed(seed) {
  if (!seed) return false;
  if (seed.startsWith("file://")) return true;
  if (/^https?:\/\//i.test(seed)) return false;
  return true;
}

export function stripWww(host) {
  if (!host) return "";
  const lower = String(host).toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

export function isWwwAliasHost(a, b) {
  if (!a || !b) return false;
  const la = String(a).toLowerCase();
  const lb = String(b).toLowerCase();
  if (la === lb) return false;
  return stripWww(la) === stripWww(lb);
}

export function hostAliasesFor(requestedHost, canonicalHost) {
  const req = requestedHost ? String(requestedHost).toLowerCase() : "";
  const can = canonicalHost ? String(canonicalHost).toLowerCase() : "";
  if (!req) return [];
  if (!can || req === can) return [req];
  if (isWwwAliasHost(req, can)) {
    return Array.from(new Set([req, can]));
  }
  // Unrelated canonical host: do not expand crawl scope.
  return [req];
}

export function isAllowedCrawlHost(host, aliases) {
  if (!host) return false;
  const target = String(host).toLowerCase();
  for (const alias of aliases || []) {
    if (String(alias).toLowerCase() === target) return true;
  }
  return false;
}

async function readLocalText(p) {
  return fs.readFile(p, "utf8");
}

export async function fetchText(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const text = await res.text();
    const finalUrl = (res && res.url) ? res.url : url;
    const redirected = Boolean(res && res.redirected) || finalUrl !== url;
    const contentType =
      (res && res.headers && typeof res.headers.get === "function")
        ? (res.headers.get("content-type") || "")
        : "";
    return {
      ok: res.ok,
      status: res.status,
      text,
      finalUrl,
      redirected,
      contentType
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: "",
      finalUrl: url,
      redirected: false,
      contentType: "",
      error: String(err.message || err)
    };
  } finally {
    clearTimeout(t);
  }
}

async function loadLocalSitePage(seedDir, urlOrPath) {
  let relPath;
  if (urlOrPath.startsWith("https://fixture.local")) {
    relPath = urlOrPath.replace(/^https:\/\/fixture\.local/, "");
  } else if (urlOrPath.startsWith("http")) {
    return { ok: false, status: 0, text: "", finalUrl: urlOrPath, redirected: false, contentType: "" };
  } else {
    relPath = urlOrPath;
  }
  if (!relPath || relPath === "/") relPath = "/index.html";
  if (!path.extname(relPath)) relPath = `${relPath}.html`;
  const filePath = path.join(seedDir, relPath.replace(/^\/+/, ""));
  try {
    const text = await readLocalText(filePath);
    return { ok: true, status: 200, text, finalUrl: urlOrPath, redirected: false, contentType: "text/html" };
  } catch (err) {
    return {
      ok: false,
      status: 404,
      text: "",
      finalUrl: urlOrPath,
      redirected: false,
      contentType: "",
      error: String(err.message || err)
    };
  }
}

async function crawlLocal({ seed, limit, depth, sitemapOnly, sleepMs }) {
  const baseHost = "fixture.local";
  const baseOrigin = "https://fixture.local";
  const seedDir = seed.startsWith("file://") ? seed.slice(7) : seed;

  const seenUrls = new Set();
  const queue = [];
  const robotsText = (await loadLocalSitePage(seedDir, "/robots.txt")).text;
  const robots = parseRobots(robotsText);

  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps : ["/sitemap.xml"];
  let sitemapPageEntries = 0;
  for (const sm of sitemapUrls) {
    const smText = (await loadLocalSitePage(seedDir, sm.replace(baseOrigin, ""))).text;
    for (const u of parseSitemap(smText)) {
      const norm = normalizeUrl(u);
      if (!norm) continue;
      let host;
      try { host = new URL(norm).hostname.toLowerCase(); } catch { continue; }
      if (host !== baseHost) continue;
      sitemapPageEntries += 1;
      if (!seenUrls.has(norm)) {
        seenUrls.add(norm);
        queue.push({ url: norm, depth: 0 });
      }
    }
  }

  const seedUrl = `${baseOrigin}/`;
  if (!sitemapOnly) {
    if (!seenUrls.has(seedUrl)) {
      seenUrls.add(seedUrl);
      queue.push({ url: seedUrl, depth: 0 });
    }
  }

  const stats = {
    totalCandidates: queue.length,
    fetched: 0,
    failed: 0,
    statusCounts: {},
    sitemapCount: sitemapUrls.length,
    sitemapEntries: queue.length,
    sitemapFetched: sitemapUrls.length,
    sitemapIndexCount: 0,
    sitemapPageEntries,
    seedUrl,
    seedFinalUrl: seedUrl,
    requestedOrigin: baseOrigin,
    crawlOrigin: baseOrigin,
    requestedHost: baseHost,
    canonicalHost: baseHost,
    hostAliases: [baseHost],
    redirectedSeed: false,
    warnings: [],
    startedAt: new Date().toISOString()
  };

  const pages = [];
  while (queue.length && pages.length < limit) {
    const { url, depth: d } = queue.shift();
    const result = await loadLocalSitePage(seedDir, url);
    stats.fetched += 1;
    stats.statusCounts[result.status] = (stats.statusCounts[result.status] || 0) + 1;
    if (!result.ok) stats.failed += 1;

    const pageBase = result.finalUrl || url;
    const snapshot = extractPage(result.text || "", pageBase);

    let pageHost = "";
    try { pageHost = new URL(pageBase).hostname.toLowerCase(); } catch {}

    pages.push({
      url,
      finalUrl: result.finalUrl || url,
      redirected: Boolean(result.redirected),
      host: pageHost,
      hash: hashUrl(url),
      status: result.status,
      ok: result.ok,
      depth: d,
      snapshot
    });

    if (!sitemapOnly && d < depth && result.ok) {
      for (const link of snapshot.links) {
        const norm = normalizeUrl(link.resolved);
        if (!norm) continue;
        let host;
        try { host = new URL(norm).hostname.toLowerCase(); } catch { continue; }
        if (host !== baseHost) continue;
        if (link.nofollow) continue;
        if (!seenUrls.has(norm) && pages.length + queue.length < limit) {
          seenUrls.add(norm);
          queue.push({ url: norm, depth: d + 1 });
          stats.totalCandidates += 1;
        }
      }
    }

    if (sleepMs > 0) await sleep(sleepMs);
  }

  stats.completedAt = new Date().toISOString();
  return {
    domain: baseHost,
    baseOrigin,
    robots,
    sitemapUrls,
    stats,
    pages,
    urls: pages.map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      status: p.status,
      ok: p.ok,
      depth: p.depth
    }))
  };
}

async function crawlRemote({ seed, limit, depth, sitemapOnly, sleepMs, timeoutMs, fetchImpl }) {
  const requestedUrl = new URL(seed);
  const requestedHost = requestedUrl.hostname.toLowerCase();
  const requestedOrigin = requestedUrl.origin;

  // 1) Resolve canonical crawl origin from the seed redirect.
  const seedRes = await fetchText(seed, { timeoutMs, fetchImpl });
  const seedFinalUrl = seedRes.finalUrl || seed;
  let canonicalUrl;
  try {
    canonicalUrl = new URL(seedFinalUrl);
  } catch {
    canonicalUrl = requestedUrl;
  }
  const canonicalHost = canonicalUrl.hostname.toLowerCase();
  const canonicalOrigin = canonicalUrl.origin;

  const warnings = [];
  let crawlOrigin = requestedOrigin;
  let hostAliases = [requestedHost];
  const redirectedSeed = Boolean(seedRes.redirected) || canonicalHost !== requestedHost;

  if (canonicalHost && canonicalHost !== requestedHost) {
    if (isWwwAliasHost(requestedHost, canonicalHost)) {
      crawlOrigin = canonicalOrigin;
      hostAliases = hostAliasesFor(requestedHost, canonicalHost);
    } else {
      warnings.push(
        `Seed redirected from ${requestedHost} to unrelated host ${canonicalHost}; staying on requested host.`
      );
      // crawlOrigin stays as requestedOrigin; hostAliases stays as [requestedHost].
    }
  }

  // 2) Fetch robots.txt from the crawl origin.
  const robotsRes = await fetchText(`${crawlOrigin}/robots.txt`, { timeoutMs, fetchImpl });
  const robots = parseRobots(robotsRes.text);

  // 3) Sitemap discovery + sitemap-index recursion (capped).
  const initialSitemapUrls = robots.sitemaps.length
    ? robots.sitemaps
    : [`${crawlOrigin}/sitemap.xml`];
  const sitemapFetched = new Set();
  const sitemapStack = [...initialSitemapUrls];
  let sitemapIndexCount = 0;
  let sitemapPageEntries = 0;
  const sitemapPageUrls = [];

  while (sitemapStack.length && sitemapFetched.size < SITEMAP_FETCH_CAP) {
    const sm = sitemapStack.shift();
    if (!sm || sitemapFetched.has(sm)) continue;
    sitemapFetched.add(sm);
    const r = await fetchText(sm, { timeoutMs, fetchImpl });
    if (!r.text) continue;
    const cls = classifySitemap(r.text);
    if (cls.kind === "index") {
      sitemapIndexCount += 1;
      for (const loc of cls.locs) {
        if (!sitemapFetched.has(loc)) sitemapStack.push(loc);
      }
    } else {
      for (const loc of cls.locs) {
        const norm = normalizeUrl(loc);
        if (!norm) continue;
        let host;
        try { host = new URL(norm).hostname.toLowerCase(); } catch { continue; }
        if (!isAllowedCrawlHost(host, hostAliases)) continue;
        sitemapPageEntries += 1;
        sitemapPageUrls.push(norm);
      }
    }
  }

  // 4) Build the BFS queue.
  const seenUrls = new Set();
  const queue = [];

  // Seed first — prefer canonical seed URL if the redirect was accepted.
  const seedAccepted =
    canonicalHost === requestedHost ||
    isWwwAliasHost(requestedHost, canonicalHost);
  const initialSeedUrl = seedAccepted ? normalizeUrl(seedFinalUrl) : normalizeUrl(seed);

  if (!sitemapOnly && initialSeedUrl) {
    if (!seenUrls.has(initialSeedUrl)) {
      seenUrls.add(initialSeedUrl);
      // Reuse the seed fetch we already did.
      queue.push({ url: initialSeedUrl, depth: 0, _cached: seedRes });
    }
  }

  for (const u of sitemapPageUrls) {
    if (!seenUrls.has(u)) {
      seenUrls.add(u);
      queue.push({ url: u, depth: 0 });
    }
  }

  const stats = {
    totalCandidates: queue.length,
    fetched: 0,
    failed: 0,
    statusCounts: {},
    sitemapCount: initialSitemapUrls.length,
    sitemapEntries: sitemapPageEntries,
    sitemapFetched: sitemapFetched.size,
    sitemapIndexCount,
    sitemapPageEntries,
    seedUrl: seed,
    seedFinalUrl,
    requestedOrigin,
    crawlOrigin,
    requestedHost,
    canonicalHost,
    hostAliases,
    redirectedSeed,
    warnings,
    startedAt: new Date().toISOString()
  };

  const pages = [];

  // 5) BFS.
  while (queue.length && pages.length < limit) {
    const { url, depth: d, _cached } = queue.shift();
    const result = _cached || await fetchText(url, { timeoutMs, fetchImpl });
    stats.fetched += 1;
    stats.statusCounts[result.status] = (stats.statusCounts[result.status] || 0) + 1;
    if (!result.ok) stats.failed += 1;

    const pageBase = result.finalUrl || url;
    const snapshot = extractPage(result.text || "", pageBase);

    let pageHost = "";
    try { pageHost = new URL(pageBase).hostname.toLowerCase(); } catch {}

    pages.push({
      url,
      finalUrl: result.finalUrl || url,
      redirected: Boolean(result.redirected),
      host: pageHost,
      hash: hashUrl(url),
      status: result.status,
      ok: result.ok,
      depth: d,
      snapshot
    });

    if (!sitemapOnly && d < depth && result.ok) {
      for (const link of snapshot.links) {
        const norm = normalizeUrl(link.resolved);
        if (!norm) continue;
        let host;
        try { host = new URL(norm).hostname.toLowerCase(); } catch { continue; }
        if (!isAllowedCrawlHost(host, hostAliases)) continue;
        if (link.nofollow) continue;
        if (!seenUrls.has(norm) && pages.length + queue.length < limit) {
          seenUrls.add(norm);
          queue.push({ url: norm, depth: d + 1 });
          stats.totalCandidates += 1;
        }
      }
    }

    if (sleepMs > 0) await sleep(sleepMs);
  }

  stats.completedAt = new Date().toISOString();

  return {
    domain: normalizeDomain(requestedHost),
    baseOrigin: crawlOrigin,
    robots,
    sitemapUrls: initialSitemapUrls,
    stats,
    pages,
    urls: pages.map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      status: p.status,
      ok: p.ok,
      depth: p.depth
    }))
  };
}

export async function crawl({
  seed,
  limit = 200,
  depth = 2,
  sitemapOnly = false,
  sleepMs = 250,
  timeoutMs = 15000,
  fetchImpl
} = {}) {
  if (isLocalCrawlSeed(seed)) {
    return crawlLocal({ seed, limit, depth, sitemapOnly, sleepMs: 0 });
  }
  return crawlRemote({ seed, limit, depth, sitemapOnly, sleepMs, timeoutMs, fetchImpl });
}
