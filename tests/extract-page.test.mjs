import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPage } from "../lib/extract-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, "fixtures");

async function load(name) {
  return fs.readFile(path.join(FIX, name), "utf8");
}

test("extracts title, canonical, lang, robots", async () => {
  const html = await load("passing-page.html");
  const page = extractPage(html, "https://example.com/services/qa-outsourcing");
  assert.equal(page.title, "QA Outsourcing Services");
  assert.equal(page.canonical, "https://example.com/services/qa-outsourcing");
  assert.equal(page.lang, "en");
  assert.equal(page.metaRobots, "index,follow");
  assert.equal(page.ogTitle, "QA Outsourcing Services");
  assert.equal(page.ogImage, "https://example.com/og/qa.jpg");
});

test("collects headings hierarchy", async () => {
  const html = await load("passing-page.html");
  const page = extractPage(html, "https://example.com/services/qa-outsourcing");
  assert.equal(page.headings.h1.length, 1);
  assert.equal(page.headings.h1[0], "QA Outsourcing Services");
  assert.ok(page.headings.h2.length >= 2);
  assert.ok(page.headings.h3.length >= 1);
});

test("counts internal links, lists, tables, sentences", async () => {
  const html = await load("passing-page.html");
  const page = extractPage(html, "https://example.com/services/qa-outsourcing");
  assert.ok(page.links.length >= 3, "links should include internal anchors");
  assert.ok(page.listCount >= 1, "lists should be counted");
  assert.ok(page.tableCount >= 0);
  assert.ok(page.averageSentenceWords > 0);
});

test("parses images with src/alt/filename", async () => {
  const html = await load("media-page.html");
  const page = extractPage(html, "https://example.com/case-study");
  const filenames = page.images.map((i) => i.filename);
  assert.ok(filenames.includes("hero-banner.jpg"));
  assert.ok(filenames.includes("770x500.png"));
  assert.ok(page.images.some((i) => i.alt === ""), "decorative img has empty alt");
  assert.ok(page.images.some((i) => i.srcEmpty === true), "empty src placeholder");
});

test("parses JSON-LD types and dates", async () => {
  const html = await load("schema-page.html");
  const page = extractPage(html, "https://example.com/blog/post");
  assert.ok(page.jsonLdTypes.includes("Article"));
  assert.ok(page.jsonLdDates.length > 0);
  assert.ok(page.jsonLdDates.some((d) => d.includes("dateModified=")));
});

test("parses forms, inputs, labels, buttons, aria", async () => {
  const html = await load("forms-page.html");
  const page = extractPage(html, "https://example.com/contact");
  assert.ok(page.forms.length >= 1);
  assert.ok(page.unlabeledFormFields >= 1, "should detect unlabeled input");
  assert.ok(page.totalControlsScanned >= 2);
});

test("detects breadcrumbs visually and via schema", async () => {
  const html = await load("schema-page.html");
  const page = extractPage(html, "https://example.com/blog/post");
  assert.equal(page.hasBreadcrumbList, true);
});

test("detects noindex and nosnippet directives", async () => {
  const html = await load("failing-page.html");
  const page = extractPage(html, "https://example.com/internal");
  assert.equal(page.metaRobots.includes("noindex"), true);
  assert.equal(page.metaRobots.includes("nosnippet"), true);
});

test("extracts hreflang and og:image", async () => {
  const html = await load("schema-page.html");
  const page = extractPage(html, "https://example.com/blog/post");
  assert.ok(page.hreflang.length >= 1);
});
