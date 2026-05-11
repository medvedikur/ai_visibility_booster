#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, asNumber, asList } from "../lib/cli-args.mjs";
import { CHECKS } from "../lib/checks.mjs";
import { crawl, isLocalCrawlSeed, normalizeUrl, parseRobots, parseSitemap } from "../lib/crawler.mjs";
import { extractPage } from "../lib/extract-page.mjs";
import { analyzePage, summarizeVerdicts } from "../lib/analyzer.mjs";
import {
  ARTIFACTS_DEFAULT,
  ensureRoot,
  ensureSiteDir,
  writeSite,
  writeCrawlRun,
  readLatestCrawl,
  readCrawlRun,
  writeAnalysis,
  readLatestAnalysis,
  loadSite,
  addCompetitor,
  loadCompetitors,
  writeReport,
  writeReportNamed,
  writeComparison
} from "../lib/storage.mjs";
import { compareSites } from "../lib/compare.mjs";
import { buildReportMarkdown } from "../lib/reporter.mjs";
import { scorePage, bucketFor, emptyBucketCounts } from "../lib/scoring.mjs";
import { computePriorityRows } from "../lib/priority.mjs";
import { buildPriorityReportHtml } from "../lib/priority-report-html.mjs";
import { normalizeDomain, mulberry32, pickRandom } from "../lib/utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");

