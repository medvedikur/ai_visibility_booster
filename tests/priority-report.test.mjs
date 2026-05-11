import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPriorityReportHtml } from "../lib/priority-report-html.mjs";

function row(over = {}) {
  return {
    checkId: "AIVB-001",
    sourceId: "S001",
    title: "HTTP success and clean access",
    severity: "Critical",
    severityFactor: 1.0,
    priorityProblem: "Page returns 4xx/5xx; bots skip it.",
    minimalFix: "Fix server config.",
    passCount: 0,
    failCount: 10,
    needsReviewCount: 0,
    naCount: 0,
    failPct: 100,
    priority: 100,
    bucket: "HIGH",
    note: "",
    ...over
  };
}

const CYRILLIC = /[Ѐ-ԯ]/;

test("HTML contains the domain in title and h1", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 10, totalUrls: 100, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /<title>AI Visibility fix-priority — example\.com<\/title>/);
  assert.match(html, /<h1>AI Visibility fix-priority — example\.com<\/h1>/);
});

test("HTML contains a bucket divider for every transition", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ priority: 100, bucket: "HIGH" }), row({ checkId: "AIVB-008", priority: 30, bucket: "MEDIUM" }), row({ checkId: "AIVB-022", priority: 10, bucket: "LOW" }), row({ checkId: "AIVB-002", priority: 0, bucket: "NONE" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /HIGH PRIORITY/);
  assert.match(html, /MEDIUM PRIORITY/);
  assert.match(html, /LOW PRIORITY/);
  assert.match(html, /NO PROBLEM/);
});

test("HTML contains 'What's wrong' and 'What to fix' for rows with failPct >= 5", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: 67, priority: 57, bucket: "HIGH" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /What.s wrong/);
  assert.match(html, /What to fix/);
});

test("HTML uses 'Not worth fixing' phrasing for failPct < 5", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: 2, priority: 0, bucket: "NONE" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /Not worth fixing/);
});

test("HTML uses 'No applicable pages' phrasing for failPct === null", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ failPct: null, priority: 0, bucket: "NONE", note: "No applicable pages on this site." })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /No applicable pages/);
});

test("HTML mentions AIVB-029 as excluded in the footer", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /AIVB-029/);
  assert.match(html, /Core Web Vitals/i);
  assert.match(html, /excluded/i);
});

test("HTML contains no Cyrillic characters anywhere", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row(), row({ checkId: "AIVB-019", priority: 100 })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.ok(!CYRILLIC.test(html), "HTML contains Cyrillic");
});

test("HTML warns when --thorough was not used", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row()],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 5, thorough: false },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /not LLM-resolved|--thorough/i);
});

test("HTML escapes <, >, and & in user-supplied text", () => {
  const html = buildPriorityReportHtml({
    domain: "example.com",
    rows: [row({ title: "Title with <tag> & ampersand" })],
    coverage: { pagesAnalyzed: 1, totalUrls: 1, residualNeedsReview: 0, thorough: true },
    plugin: { name: "ai-visibility-booster", version: "0.1.1" }
  });
  assert.match(html, /Title with &lt;tag&gt; &amp; ampersand/);
});
