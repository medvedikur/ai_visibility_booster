---
description: Register a competitor for a target domain so reports and comparisons can include it.
argument-hint: "<target-domain> <competitor-url>"
allowed-tools: Bash, Read
---

Append `$2` to `./.ai-visibility/sites/$1/competitors.json` and remind the
user to crawl + analyze the competitor before running `/aiv-compare`.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs add-competitor $ARGUMENTS
```

2. Read the printed competitor list back to the user.

3. If the CLI notes that no crawl artifacts exist for the new competitor,
   suggest:

```
/aiv-crawl https://<competitor> --limit 100
/aiv-analyze <competitor> --random 20 --seed 42
```

4. Do not start the competitor crawl yourself unless explicitly asked.
