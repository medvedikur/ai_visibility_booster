import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripWww,
  isWwwAliasHost,
  hostAliasesFor,
  isAllowedCrawlHost
} from "../lib/crawler.mjs";

test("stripWww removes a leading www. and lowercases", () => {
  assert.equal(stripWww("www.a1qa.com"), "a1qa.com");
  assert.equal(stripWww("a1qa.com"), "a1qa.com");
  assert.equal(stripWww("WWW.A1QA.COM"), "a1qa.com");
  assert.equal(stripWww("www.sub.a1qa.com"), "sub.a1qa.com");
  assert.equal(stripWww(""), "");
  assert.equal(stripWww(null), "");
});

test("isWwwAliasHost recognises apex/www aliases only", () => {
  assert.equal(isWwwAliasHost("a1qa.com", "www.a1qa.com"), true);
  assert.equal(isWwwAliasHost("www.a1qa.com", "a1qa.com"), true);
  assert.equal(isWwwAliasHost("a1qa.com", "evil.com"), false);
  // Same string is not an alias of itself.
  assert.equal(isWwwAliasHost("a1qa.com", "a1qa.com"), false);
  assert.equal(isWwwAliasHost("", "a1qa.com"), false);
  assert.equal(isWwwAliasHost("a1qa.com", ""), false);
});

test("hostAliasesFor expands only when redirect proves apex/www alias", () => {
  assert.deepEqual(
    [...hostAliasesFor("a1qa.com", "www.a1qa.com")].sort(),
    ["a1qa.com", "www.a1qa.com"]
  );
  assert.deepEqual(
    [...hostAliasesFor("www.a1qa.com", "a1qa.com")].sort(),
    ["a1qa.com", "www.a1qa.com"]
  );
  // Unrelated canonical: do not expand crawl scope.
  assert.deepEqual(hostAliasesFor("a1qa.com", "evil.com"), ["a1qa.com"]);
  // No redirect / identical host: only requested host.
  assert.deepEqual(hostAliasesFor("a1qa.com", "a1qa.com"), ["a1qa.com"]);
  assert.deepEqual(hostAliasesFor("a1qa.com", ""), ["a1qa.com"]);
});

test("isAllowedCrawlHost accepts only listed aliases", () => {
  const aliases = ["a1qa.com", "www.a1qa.com"];
  assert.equal(isAllowedCrawlHost("a1qa.com", aliases), true);
  assert.equal(isAllowedCrawlHost("www.a1qa.com", aliases), true);
  assert.equal(isAllowedCrawlHost("WWW.A1QA.COM", aliases), true);
  assert.equal(isAllowedCrawlHost("evil.com", aliases), false);
  assert.equal(isAllowedCrawlHost("sub.a1qa.com", aliases), false);
  assert.equal(isAllowedCrawlHost("", aliases), false);
});
