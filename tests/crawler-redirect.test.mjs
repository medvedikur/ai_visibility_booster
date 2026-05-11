import { test } from "node:test";
import assert from "node:assert/strict";
import { crawl } from "../lib/crawler.mjs";

function jsonHeaders(ct) {
  return { "Content-Type": ct };
}

function makeStubFetch(routes) {
  return async function stubFetch(url, _opts) {
    const route = routes[url];
    if (!route) {
      const res = new Response("", { status: 404, headers: jsonHeaders("text/plain") });
      Object.defineProperty(res, "url", { value: url, configurable: true });
      Object.defineProperty(res, "redirected", { value: false, configurable: true });
      return res;
    }
    if (route.redirectTo) {
      // Simulate transparent redirect: final URL points to redirectTo, body
      // is the body of the destination resource.
      const child = routes[route.redirectTo];
      const body = child?.body ?? "";
      const status = child?.status ?? 200;
      const headers = jsonHeaders(child?.contentType || "text/html");
      const res = new Response(body, { status, headers });
      Object.defineProperty(res, "url", { value: route.redirectTo, configurable: true });
      Object.defineProperty(res, "redirected", { value: true, configurable: true });
      return res;
    }
    const status = route.status ?? 200;
    const body = route.body ?? "";
    const headers = jsonHeaders(route.contentType || "text/html");
    const res = new Response(body, { status, headers });
    Object.defineProperty(res, "url", { value: route.finalUrl || url, configurable: true });
    Object.defineProperty(res, "redirected", { value: Boolean(route.redirected), configurable: true });
    return res;
  };
}

test("apex-to-www: crawl follows seed redirect, adopts canonical host, discovers >1 URL", async () => {
  const apex = "https://apex.local";
  const www = "https://www.apex.local";
  const routes = {
    [`${apex}/`]: { redirectTo: `${www}/` },
    // Robots/sitemap on apex should not be relied on after canonical redirect.
    [`${apex}/robots.txt`]: { status: 200, body: "" },
    [`${www}/`]: {
      status: 200,
      body: `<html><body>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="https://evil.local/">Evil</a>
      </body></html>`
    },
    [`${www}/robots.txt`]: { status: 200, body: `Sitemap: ${www}/sitemap.xml\n` },
    [`${www}/sitemap.xml`]: {
      status: 200,
      contentType: "application/xml",
      body: `<?xml version="1.0"?><urlset>
        <url><loc>${www}/about</loc></url>
        <url><loc>${www}/contact</loc></url>
        <url><loc>${www}/services</loc></url>
      </urlset>`
    },
    [`${www}/about`]: { status: 200, body: "<html><body>about</body></html>" },
    [`${www}/contact`]: { status: 200, body: "<html><body>contact</body></html>" },
    [`${www}/services`]: { status: 200, body: "<html><body>services</body></html>" }
  };

  const result = await crawl({
    seed: `${apex}/`,
    limit: 50,
    depth: 2,
    sleepMs: 0,
    fetchImpl: makeStubFetch(routes)
  });

  assert.equal(result.stats.seedUrl, `${apex}/`);
  assert.equal(result.stats.requestedOrigin, apex);
  assert.equal(result.stats.requestedHost, "apex.local");
  assert.equal(result.stats.canonicalHost, "www.apex.local");
  assert.equal(result.stats.crawlOrigin, www);
  assert.equal(result.stats.redirectedSeed, true);
  assert.match(result.stats.seedFinalUrl, /^https:\/\/www\.apex\.local/);
  assert.deepEqual([...result.stats.hostAliases].sort(), ["apex.local", "www.apex.local"]);
  assert.ok(Array.isArray(result.stats.warnings));

  assert.ok(result.stats.totalCandidates > 1, `totalCandidates=${result.stats.totalCandidates}`);
  assert.ok(result.stats.fetched > 1, `fetched=${result.stats.fetched}`);

  const hostsSeen = new Set(result.urls.map((u) => new URL(u.url).hostname));
  assert.ok(hostsSeen.has("www.apex.local"), `expected www.apex.local URLs, got ${[...hostsSeen]}`);
  assert.ok(!hostsSeen.has("evil.local"), `unexpected unrelated host enqueued: ${[...hostsSeen]}`);
});

