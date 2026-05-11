---
description: Show local AI Visibility artifact status (last crawl run, last analysis) for one or all sites.
allowed-tools: Bash, Read
---

List sites under `./.ai-visibility/sites/` and report the most recent crawl
run and analysis ID for each. Optionally filter by `$1` (a domain).

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs status $ARGUMENTS
```

2. Present the output verbatim. If a site has no `lastCrawlRun`, suggest
   `/aiv-crawl https://<domain>`. If it has no `lastAnalysis`, suggest
   `/aiv-analyze <domain>`.