const PLUGIN = JSON.parse(
  await fs.readFile(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8").catch(() => '{"name":"ai-visibility-booster","version":"0.1.2"}')
);

function resolveArtifactsDir(flag) {
  if (flag && typeof flag === "string") {
    return path.isAbsolute(flag) ? flag : path.resolve(process.cwd(), flag);
  }
  return path.resolve(process.cwd(), ARTIFACTS_DEFAULT);
}

function deriveDomainFromSeed(seed) {
  if (!seed) return "";
  if (isLocalCrawlSeed(seed)) return "fixture.local";
  try {
    return normalizeDomain(seed);
  } catch {
    return "";
  }
}

function exitErr(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function cmdChecklist() {
  process.stdout.write(`AI Visibility Booster — 36 BASIC checks (AIVB-001 through AIVB-036)\n\n`);
  process.stdout.write(`ID         | Severity | Mode                | Source | Gap category          | Title\n`);
  process.stdout.write(`-----------+----------+---------------------+--------+-----------------------+--------------------------------------\n`);
  for (const c of CHECKS) {
    const row = [
      c.id.padEnd(10),
      c.severity.padEnd(8),
      c.evaluationMode.padEnd(19),
      c.sourceId,
      (c.gapCategory || "").padEnd(21),
      c.title
    ].join(" | ");
    process.stdout.write(`${row}\n`);
  }
  process.stdout.write(`\nTotal: ${CHECKS.length} checks. Source IDs (Sxxx) are provenance only.\n`);
}

async function cmdDoctor() {
  const checks = [];
  const nodeOk = process.versions && Number(process.versions.node.split(".")[0]) >= 20;
  checks.push({ name: "Node >= 20", ok: nodeOk, info: process.version });
  let manifestOk = false;
  try {
    const m = JSON.parse(await fs.readFile(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"));
    manifestOk = m.name === "ai-visibility-booster";
    checks.push({ name: "Plugin manifest", ok: manifestOk, info: `name=${m.name} v${m.version}` });
  } catch (err) {
    checks.push({ name: "Plugin manifest", ok: false, info: err.message });
  }
  checks.push({ name: "Checklist length", ok: CHECKS.length === 36, info: `${CHECKS.length} checks` });
  let cli = true;
  try { await fs.access(path.join(PLUGIN_ROOT, "bin", "aiv.mjs")); } catch { cli = false; }
  checks.push({ name: "CLI binary", ok: cli, info: "bin/aiv.mjs" });
  // Lightweight English-only scan of public docs.
  const cyrillic = /[Ѐ-ӿԀ-ԯ]/;
  const docFiles = ["README.md", "docs/spec.md", "docs/plan.md", "docs/source-research.md"];
  let docsOk = true;
  for (const file of docFiles) {
    try {
      const text = await fs.readFile(path.join(PLUGIN_ROOT, file), "utf8");
      if (cyrillic.test(text)) { docsOk = false; break; }
    } catch {
      // missing files are reported separately below
    }
  }
  checks.push({ name: "English-only public docs", ok: docsOk, info: docsOk ? "no Cyrillic detected" : "Cyrillic detected" });
  // Artifact root creatable.
  try {
    const tmp = path.join(PLUGIN_ROOT, ".tmp", "doctor");
    await fs.mkdir(tmp, { recursive: true });
    await fs.rm(tmp, { recursive: true, force: true });
    checks.push({ name: "Artifact directory creation", ok: true, info: ".tmp/doctor probe ok" });
  } catch (err) {
    checks.push({ name: "Artifact directory creation", ok: false, info: err.message });
  }

  let allOk = true;
  for (const c of checks) {
    process.stdout.write(`${c.ok ? "[ok]   " : "[fail] "} ${c.name.padEnd(32)} ${c.info}\n`);
    if (!c.ok) allOk = false;
  }
  process.stdout.write(`\n${allOk ? "Doctor: OK" : "Doctor: FAILED"}\n`);
  process.exit(allOk ? 0 : 1);
}

async function cmdCrawl(positional, flags) {
  const seed = positional[0];
  if (!seed) exitErr("crawl requires a URL or local fixture path");
  const limit = asNumber(flags.limit, 200);
  const depth = asNumber(flags.depth, 2);
  const sitemapOnly = flags["sitemap-only"] === true;
  const root = resolveArtifactsDir(flags.out || flags.artifacts);
  await ensureRoot(root);
  const result = await crawl({ seed, limit, depth, sitemapOnly });
  const domain = result.domain;
  await writeSite(root, domain, { baseOrigin: result.baseOrigin });
  const runId = await writeCrawlRun(root, domain, {
    stats: result.stats,
    urls: result.urls,
    pages: result.pages.map((p) => ({
      url: p.url,
      hash: p.hash,
      status: p.status,
      ok: p.ok,
      depth: p.depth,
      snapshot: p.snapshot
    }))
  });
  process.stdout.write(`Crawl complete for ${domain}\n`);
  process.stdout.write(`- Run ID: ${runId}\n`);
  process.stdout.write(`- Total candidates: ${result.stats.totalCandidates}\n`);
  process.stdout.write(`- Pages fetched: ${result.stats.fetched}\n`);
  process.stdout.write(`- Status distribution: ${JSON.stringify(result.stats.statusCounts)}\n`);
  process.stdout.write(`- Sitemap entries: ${result.stats.sitemapEntries}\n`);
  process.stdout.write(`- Artifacts: ${path.join(root, "sites", domain, "crawl-runs", runId)}\n`);
}

function selectPages(pages, flags) {
  if (flags.all === true || flags.all === "true") return pages;
  if (flags.urls) {
    const urls = new Set(asList(flags.urls).map(normalizeUrl));
    return pages.filter((p) => urls.has(normalizeUrl(p.url)));
  }
  if (flags.random) {
    const n = asNumber(flags.random, 25);
    const seed = asNumber(flags.seed, 42);
    return pickRandom(pages, n, mulberry32(seed));
  }
  return pages;
}

async function cmdAnalyze(positional, flags) {
  const domain = normalizeDomain(positional[0]);
  if (!domain) exitErr("analyze requires a domain");
  const root = resolveArtifactsDir(flags.artifacts);
  let crawlData;
  if (flags["run-id"]) {
    crawlData = await readCrawlRun(root, domain, flags["run-id"]);
  } else {
    crawlData = await readLatestCrawl(root, domain);
  }
  if (!crawlData) exitErr(`no crawl artifacts for ${domain} in ${root}`);
  const selected = selectPages(crawlData.pages, flags);
  if (!selected.length) exitErr("no pages selected for analysis");

  const sitemapUrlSet = new Set((crawlData.urls || []).map((u) => normalizeUrl(u.url)));
  const inboundCounts = new Map();
  for (const p of crawlData.pages) {
    for (const link of p.snapshot?.links || []) {
      const norm = normalizeUrl(link.resolved);
      if (norm) inboundCounts.set(norm, (inboundCounts.get(norm) || 0) + 1);
    }
  }
  const sameOriginPages = crawlData.pages.map((p) => ({
    url: p.url,
    title: p.snapshot?.title || "",
    h1: p.snapshot?.headings?.h1?.[0] || ""
  }));

  const siteMultilingual = crawlData.pages.some((p) => (p.snapshot?.hreflang || []).length > 0)
    || (() => {
         const langCodes = new Set();
         for (const p of crawlData.pages) {
           for (const link of p.snapshot?.links || []) {
             try {
               const seg = new URL(link.resolved).pathname.split("/").filter(Boolean)[0] || "";
               if (/^[a-z]{2}(-[a-z]{2})?$/i.test(seg)) langCodes.add(seg.toLowerCase());
             } catch {}
           }
         }
         return langCodes.size >= 2;
       })();

  const verdicts = [];
  for (const page of selected) {
    const ctx = {
      httpStatus: page.status,
      fetchedOk: page.ok !== false,
      inSitemap: sitemapUrlSet.has(normalizeUrl(page.url)),
      hasInternalInboundLink: (inboundCounts.get(normalizeUrl(page.url)) || 0) > 0,
      sameOriginPages,
      siteMultilingual
    };
    const pageVerdicts = analyzePage(page.snapshot, ctx);
    const score = scorePage(pageVerdicts);
    verdicts.push({
      url: page.url,
      hash: page.hash,
      status: page.status,
      score,
      bucket: bucketFor(score),
      verdicts: pageVerdicts
    });
  }

  const matrix = summarizeVerdicts(verdicts);
  const buckets = emptyBucketCounts();
  let scoreTotal = 0;
  for (const v of verdicts) {
    buckets[v.bucket] += 1;
    scoreTotal += v.score;
  }
  const summary = {
    pages: verdicts.length,
    averageScore: verdicts.length ? Math.round((scoreTotal / verdicts.length) * 100) / 100 : 0,
    bucketCounts: buckets,
    checkSummary: matrix
  };
  const id = await writeAnalysis(root, domain, {
    input: { target: domain, args: flags, runId: crawlData.runId, urls: selected.map((s) => s.url) },
    verdicts,
    summary,
    matrix
  });

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

  process.stdout.write(`Analysis complete for ${domain}\n`);
  process.stdout.write(`- Analysis ID: ${id}\n`);
  process.stdout.write(`- Pages analyzed: ${verdicts.length}\n`);
  process.stdout.write(`- Average score: ${summary.averageScore}\n`);
  process.stdout.write(`- Bucket distribution: ${JSON.stringify(buckets)}\n`);
  // Preview top failed checks.
  const top = Object.entries(matrix)
    .map(([id, counts]) => ({ id, fail: counts.FAIL, needs: counts.NEEDS_REVIEW }))
    .filter((r) => r.fail > 0 || r.needs > 0)
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 5);
  if (top.length) {
    process.stdout.write(`- Top issues:\n`);
    for (const t of top) {
      process.stdout.write(`  - ${t.id}: FAIL=${t.fail}, NEEDS_REVIEW=${t.needs}\n`);
    }
  }
  process.stdout.write(`- Artifacts: ${path.join(root, "sites", domain, "analyses", id)}\n`);
}

async function cmdAddCompetitor(positional, flags) {
  const target = normalizeDomain(positional[0]);
  const competitor = positional[1];
  if (!target || !competitor) exitErr("add-competitor requires <target-domain> <competitor-url>");
  const root = resolveArtifactsDir(flags.artifacts);
  await ensureSiteDir(root, target);
  const list = await addCompetitor(root, target, competitor);
  process.stdout.write(`Competitors for ${target}: ${list.join(", ")}\n`);
  const compDomain = normalizeDomain(competitor);
  const compSite = await loadSite(root, compDomain);
  if (!compSite) {
    process.stdout.write(`Note: no crawl artifacts yet for ${compDomain}. Run /aiv-crawl https://${compDomain} before /aiv-compare.\n`);
  }
}

async function cmdCompare(positional, flags) {
  const target = normalizeDomain(positional[0]);
  if (!target) exitErr("compare requires a target domain");
  const root = resolveArtifactsDir(flags.artifacts);
  const targetAnalysis = await readLatestAnalysis(root, target);
  if (!targetAnalysis) exitErr(`no analysis artifacts for ${target}`);
  const compDomains = flags.competitors ? asList(flags.competitors).map(normalizeDomain) : await loadCompetitors(root, target);
  const competitors = [];
  for (const d of compDomains) {
    const a = await readLatestAnalysis(root, d);
    if (!a) {
      process.stdout.write(`Skipping competitor ${d}: no analysis artifacts.\n`);
      continue;
    }
    competitors.push({ domain: d, analysis: a });
  }
  const result = compareSites(targetAnalysis, competitors);
  const dir = await writeComparison(root, result);
  process.stdout.write(`Comparison complete: ${dir}\n`);
  if (result.warnings.length) {
    for (const w of result.warnings) process.stdout.write(`- warning: ${w}\n`);
  }
  process.stdout.write(`- Worse than competitors on ${result.targetWorse.length} check(s)\n`);
  process.stdout.write(`- Better than competitors on ${result.targetBetter.length} check(s)\n`);
}

async function cmdReport(positional, flags) {
  const target = normalizeDomain(positional[0]);
  if (!target) exitErr("report requires a target domain");
  const root = resolveArtifactsDir(flags.artifacts);
  const analysis = await readLatestAnalysis(root, target);
  if (!analysis) exitErr(`no analysis artifacts for ${target}`);
  const crawlData = await readLatestCrawl(root, target);
  let comparison = null;
  const compDomains = flags.competitors ? asList(flags.competitors).map(normalizeDomain) : [];
  if (compDomains.length) {
    const competitors = [];
    for (const d of compDomains) {
      const a = await readLatestAnalysis(root, d);
      if (a) competitors.push({ domain: d, analysis: a });
    }
    if (competitors.length) comparison = compareSites(analysis, competitors);
  }
  const format = flags.format || "md";
  if (format === "json") {
    const payload = {
      domain: target,
      generatedAt: new Date().toISOString(),
      plugin: PLUGIN,
      analysis: analysis.summary,
      verdicts: analysis.verdicts,
      crawlStats: crawlData?.stats || null,
      comparison
    };
    const filePath = await writeReport(root, target, `${JSON.stringify(payload, null, 2)}\n`, "json");
    process.stdout.write(`Report written: ${filePath}\n`);
    return;
  }
  const md = buildReportMarkdown({
    domain: target,
    analysis,
    crawlStats: crawlData?.stats || null,
    comparison,
    plugin: PLUGIN
  });
  const filePath = await writeReport(root, target, md, "md");
  process.stdout.write(`Report written: ${filePath}\n`);
}

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

async function cmdStatus(positional, flags) {
  const root = resolveArtifactsDir(flags.artifacts);
  const sitesDir = path.join(root, "sites");
  let entries = [];
  try { entries = await fs.readdir(sitesDir, { withFileTypes: true }); } catch {}
  if (!entries.length) {
    process.stdout.write(`No artifacts under ${root}.\n`);
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const domain = e.name;
    if (positional[0] && normalizeDomain(positional[0]) !== domain) continue;
    const site = await loadSite(root, domain);
    process.stdout.write(`${domain}: lastCrawlRun=${site?.lastCrawlRun || "—"}, lastAnalysis=${site?.lastAnalysis || "—"}\n`);
  }
}

async function main() {
  const [, , subcommand, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);
  switch (subcommand) {
    case "checklist":
      return cmdChecklist();
    case "doctor":
      return cmdDoctor();
    case "crawl":
      return cmdCrawl(positional, flags);
    case "analyze":
      return cmdAnalyze(positional, flags);
    case "add-competitor":
      return cmdAddCompetitor(positional, flags);
    case "compare":
      return cmdCompare(positional, flags);
    case "report":
      return cmdReport(positional, flags);
    case "status":
      return cmdStatus(positional, flags);
    case "priority":
      return cmdPriority(positional, flags);
    default:
      process.stderr.write(`unknown command: ${subcommand || "(none)"}\n`);
      process.stderr.write(`usage: aiv <checklist|doctor|crawl|analyze|add-competitor|compare|report|status|priority> [options]\n`);
      process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.stack || err.message || err}\n`);
  process.exit(1);
});
