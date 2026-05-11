import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePage, bucketFor, severityWeight } from "../lib/scoring.mjs";

test("severityWeight returns the documented weights", () => {
  assert.equal(severityWeight("Critical"), 5);
  assert.equal(severityWeight("High"), 4);
  assert.equal(severityWeight("Medium"), 2);
  assert.equal(severityWeight("Low"), 1);
});

test("scorePage starts at 100 with no fails", () => {
  const score = scorePage([
    { checkId: "AIVB-001", value: "PASS", severity: "Critical" }
  ]);
  assert.equal(score, 100);
});

test("scorePage subtracts severity weight per FAIL", () => {
  const score = scorePage([
    { checkId: "AIVB-001", value: "FAIL", severity: "Critical" },
    { checkId: "AIVB-002", value: "PASS", severity: "High" }
  ]);
  assert.equal(score, 95);
});

test("scorePage applies 0.5 penalty per NEEDS_REVIEW", () => {
  const score = scorePage([
    { checkId: "AIVB-012", value: "NEEDS_REVIEW", severity: "Medium" },
    { checkId: "AIVB-013", value: "NEEDS_REVIEW", severity: "Medium" }
  ]);
  assert.equal(score, 99);
});

test("scorePage clamps to [0, 100]", () => {
  const verdicts = Array.from({ length: 30 }, (_, i) => ({
    checkId: `AIVB-${String(i + 1).padStart(3, "0")}`,
    value: "FAIL",
    severity: "Critical"
  }));
  assert.equal(scorePage(verdicts), 0);
});

test("bucketFor uses documented boundaries", () => {
  assert.equal(bucketFor(95), "high");
  assert.equal(bucketFor(94.99), "average");
  assert.equal(bucketFor(90), "average");
  assert.equal(bucketFor(89.99), "low");
  assert.equal(bucketFor(80), "low");
  assert.equal(bucketFor(79.99), "bad");
  assert.equal(bucketFor(60), "bad");
  assert.equal(bucketFor(59.99), "very_bad");
  assert.equal(bucketFor(0), "very_bad");
});
