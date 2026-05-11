import fs from "node:fs/promises";
import path from "node:path";
import { hashUrl, nowStamp, normalizeDomain } from "./utils.mjs";

export const ARTIFACTS_DEFAULT = ".ai-visibility";

export function siteDir(root, domain) {
  return path.join(root, "sites", normalizeDomain(domain));
}

export async function ensureRoot(root) {
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(path.join(root, "sites"), { recursive: true });
  await fs.mkdir(path.join(root, "comparisons"), { recursive: true });
  await fs.mkdir(path.join(root, "reports"), { recursive: true });
  return root;
}

export async function ensureSiteDir(root, domain) {
  const dir = siteDir(root, domain);
  await fs.mkdir(path.join(dir, "crawl-runs"), { recursive: true });
  await fs.mkdir(path.join(dir, "analyses"), { recursive: true });
  return dir;
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeSite(root, domain, meta) {
  const dir = await ensureSiteDir(root, domain);
  await writeJson(path.join(dir, "site.json"), {
    domain: normalizeDomain(domain),
    updatedAt: new Date().toISOString(),
    ...meta
  });
}

export async function loadSite(root, domain) {
  try {
    return await readJson(path.join(siteDir(root, domain), "site.json"));
  } catch {
    return null;
  }
}

export async function writeCrawlRun(root, domain, { stats, urls, pages }) {
  const dir = await ensureSiteDir(root, domain);
  const runId = nowStamp();
  const runDir = path.join(dir, "crawl-runs", runId);
  await fs.mkdir(path.join(runDir, "pages"), { recursive: true });
  await writeJson(path.join(runDir, "stats.json"), stats);
  await writeJson(path.join(runDir, "urls.json"), urls);
  for (const page of pages || []) {
    const hash = page.hash || hashUrl(page.url);
    await writeJson(path.join(runDir, "pages", `${hash}.json`), page);
  }
  // Maintain a url-tree.json that accumulates URLs across runs.
  const treePath = path.join(dir, "url-tree.json");
  let tree = [];
  try { tree = await readJson(treePath); } catch {}
  const existing = new Set(tree.map((t) => t.url));
  for (const u of urls || []) {
    if (!existing.has(u.url)) tree.push({ url: u.url, firstSeen: runId, lastStatus: u.status });
  }
  await writeJson(treePath, tree);
  await writeSite(root, domain, { lastCrawlRun: runId });
  return runId;
}

async function listRunIds(root, domain, sub) {
  const dir = path.join(siteDir(root, domain), sub);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

export async function readLatestCrawl(root, domain) {
  const ids = await listRunIds(root, domain, "crawl-runs");
  if (!ids.length) return null;
  const runId = ids[ids.length - 1];
  return readCrawlRun(root, domain, runId);
}

export async function readCrawlRun(root, domain, runId) {
  const runDir = path.join(siteDir(root, domain), "crawl-runs", runId);
  const stats = await readJson(path.join(runDir, "stats.json"));
  const urls = await readJson(path.join(runDir, "urls.json"));
  const pagesDir = path.join(runDir, "pages");
  let pageFiles = [];
  try { pageFiles = await fs.readdir(pagesDir); } catch {}
  const pages = [];
  for (const file of pageFiles) {
    if (!file.endsWith(".json")) continue;
    pages.push(await readJson(path.join(pagesDir, file)));
  }
  return { runId, stats, urls, pages };
}

export async function writeAnalysis(root, domain, { input, verdicts, summary, matrix }) {
  const dir = await ensureSiteDir(root, domain);
  const id = nowStamp();
  const target = path.join(dir, "analyses", id);
  await fs.mkdir(target, { recursive: true });
  await writeJson(path.join(target, "input.json"), input);
  await writeJson(path.join(target, "verdicts.json"), verdicts);
  await writeJson(path.join(target, "summary.json"), summary);
  await writeJson(path.join(target, "check-matrix.json"), matrix);
  await writeSite(root, domain, { lastAnalysis: id });
  return id;
}

export async function readLatestAnalysis(root, domain) {
  const ids = await listRunIds(root, domain, "analyses");
  if (!ids.length) return null;
  const id = ids[ids.length - 1];
  return readAnalysis(root, domain, id);
}

export async function readAnalysis(root, domain, id) {
  const dir = path.join(siteDir(root, domain), "analyses", id);
  return {
    id,
    input: await readJson(path.join(dir, "input.json")),
    verdicts: await readJson(path.join(dir, "verdicts.json")),
    summary: await readJson(path.join(dir, "summary.json")),
    matrix: await readJson(path.join(dir, "check-matrix.json"))
  };
}

export async function addCompetitor(root, target, competitor) {
  const dir = await ensureSiteDir(root, target);
  const filePath = path.join(dir, "competitors.json");
  let list = [];
  try { list = await readJson(filePath); } catch {}
  const norm = normalizeDomain(competitor);
  if (norm && !list.includes(norm)) list.push(norm);
  await writeJson(filePath, list);
  return list;
}

export async function loadCompetitors(root, target) {
  try {
    return await readJson(path.join(siteDir(root, target), "competitors.json"));
  } catch {
    return [];
  }
}

export async function writeReport(root, domain, content, format = "md") {
  await ensureRoot(root);
  const id = nowStamp();
  const filePath = path.join(root, "reports", `${id}-${normalizeDomain(domain)}.${format}`);
  await fs.writeFile(filePath, content);
  return filePath;
}

export async function writeComparison(root, comparison) {
  await ensureRoot(root);
  const id = nowStamp();
  const dir = path.join(root, "comparisons", id);
  await fs.mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "comparison.json"), comparison);
  return dir;
}
