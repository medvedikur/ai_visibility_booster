import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRobots, parseSitemap, normalizeUrl, dedupeByCanonical } from "../lib/crawler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, "fixtures");

test("parseRobots extracts sitemap URLs and disallow", async () => {
  const text = await fs.readFile(path.join(FIX, "robots.txt"), "utf8");
  const robots = parseRobots(text);
  assert.ok(robots.sitemaps.includes("https://example.com/sitemap.xml"));
  assert.ok(robots.disallow.length > 0);
});

test("parseSitemap collects URLs", async () => {
  const xml = await fs.readFile(path.join(FIX, "sitemap.xml"), "utf8");
  const urls = parseSitemap(xml);
  assert.ok(urls.includes("https://example.com/"));
  assert.ok(urls.includes("https://example.com/services/qa-outsourcing"));
  assert.ok(urls.length >= 3);
});

test("normalizeUrl strips fragments and trailing slash policy", () => {
  assert.equal(normalizeUrl("https://example.com/a#x"), "https://example.com/a");
  assert.equal(normalizeUrl("https://EXAMPLE.com/A?b=1"), "https://example.com/A?b=1");
});

test("dedupeByCanonical collapses duplicates", () => {
  const items = [
    { url: "https://example.com/a", canonical: "https://example.com/a" },
    { url: "https://example.com/a?utm=1", canonical: "https://example.com/a" },
    { url: "https://example.com/b", canonical: "https://example.com/b" }
  ];
  const out = dedupeByCanonical(items);
  assert.equal(out.length, 2);
});
