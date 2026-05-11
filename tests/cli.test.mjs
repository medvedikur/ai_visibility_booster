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
