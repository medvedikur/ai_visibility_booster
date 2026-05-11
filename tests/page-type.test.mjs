import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPageType, isExpertiseSensitive } from "../lib/page-type.mjs";

function snapshot(over = {}) {
  return {
    url: "https://example.com/",
    jsonLdTypes: [],
    headings: { h1: [], h2: [] },
    title: "",
    bodyTextLength: 600,
    ...over
  };
}

test("classifies services/, solutions/, industries/, products/ as 'service'", () => {
  for (const p of ["/services/qa-outsourcing", "/solutions/cloud", "/industries/banking", "/products/widget"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "service");
  }
});

test("classifies /about, /contact, /careers as 'corporate'", () => {
  for (const p of ["/about-us", "/contact", "/careers"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "corporate");
  }
});

test("classifies /privacy, /legal, /terms, /cookies as 'legal'", () => {
  for (const p of ["/privacy", "/legal", "/terms-of-use", "/cookies"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "legal");
  }
});

test("classifies /blog/*, /news/*, /insights/* as 'article'", () => {
  for (const p of ["/blog/post-1", "/news/2026-event", "/insights/whitepaper"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "article");
  }
});

test("classifies /portfolio/, /case-studies/, /case-study/ as 'case'", () => {
  for (const p of ["/portfolio/community-portal", "/case-studies/bank", "/case-study/abc"]) {
    assert.equal(classifyPageType(snapshot({ url: `https://x.com${p}` })), "case");
  }
});

test("uses JSON-LD @type as a fallback signal when URL is ambiguous", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["Article"] })), "article");
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["NewsArticle"] })), "article");
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo", jsonLdTypes: ["Service"] })), "service");
});

test("falls back to 'other' when nothing matches", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/foo" })), "other");
});

test("homepage / classifies as 'home'", () => {
  assert.equal(classifyPageType(snapshot({ url: "https://x.com/" })), "home");
});

test("isExpertiseSensitive returns true for article/case/event and false for service/legal/home/corporate/other", () => {
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/blog/post" })), true);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/case-studies/x" })), true);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/services/qa" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/privacy" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/about" })), false);
  assert.equal(isExpertiseSensitive(snapshot({ url: "https://x.com/foo" })), false);
});
