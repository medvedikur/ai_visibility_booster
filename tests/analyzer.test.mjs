import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPage } from "../lib/extract-page.mjs";
import { analyzePage } from "../lib/analyzer.mjs";
import { CHECKS } from "../lib/checks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, "fixtures");

const VALID = new Set(["PASS", "FAIL", "N/A", "NEEDS_REVIEW"]);

async function loadPage(name, url) {
  const html = await fs.readFile(path.join(FIX, name), "utf8");
  return extractPage(html, url);
}

function buildContext(overrides = {}) {
  return {
    httpStatus: 200,
    fetchedOk: true,
    inSitemap: true,
    hasInternalInboundLink: true,
    sameOriginPages: [],
    ...overrides
  };
}

test("returns one verdict per check, all use AIVB-xxx ids", async () => {
  const page = await loadPage("passing-page.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext());
  assert.equal(verdicts.length, 36);
  for (const v of verdicts) {
    assert.match(v.checkId, /^AIVB-\d{3}$/);
    assert.ok(VALID.has(v.value), `bad value ${v.value}`);
    if (v.value === "PASS" || v.value === "FAIL" || v.value === "NEEDS_REVIEW") {
      assert.ok(typeof v.evidence === "string" && v.evidence.length > 0,
        `${v.checkId}: evidence required for ${v.value}`);
    }
  }
});

test("every AIVB check is exercised by at least one fixture", async () => {
  const passing = await loadPage("passing-page.html", "https://example.com/services/qa-outsourcing");
  const failing = await loadPage("failing-page.html", "https://example.com/internal");
  const media = await loadPage("media-page.html", "https://example.com/case-study");
  const schema = await loadPage("schema-page.html", "https://example.com/blog/post");
  const forms = await loadPage("forms-page.html", "https://example.com/contact");

  const all = [
    analyzePage(passing, buildContext()),
    analyzePage(failing, buildContext({
      httpStatus: 404,
      fetchedOk: false,
      inSitemap: false,
      hasInternalInboundLink: false
    })),
    analyzePage(media, buildContext()),
    analyzePage(schema, buildContext()),
    analyzePage(forms, buildContext())
  ];

  const exercised = new Set();
  for (const verdicts of all) {
    for (const v of verdicts) exercised.add(v.checkId);
  }
  for (const c of CHECKS) {
    assert.ok(exercised.has(c.id), `${c.id} not exercised by any fixture`);
  }
});

test("AIVB-005 FAILs when noindex present", async () => {
  const page = await loadPage("failing-page.html", "https://example.com/internal");
  const verdicts = analyzePage(page, buildContext({ httpStatus: 200, fetchedOk: true }));
  const v = verdicts.find((x) => x.checkId === "AIVB-005");
  assert.equal(v.value, "FAIL");
});

test("AIVB-006 FAILs when nosnippet present", async () => {
  const page = await loadPage("failing-page.html", "https://example.com/internal");
  const verdicts = analyzePage(page, buildContext({ httpStatus: 200, fetchedOk: true }));
  const v = verdicts.find((x) => x.checkId === "AIVB-006");
  assert.equal(v.value, "FAIL");
});

test("AIVB-001 FAILs when fetch returned non-2xx", async () => {
  const page = await loadPage("passing-page.html", "https://example.com/x");
  const verdicts = analyzePage(page, buildContext({ httpStatus: 500, fetchedOk: false }));
  const v = verdicts.find((x) => x.checkId === "AIVB-001");
  assert.equal(v.value, "FAIL");
});

test("AIVB-007 PASSes when one H1 present", async () => {
  const page = await loadPage("passing-page.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-007");
  assert.equal(v.value, "PASS");
});

test("AIVB-019 FAILs when meaningful images missing alt", async () => {
  const page = await loadPage("media-page.html", "https://example.com/case-study");
  const verdicts = analyzePage(page, buildContext());
  const v = verdicts.find((x) => x.checkId === "AIVB-019");
  assert.equal(v.value, "FAIL");
});

test("verdicts include sourceId for traceability", async () => {
  const page = await loadPage("passing-page.html", "https://example.com/services/qa-outsourcing");
  const verdicts = analyzePage(page, buildContext());
  for (const v of verdicts) {
    assert.match(v.sourceId, /^S\d{3}$/, `${v.checkId} should expose sourceId provenance`);
  }
});
