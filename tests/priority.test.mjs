import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriorityRows, severityFactor, bucketForPriority } from "../lib/priority.mjs";

function verdict(checkId, value) {
  return { checkId, value };
}

function buildAnalysis(perPage) {
  return {
    verdicts: perPage.map((vs, i) => ({
      url: `https://example.com/p${i}`,
      verdicts: vs.map((v) => verdict(v.checkId, v.value))
    }))
  };
}

test("severityFactor returns Critical=1.0 / High=0.85 / Medium=0.7 / Low=0.5", () => {
  assert.equal(severityFactor("Critical"), 1.0);
  assert.equal(severityFactor("High"), 0.85);
  assert.equal(severityFactor("Medium"), 0.7);
  assert.equal(severityFactor("Low"), 0.5);
  assert.equal(severityFactor("Unknown"), 0);
});

test("bucketForPriority uses 50/20/5 thresholds", () => {
  assert.equal(bucketForPriority(100), "HIGH");
  assert.equal(bucketForPriority(50), "HIGH");
  assert.equal(bucketForPriority(49.99), "MEDIUM");
  assert.equal(bucketForPriority(20), "MEDIUM");
  assert.equal(bucketForPriority(19.99), "LOW");
  assert.equal(bucketForPriority(5), "LOW");
  assert.equal(bucketForPriority(4.99), "NONE");
  assert.equal(bucketForPriority(0), "NONE");
});

test("computePriorityRows returns one row per non-excluded check", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "PASS" }]
  ]));
  assert.equal(rows.length, 35);
  assert.ok(!rows.some((r) => r.checkId === "AIVB-029"));
});

test("computePriorityRows: all-PASS site -> every priority is 0 and bucket NONE", () => {
  const allChecks = Array.from({ length: 36 }, (_, i) => `AIVB-${String(i + 1).padStart(3, "0")}`);
  const pages = Array.from({ length: 3 }, () => allChecks.map((id) => ({ checkId: id, value: "PASS" })));
  const rows = computePriorityRows(buildAnalysis(pages));
  for (const r of rows) {
    assert.equal(r.priority, 0, `${r.checkId} should be 0`);
    assert.equal(r.bucket, "NONE");
    assert.equal(r.failPct, 0);
  }
});

test("computePriorityRows: 100% FAIL on a Critical check -> priority 100 / HIGH", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "FAIL" }],
    [{ checkId: "AIVB-001", value: "FAIL" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-001");
  assert.equal(row.failPct, 100);
  assert.equal(row.priority, 100);
  assert.equal(row.bucket, "HIGH");
});

test("computePriorityRows: 67% FAIL on a High check -> ~57 / HIGH", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-019", value: "FAIL" }],
    [{ checkId: "AIVB-019", value: "FAIL" }],
    [{ checkId: "AIVB-019", value: "PASS" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-019");
  assert.equal(row.failPct, Math.round((2 / 3) * 100));
  assert.ok(row.priority >= 55 && row.priority <= 58, `priority should be ~57, got ${row.priority}`);
  assert.equal(row.bucket, "HIGH");
});

test("computePriorityRows excludes NEEDS_REVIEW from the denominator", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-001", value: "FAIL" }],
    [{ checkId: "AIVB-001", value: "PASS" }],
    [{ checkId: "AIVB-001", value: "NEEDS_REVIEW" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-001");
  assert.equal(row.failPct, 50);
  assert.equal(row.needsReviewCount, 1);
});

test("computePriorityRows handles checks with all N/A: failPct null, bucket NONE", () => {
  const rows = computePriorityRows(buildAnalysis([
    [{ checkId: "AIVB-017", value: "N/A" }],
    [{ checkId: "AIVB-017", value: "N/A" }]
  ]));
  const row = rows.find((r) => r.checkId === "AIVB-017");
  assert.equal(row.failPct, null);
  assert.equal(row.priority, 0);
  assert.equal(row.bucket, "NONE");
  assert.match(row.note || "", /no applicable pages/i);
});

test("computePriorityRows sorts rows by priority desc, then failPct desc, then ID asc", () => {
  const rows = computePriorityRows(buildAnalysis([
    [
      { checkId: "AIVB-001", value: "FAIL" },
      { checkId: "AIVB-019", value: "FAIL" },
      { checkId: "AIVB-008", value: "FAIL" }
    ]
  ]));
  const top3 = rows.slice(0, 3).map((r) => r.checkId);
  assert.deepEqual(top3, ["AIVB-001", "AIVB-019", "AIVB-008"]);
});
