import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripWww,
  isWwwAliasHost,
  hostAliasesFor,
  isAllowedCrawlHost
} from "../lib/crawler.mjs";

test("stripWww removes a leading www. and lowercases", () => {
  assert.equal(stripWww("www.site.com"), "site.com");
  assert.equal(stripWww("site.com"), "site.com");
  assert.equal(stripWww("WWW.SITE.COM"), "site.com");
  assert.equal(stripWww("www.sub.site.com"), "sub.site.com");
  assert.equal(stripWww(""), "");
  assert.equal(stripWww(null), "");
});

test("isWwwAliasHost recognises apex/www aliases only", () => {
  assert.equal(isWwwAliasHost("site.com", "www.site.com"), true);
  assert.equal(isWwwAliasHost("www.site.com", "site.com"), true);
  assert.equal(isWwwAliasHost("site.com", "evil.com"), false);
  // Same string is not an alias of itself.
  assert.equal(isWwwAliasHost("site.com", "site.com"), false);
  assert.equal(isWwwAliasHost("", "site.com"), false);
  assert.equal(isWwwAliasHost("site.com", ""), false);
});

test("hostAliasesFor expands only when redirect proves apex/www alias", () => {
  assert.deepEqual(
    [...hostAliasesFor("site.com", "www.site.com")].sort(),
    ["site.com", "www.site.com"]
  );
  assert.deepEqual(
    [...hostAliasesFor("www.site.com", "site.com")].sort(),
    ["site.com", "www.site.com"]
  );
  // Unrelated canonical: do not expand crawl scope.
  assert.deepEqual(hostAliasesFor("site.com", "evil.com"), ["site.com"]);
  // No redirect / identical host: only requested host.
  assert.deepEqual(hostAliasesFor("site.com", "site.com"), ["site.com"]);
  assert.deepEqual(hostAliasesFor("site.com", ""), ["site.com"]);
});

test("isAllowedCrawlHost accepts only listed aliases", () => {
  const aliases = ["site.com", "www.site.com"];
  assert.equal(isAllowedCrawlHost("site.com", aliases), true);
  assert.equal(isAllowedCrawlHost("www.site.com", aliases), true);
  assert.equal(isAllowedCrawlHost("WWW.SITE.COM", aliases), true);
  assert.equal(isAllowedCrawlHost("evil.com", aliases), false);
  assert.equal(isAllowedCrawlHost("sub.site.com", aliases), false);
  assert.equal(isAllowedCrawlHost("", aliases), false);
});
