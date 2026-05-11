import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const COMMANDS = [
  "aiv-crawl",
  "aiv-analyze",
  "aiv-add-competitor",
  "aiv-compare",
  "aiv-report",
  "aiv-status",
  "aiv-checklist",
  "aiv-doctor"
];

const SKILLS = [
  "ai-visibility-basic-checks",
  "ai-visibility-reporting",
  "ai-visibility-competitor-comparison"
];

const AGENTS = ["aiv-page-auditor", "aiv-report-reviewer"];

test("plugin manifest is valid", async () => {
  const raw = await fs.readFile(path.join(ROOT, ".claude-plugin", "plugin.json"), "utf8");
  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, "ai-visibility-booster");
  assert.match(manifest.name, /^[a-z0-9-]+$/, "name must be kebab-case");
  for (const field of ["version", "description", "author", "homepage", "repository", "license", "keywords"]) {
    assert.ok(manifest[field], `manifest missing ${field}`);
  }
  assert.ok(Array.isArray(manifest.keywords) && manifest.keywords.length >= 3);
});

test("all commands exist with frontmatter and use ${CLAUDE_PLUGIN_ROOT}", async () => {
  for (const cmd of COMMANDS) {
    const file = path.join(ROOT, "commands", `${cmd}.md`);
    const text = await fs.readFile(file, "utf8");
    assert.match(text, /^---/, `${cmd}: missing frontmatter`);
    assert.match(text, /description:/, `${cmd}: missing description`);
    if (cmd !== "aiv-status" && cmd !== "aiv-checklist" && cmd !== "aiv-doctor") {
      assert.match(text, /argument-hint:/, `${cmd}: missing argument-hint`);
    }
    assert.match(text, /CLAUDE_PLUGIN_ROOT/, `${cmd}: must reference \${CLAUDE_PLUGIN_ROOT}`);
  }
});

test("all skills exist with valid frontmatter", async () => {
  for (const skill of SKILLS) {
    const file = path.join(ROOT, "skills", skill, "SKILL.md");
    const text = await fs.readFile(file, "utf8");
    assert.match(text, /^---/);
    assert.match(text, /name:\s*\S/);
    assert.match(text, /description:/);
  }
});

test("all agents exist with frontmatter", async () => {
  for (const agent of AGENTS) {
    const file = path.join(ROOT, "agents", `${agent}.md`);
    const text = await fs.readFile(file, "utf8");
    assert.match(text, /^---/);
    assert.match(text, /description:/);
  }
});

test("README has install, usage, examples, limitations", async () => {
  const readme = await fs.readFile(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /## Install/i);
  assert.match(readme, /## Quick start|## Usage/i);
  assert.match(readme, /AIVB-001/);
  assert.match(readme, /## Limitations/i);
  assert.match(readme, /36/);
});

test("LICENSE is MIT", async () => {
  const license = await fs.readFile(path.join(ROOT, "LICENSE"), "utf8");
  assert.match(license, /MIT/);
});
