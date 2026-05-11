import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

const ROOTS = [
  "README.md",
  "docs",
  "commands",
  "skills",
  "agents"
];

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

test("public docs and plugin assets contain no Cyrillic characters", async () => {
  const files = [];
  for (const target of ROOTS) {
    const full = path.join(ROOT, target);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.isFile() && full.endsWith(".md")) {
      files.push(full);
    } else if (stat.isDirectory()) {
      files.push(...(await walk(full)));
    }
  }

  const violations = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    if (CYRILLIC.test(text)) {
      violations.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(violations, [], `Cyrillic found in: ${violations.join(", ")}`);
});
