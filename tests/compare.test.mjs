import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSites } from "../lib/compare.mjs";

function buildAnalysis(failsByCheck, pageCount) {
  const verdicts = [];
  for (let i = 0; i < pageCount; i++) {
    const pageVerdicts = [];
    for (const [checkId, fails] of Object.entries(failsByCheck)) {
      pageVerdicts.push({
        checkId,
        value: i < fails ? "FAIL" : "PASS",
        severity: "Medium"
      });
    }
    verdicts.push({
      url: `https://x/${i}`,
      verdicts: pageVerdicts
    });
  }
  return {
    summary: { pages: pageCount },
    verdicts
  };
}

test("computes per-check FAIL rates and delta", () => {
  const target = buildAnalysis({ "AIVB-019": 6 }, 10); // 60% FAIL
  const competitor = buildAnalysis({ "AIVB-019": 2 }, 10); // 20% FAIL
  const result = compareSites(target, [{ domain: "comp.com", analysis: competitor }]);
  const row = result.checks.find((c) => c.checkId === "AIVB-019");
  assert.ok(Math.abs(row.targetFailRate - 0.6) < 1e-6);
  const compRow = row.competitors.find((c) => c.domain === "comp.com");
  assert.ok(Math.abs(compRow.failRate - 0.2) < 1e-6);
  assert.ok(Math.abs(compRow.delta - 0.4) < 1e-6);
  assert.equal(compRow.confidence, "high");
});

test("warns when sample size is low", () => {
  const target = buildAnalysis({ "AIVB-019": 1 }, 3);
  const competitor = buildAnalysis({ "AIVB-019": 0 }, 3);
  const result = compareSites(target, [{ domain: "comp.com", analysis: competitor }]);
  const row = result.checks.find((c) => c.checkId === "AIVB-019");
  const compRow = row.competitors.find((c) => c.domain === "comp.com");
  assert.equal(compRow.confidence, "low");
  assert.ok(result.warnings.length > 0);
});

test("identifies target-worse and target-better gaps", () => {
  const target = buildAnalysis({ "AIVB-019": 8, "AIVB-020": 1 }, 10);
  const competitor = buildAnalysis({ "AIVB-019": 1, "AIVB-020": 8 }, 10);
  const result = compareSites(target, [{ domain: "comp.com", analysis: competitor }]);
  assert.ok(result.targetWorse.some((r) => r.checkId === "AIVB-019"));
  assert.ok(result.targetBetter.some((r) => r.checkId === "AIVB-020"));
});
