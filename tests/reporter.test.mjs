import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportMarkdown } from "../lib/reporter.mjs";

const sampleAnalysis = {
  summary: {
    pages: 5,
    averageScore: 82,
    bucketCounts: { very_bad: 0, bad: 1, low: 2, average: 1, high: 1 },
    checkSummary: {
      "AIVB-001": { PASS: 5 },
      "AIVB-019": { FAIL: 4, PASS: 1 }
    }
  },
  verdicts: [
    { url: "https://example.com/a", score: 92, verdicts: [
      { checkId: "AIVB-019", value: "FAIL", severity: "High", evidence: "alt missing on hero", minimalFix: "Add alt" }
    ]}
  ]
};

test("report contains required sections", () => {
  const md = buildReportMarkdown({
    domain: "example.com",
    analysis: sampleAnalysis,
    crawlStats: { totalCandidates: 200, fetched: 180 },
    comparison: null,
    plugin: { name: "ai-visibility-booster", version: "0.1.0" }
  });
  assert.match(md, /AI Visibility Booster Report/);
  assert.match(md, /example\.com/);
  assert.match(md, /Crawl coverage/i);
  assert.match(md, /36-check summary/i);
  assert.match(md, /Top problem areas/i);
  assert.match(md, /Minimal fix recommendations/i);
  assert.match(md, /Caveats/i);
});

test("report uses AIVB-xxx IDs as primary", () => {
  const md = buildReportMarkdown({
    domain: "example.com",
    analysis: sampleAnalysis,
    crawlStats: { totalCandidates: 200, fetched: 180 },
    comparison: null,
    plugin: { name: "ai-visibility-booster", version: "0.1.0" }
  });
  assert.match(md, /AIVB-019/);
  // Sxxx must not appear as a primary section heading.
  const lines = md.split("\n");
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      assert.doesNotMatch(line, /\bS\d{3}\b/, `Sxxx in heading: ${line}`);
    }
  }
});

test("report includes competitor section when comparison provided", () => {
  const comparison = {
    targetDomain: "example.com",
    competitors: [{ domain: "comp.com", pages: 5 }],
    targetWorse: [{ checkId: "AIVB-019", competitor: "comp.com", delta: 0.4 }],
    targetBetter: [],
    warnings: [],
    checks: []
  };
  const md = buildReportMarkdown({
    domain: "example.com",
    analysis: sampleAnalysis,
    crawlStats: { totalCandidates: 200, fetched: 180 },
    comparison,
    plugin: { name: "ai-visibility-booster", version: "0.1.0" }
  });
  assert.match(md, /Competitor comparison/i);
  assert.match(md, /comp\.com/);
});
