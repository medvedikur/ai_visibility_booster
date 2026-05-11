import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeAnalysis } from "../lib/judge.mjs";

function pageVerdicts(checkValues) {
  return Object.entries(checkValues).map(([checkId, value]) => ({
    checkId,
    sourceId: checkId.replace("AIVB-", "S"),
    severity: "Medium",
    value,
    evidence: "heuristic evidence"
  }));
}

test("judgeAnalysis upgrades NEEDS_REVIEW to PASS/FAIL using invoke return value", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-001": "PASS" }) },
      { url: "https://x/2", hash: "h2", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-001": "PASS" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" }, h2: { url: "https://x/2" } };
  const calls = [];
  const invoke = async ({ pageUrl, checkId }) => {
    calls.push({ pageUrl, checkId });
    return { value: "FAIL", evidence: "judge says fail", confidence: 0.9 };
  };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(result.judged, 2);
  assert.equal(result.unchanged, 0);
  assert.equal(calls.length, 2);
  for (const page of result.analysis.verdicts) {
    const v = page.verdicts.find((x) => x.checkId === "AIVB-012");
    assert.equal(v.value, "FAIL");
    assert.equal(v.judgedBy, "aiv-page-auditor");
    assert.equal(v.evidence, "judge says fail");
  }
});

test("judgeAnalysis preserves NEEDS_REVIEW when invoke throws", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  const invoke = async () => { throw new Error("agent unavailable"); };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  const v = result.analysis.verdicts[0].verdicts[0];
  assert.equal(v.value, "NEEDS_REVIEW");
  assert.match(v.evidence, /agent unavailable|judge failed/);
  assert.equal(result.failed, 1);
});

test("judgeAnalysis does not call invoke for PASS/FAIL/N/A verdicts", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-001": "PASS", "AIVB-002": "FAIL", "AIVB-003": "N/A" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  let calls = 0;
  const invoke = async () => { calls += 1; return { value: "PASS", evidence: "x" }; };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(calls, 0);
  assert.equal(result.judged, 0);
});

test("judgeAnalysis returns residualNeedsReview count for the coverage block", async () => {
  const analysis = {
    verdicts: [
      { url: "https://x/1", hash: "h1", verdicts: pageVerdicts({ "AIVB-012": "NEEDS_REVIEW", "AIVB-013": "NEEDS_REVIEW" }) }
    ]
  };
  const snapshots = { h1: { url: "https://x/1" } };
  const invoke = async ({ checkId }) => {
    if (checkId === "AIVB-012") return { value: "PASS", evidence: "ok" };
    return null;
  };
  const result = await judgeAnalysis({ analysis, snapshots, invoke });
  assert.equal(result.judged, 1);
  assert.equal(result.residualNeedsReview, 1);
});
