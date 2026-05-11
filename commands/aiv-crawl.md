---
description: Crawl a public site URL inventory and save local AI Visibility artifacts.
argument-hint: "<url> [--limit N] [--depth N] [--sitemap-only]"
allowed-tools: Bash, Read
---

Crawl `$1` to discover URLs (sitemap + same-origin BFS up to `--depth`),
record HTTP status, and save page snapshots under
`./.ai-visibility/sites/<domain>/crawl-runs/<timestamp>/`.

Defaults: `--limit 200`, `--depth 2`, polite same-origin only, fixed user
agent. The plugin does not bypass authentication, CAPTCHA, or WAF.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs crawl $ARGUMENTS
```

2. Read the printed artifact path. From `stats.json` and `urls.json`,
   summarize for the user:
   - total candidates discovered;
   - pages fetched;
   - HTTP status distribution;
   - sitemap coverage (entries / fetched);
   - notable failures.

3. Suggest the next command:

```
/ai-visibility-booster:aiv-analyze <domain> --random 25 --seed 42
```

Note: some Claude Code installations may expose un-namespaced aliases
(e.g. `/aiv-analyze`), but the namespaced form
`/ai-visibility-booster:aiv-analyze` is the reliable form after
marketplace installation. Always use it when guiding the user.

Do not claim success unless the CLI exits 0 and the artifacts directory
exists. If the CLI fails, surface the error verbatim.
