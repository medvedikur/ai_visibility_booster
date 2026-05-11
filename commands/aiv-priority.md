---
description: Generate a single-site priority HTML report from the latest analysis.
argument-hint: "<domain> [--run-id ID] [--artifacts DIR]"
allowed-tools: Bash, Read
---

Compute the AI Visibility fix-priority for the latest analysis of the
domain and write a self-contained HTML report.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs priority $ARGUMENTS
```

2. Summarize for the user:
   - the path to `priority.html` and `priority.json`;
   - the HIGH / MEDIUM / LOW / NONE bucket counts;
   - whether the analysis was run with `--thorough` (if not, recommend
     re-running `/aiv-analyze <domain> --thorough` and then `/aiv-priority`).

3. Recommend the next step using the namespaced command form:
   - `/ai-visibility-booster:aiv-analyze <domain> --thorough` if the
     analysis was heuristic-only.
   - Open `priority.html` in a browser to review the rows.

Rules:
- The priority report is single-site; do not pull in competitor data.
- Use `AIVB-xxx` public IDs in everything you show the user.
- Do not promise AI ranking outcomes.
- Do not call any external service.