test("apex-to-unrelated-host: redirect does not expand crawl scope", async () => {
  const routes = {
    "https://target.local/": { redirectTo: "https://unrelated.local/" },
    "https://unrelated.local/": {
      status: 200,
      body: '<html><body><a href="/leak">x</a></body></html>'
    },
    "https://target.local/robots.txt": { status: 404, body: "" },
    "https://target.local/sitemap.xml": { status: 404, body: "" }
  };

  const result = await crawl({
    seed: "https://target.local/",
    limit: 20,
    depth: 2,
    sleepMs: 0,
    fetchImpl: makeStubFetch(routes)
  });

  assert.equal(result.stats.requestedHost, "target.local");
  assert.equal(result.stats.canonicalHost, "unrelated.local");
  assert.equal(result.stats.redirectedSeed, true);
  assert.deepEqual(result.stats.hostAliases, ["target.local"]);
  assert.equal(result.stats.crawlOrigin, "https://target.local");
  assert.ok(
    (result.stats.warnings || []).some((w) => /unrelated|host/i.test(w)),
    `expected unrelated-host warning, got ${JSON.stringify(result.stats.warnings)}`
  );

  const hosts = new Set(result.urls.map((u) => new URL(u.url).hostname));
  assert.ok(!hosts.has("unrelated.local"), `unrelated host present: ${[...hosts]}`);
});

test("crawl artifact stats expose canonical host metadata", async () => {
  const apex = "https://artifacts.local";
  const www = "https://www.artifacts.local";
  const routes = {
    [`${apex}/`]: { redirectTo: `${www}/` },
    [`${www}/`]: { status: 200, body: "<html><body>root</body></html>" },
    [`${www}/robots.txt`]: { status: 404, body: "" },
    [`${www}/sitemap.xml`]: { status: 404, body: "" }
  };
  const result = await crawl({
    seed: `${apex}/`,
    limit: 5,
    depth: 0,
    sleepMs: 0,
    fetchImpl: makeStubFetch(routes)
  });
  for (const field of [
    "seedUrl",
    "seedFinalUrl",
    "requestedOrigin",
    "crawlOrigin",
    "requestedHost",
    "canonicalHost",
    "hostAliases",
    "redirectedSeed",
    "warnings"
  ]) {
    assert.ok(field in result.stats, `stats missing ${field}`);
  }
});

test("sitemap index recursion enqueues page URLs from child sitemaps", async () => {
  const base = "https://idx.local";
  const routes = {
    [`${base}/`]: { status: 200, body: "<html><body>root</body></html>" },
    [`${base}/robots.txt`]: { status: 200, body: `Sitemap: ${base}/sitemap.xml\n` },
    [`${base}/sitemap.xml`]: {
      status: 200,
      contentType: "application/xml",
      body: `<?xml version="1.0"?><sitemapindex>
        <sitemap><loc>${base}/sitemap-1.xml</loc></sitemap>
        <sitemap><loc>${base}/sitemap-2.xml</loc></sitemap>
      </sitemapindex>`
    },
    [`${base}/sitemap-1.xml`]: {
      status: 200,
      contentType: "application/xml",
      body: `<?xml version="1.0"?><urlset>
        <url><loc>${base}/a</loc></url>
        <url><loc>${base}/b</loc></url>
      </urlset>`
    },
    [`${base}/sitemap-2.xml`]: {
      status: 200,
      contentType: "application/xml",
      body: `<?xml version="1.0"?><urlset>
        <url><loc>${base}/c</loc></url>
      </urlset>`
    },
    [`${base}/a`]: { status: 200, body: "<html>a</html>" },
    [`${base}/b`]: { status: 200, body: "<html>b</html>" },
    [`${base}/c`]: { status: 200, body: "<html>c</html>" }
  };

  const result = await crawl({
    seed: `${base}/`,
    limit: 20,
    depth: 1,
    sleepMs: 0,
    fetchImpl: makeStubFetch(routes)
  });

  assert.ok(
    result.stats.sitemapIndexCount >= 1,
    `sitemapIndexCount=${result.stats.sitemapIndexCount}`
  );
  assert.ok(
    result.stats.sitemapPageEntries >= 3,
    `sitemapPageEntries=${result.stats.sitemapPageEntries}`
  );
  const urls = new Set(result.urls.map((u) => u.url));
  assert.ok(urls.has(`${base}/a`));
  assert.ok(urls.has(`${base}/b`));
  assert.ok(urls.has(`${base}/c`));
});
