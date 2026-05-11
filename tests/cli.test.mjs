import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin", "aiv.mjs");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd: ROOT, ...opts });
}

test("checklist command exits 0 and prints AIVB ids", () => {
  const r = run(["checklist"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /AIVB-001/);
  assert.match(r.stdout, /AIVB-036/);
  // Must not list Sxxx as primary id in the printed table.
  const idCount = (r.stdout.match(/AIVB-\d{3}/g) || []).length;
  assert.ok(idCount >= 36, `expected at least 36 AIVB ids in output, got ${idCount}`);
});

test("doctor command exits 0", () => {
  const r = run(["doctor"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK|ok|pass/i);
});

test("unknown command exits non-zero", () => {
  const r = run(["nope"]);
  assert.notEqual(r.status, 0);
});

test("end-to-end fixture pipeline", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aivb-cli-"));
  const fixtureSite = path.join(ROOT, "tests", "fixtures", "site");

  const crawl = run([
    "crawl", fixtureSite,
    "--limit", "20",
    "--out", tmp
  ]);
  assert.equal(crawl.status, 0, crawl.stderr);

  const analyze = run([
    "analyze", "fixture.local",
    "--all",
    "--artifacts", tmp
  ]);
  assert.equal(analyze.status, 0, analyze.stderr);

  const report = run([
    "report", "fixture.local",
    "--artifacts", tmp,
    "--format", "md"
  ]);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout + report.stderr, /Report written|reports\//);
});

test("/aiv-analyze --thorough writes needs-review-queue.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aivb-thorough-"));
  const fixtureSite = path.join(ROOT, "tests", "fixtures", "site");
  try {
    const crawl = run(["crawl", fixtureSite, "--limit", "5", "--out", tmp]);
    assert.equal(crawl.status, 0, crawl.stderr);
    const analyze = run(["analyze", "fixture.local", "--all", "--thorough", "--artifacts", tmp]);
    assert.equal(analyze.status, 0, analyze.stderr);
    const analysesDir = path.join(tmp, "sites", "fixture.local", "analyses");
    const ids = (await fs.readdir(analysesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const last = ids[ids.length - 1];
    const queuePath = path.join(analysesDir, last, "needs-review-queue.json");
    const raw = await fs.readFile(queuePath, "utf8");
    const queue = JSON.parse(raw);
    assert.ok(Array.isArray(queue), "queue should be an array");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("end-to-end: crawl -> analyze -> priority writes priority.html and priority.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aivb-e2e-priority-"));
  const fixtureSite = path.join(ROOT, "tests", "fixtures", "site");
  try {
    assert.equal(run(["crawl", fixtureSite, "--limit", "5", "--out", tmp]).status, 0);
    assert.equal(run(["analyze", "fixture.local", "--all", "--artifacts", tmp]).status, 0);
    const priority = run(["priority", "fixture.local", "--artifacts", tmp]);
    assert.equal(priority.status, 0, priority.stderr);
    assert.match(priority.stdout, /Priority report written:.*priority\.html/);
    assert.match(priority.stdout, /Priority JSON written:.*priority\.json/);
    assert.match(priority.stdout, /Rows: 35/);
    assert.match(priority.stdout, /Buckets:/);
    const reportsDir = path.join(tmp, "reports");
    const files = await fs.readdir(reportsDir);
    assert.ok(files.some((f) => f.endsWith("-priority.html")), `expected priority.html in ${files.join(",")}`);
    assert.ok(files.some((f) => f.endsWith("-priority.json")), `expected priority.json in ${files.join(",")}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
