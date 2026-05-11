import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("aiv-crawl.md suggests the namespaced /ai-visibility-booster:aiv-analyze form", async () => {
  const text = await fs.readFile(path.join(ROOT, "commands", "aiv-crawl.md"), "utf8");
  assert.match(
    text,
    /\/ai-visibility-booster:aiv-analyze\b/,
    "aiv-crawl.md must suggest /ai-visibility-booster:aiv-analyze as the next step"
  );
});
