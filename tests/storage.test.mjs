import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  ensureSiteDir,
  writeCrawlRun,
  writeAnalysis,
  readLatestCrawl,
  readLatestAnalysis,
  addCompetitor,
  loadCompetitors
} from "../lib/storage.mjs";

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "aivb-store-"));
}

test("ensureSiteDir creates the expected layout", async () => {
  const root = await tempDir();
  const dir = await ensureSiteDir(root, "example.com");
  const stat = await fs.stat(dir);
  assert.ok(stat.isDirectory());
  assert.ok(await fs.stat(path.join(dir, "crawl-runs")));
  assert.ok(await fs.stat(path.join(dir, "analyses")));
});

test("writeCrawlRun and readLatestCrawl round-trip", async () => {
  const root = await tempDir();
  await ensureSiteDir(root, "example.com");
  const stats = { totalCandidates: 10, fetched: 8 };
  const urls = [{ url: "https://example.com/", status: 200 }];
  const pages = [{ url: "https://example.com/", title: "Home" }];
  const runId = await writeCrawlRun(root, "example.com", { stats, urls, pages });
  assert.match(runId, /^[\dT\-Z.:]+$/);
  const latest = await readLatestCrawl(root, "example.com");
  assert.equal(latest.stats.totalCandidates, 10);
  assert.equal(latest.urls.length, 1);
  assert.equal(latest.pages[0].title, "Home");
});

test("writeAnalysis and readLatestAnalysis round-trip", async () => {
  const root = await tempDir();
  await ensureSiteDir(root, "example.com");
  const id = await writeAnalysis(root, "example.com", {
    input: { urls: ["https://example.com/"], mode: "all" },
    verdicts: [{ url: "https://example.com/", verdicts: [{ checkId: "AIVB-001", value: "PASS", evidence: "200 OK" }] }],
    summary: { pages: 1, passRate: 1 },
    matrix: { "AIVB-001": { PASS: 1 } }
  });
  assert.match(id, /^[\dT\-Z.:]+$/);
  const latest = await readLatestAnalysis(root, "example.com");
  assert.equal(latest.summary.pages, 1);
});

test("addCompetitor and loadCompetitors round-trip", async () => {
  const root = await tempDir();
  await ensureSiteDir(root, "example.com");
  await addCompetitor(root, "example.com", "https://competitor1.com");
  await addCompetitor(root, "example.com", "https://competitor2.com");
  const list = await loadCompetitors(root, "example.com");
  assert.deepEqual(list.sort(), ["competitor1.com", "competitor2.com"]);
});
