import http from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchText } from "../lib/crawler.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function origin(srv) {
  return `http://127.0.0.1:${srv.address().port}`;
}

test("fetchText returns finalUrl, redirected, status, ok, text, contentType for redirects", async (t) => {
  const srv = await listen((req, res) => {
    if (req.url === "/start") {
      res.writeHead(302, { Location: "/landing" });
      res.end();
      return;
    }
    if (req.url === "/landing") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body>landed</body></html>");
      return;
    }
    res.writeHead(404).end();
  });
  t.after(() => new Promise((resolve) => srv.close(resolve)));

  const r = await fetchText(`${origin(srv)}/start`);
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.match(r.text, /landed/);
  assert.match(r.contentType, /text\/html/);
  assert.equal(r.redirected, true);
  assert.notEqual(r.finalUrl, `${origin(srv)}/start`);
  assert.match(r.finalUrl, /\/landing$/);
});

test("fetchText sets redirected=false and finalUrl=requested when no redirect", async (t) => {
  const srv = await listen((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  t.after(() => new Promise((resolve) => srv.close(resolve)));

  const r = await fetchText(`${origin(srv)}/page`);
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.equal(r.redirected, false);
  assert.equal(r.finalUrl, `${origin(srv)}/page`);
  assert.match(r.contentType, /text\/plain/);
});
