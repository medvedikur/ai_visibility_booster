import fs from "node:fs/promises";
import path from "node:path";
import { sleep, hashUrl } from "./utils.mjs";
import { extractPage } from "./extract-page.mjs";

export const USER_AGENT = "AIVisibilityBooster/0.1 (+https://github.com/medvedikur/ai_visibility_booster)";

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

async function readLocalText(p) {
  return fs.readFile(p, "utf8");
}

async function fetchText(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9" },
      redirect: "follow",
      signal: controller.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: "", error: String(err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

async function loadLocalSitePage(seedDir, urlOrPath) {
  // Map fixture URLs (https://fixture.local/...) to local files.
  let relPath;
  if (urlOrPath.startsWith("https://fixture.local")) {
    relPath = urlOrPath.replace(/^https:\/\/fixture\.local/, "");
  } else if (urlOrPath.startsWith("http")) {
    return { ok: false, status: 0, text: "" };
  } else {
    relPath = urlOrPath;
  }
  if (!relPath || relPath === "/") relPath = "/index.html";
  if (!path.extname(relPath)) relPath = `${relPath}.html`;
  const filePath = path.join(seedDir, relPath.replace(/^\/+/, ""));
  try {
    const text = await readLocalText(filePath);
    return { ok: true, status: 200, text };
  } catch (err) {
    return { ok: false, status: 404, text: "", error: String(err.message || err) };
  }
}

export async function crawl({ seed, limit = 200, depth = 2, sitemapOnly = false, sleepMs = 250, timeoutMs = 15000 }) {
  const isLocal = isLocalCrawlSeed(seed);
  const baseHost = isLocal ? "fixture.local" : new URL(seed).hostname.toLowerCase();
  const baseOrigin = isLocal ? "https://fixture.local" : new URL(seed).origin;
  const seedDir = isLocal ? (seed.startsWith("file://") ? seed.slice(7) : seed) : null;

  const seenUrls = new Set();
  const queue = [];
  const pages = [];
  const robotsText = isLocal
    ? (await loadLocalSitePage(seedDir, "/robots.txt")).text
    : (await fetchText(`${baseOrigin}/robots.txt`, { timeoutMs })).text;
  const robots = parseRobots(robotsText);

  // Seed with sitemap URLs.
  const sitemapUrls = robots.sitemaps.length
    ? robots.sitemaps
    : [isLocal ? "/sitemap.xml" : `${baseOrigin}/sitemap.xml`];
  for (const sm of sitemapUrls) {
    let smText;
    if (isLocal) {
      smText = (await loadLocalSitePage(seedDir, sm.replace(baseOrigin, ""))).text;
    } else {
      smText = (await fetchText(sm, { timeoutMs })).text;
    }
    for (const u of parseSitemap(smText)) {
      const norm = normalizeUrl(u);
      if (!norm) continue;
      const host = (() => { try { return new URL(norm).hostname.toLowerCase(); } catch { return ""; } })();
      if (host !== baseHost) continue;
      if (!seenUrls.has(norm)) {
        seenUrls.add(norm);
        queue.push({ url: norm, depth: 0 });
      }
    }
  }

  if (!sitemapOnly) {
    const seedUrl = isLocal ? `${baseOrigin}/` : seed;
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
    startedAt: new Date().toISOString()
  };

  while (queue.length && pages.length < limit) {
    const { url, depth: d } = queue.shift();
    let result;
    if (isLocal) {
      result = await loadLocalSitePage(seedDir, url);
    } else {
      result = await fetchText(url, { timeoutMs });
    }
    stats.fetched += 1;
    stats.statusCounts[result.status] = (stats.statusCounts[result.status] || 0) + 1;
    if (!result.ok) stats.failed += 1;

    const snapshot = extractPage(result.text || "", url);
    pages.push({
      url,
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

    if (!isLocal) await sleep(sleepMs);
  }

  stats.completedAt = new Date().toISOString();
  return {
    domain: baseHost,
    baseOrigin,
    robots,
    sitemapUrls,
    stats,
    pages,
    urls: pages.map((p) => ({ url: p.url, status: p.status, ok: p.ok, depth: p.depth }))
  };
}
