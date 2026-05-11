import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test(".claude-plugin/marketplace.json exists and is valid JSON", async () => {
  const file = path.join(ROOT, ".claude-plugin", "marketplace.json");
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw);
  assert.equal(data.name, "ai-visibility-booster-marketplace");
  assert.ok(Array.isArray(data.plugins) && data.plugins.length >= 1);
  const plugin = data.plugins.find((p) => p.name === "ai-visibility-booster");
  assert.ok(plugin, "ai-visibility-booster plugin entry missing");
  const sourceUrl = plugin.source?.url || "";
  assert.match(
    sourceUrl,
    /^https:\/\/github\.com\/medvedikur\/ai_visibility_booster\.git$/,
    "plugin source.url must point to the public GitHub repo"
  );
  assert.equal(plugin.source?.ref, "v0.1.1");
  assert.equal(plugin.version, "0.1.1");
});

test("plugin.json and marketplace.json coexist with consistent version", async () => {
  const pluginFile = path.join(ROOT, ".claude-plugin", "plugin.json");
  const marketplaceFile = path.join(ROOT, ".claude-plugin", "marketplace.json");
  const plugin = JSON.parse(await fs.readFile(pluginFile, "utf8"));
  const marketplace = JSON.parse(await fs.readFile(marketplaceFile, "utf8"));
  assert.equal(plugin.name, "ai-visibility-booster");
  assert.equal(marketplace.name, "ai-visibility-booster-marketplace");
  assert.equal(plugin.version, "0.1.1");
  assert.equal(marketplace.plugins[0].version, plugin.version);
});

test("package.json version is bumped to 0.1.1", async () => {
  const data = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(data.version, "0.1.1");
});
