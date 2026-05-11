---
description: Analyze selected pages against the 36 AIVB checks; --thorough resolves NEEDS_REVIEW via aiv-page-auditor.
argument-hint: "<domain> [--random N --seed N] [--all] [--urls csv] [--run-id ID] [--thorough]"
allowed-tools: Bash, Read, Write, Task
---

Run the 36 `AIVB-001`..`AIVB-036` evaluators on the selected pages and save
verdicts under `./.ai-visibility/sites/<domain>/analyses/<timestamp>/`.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs analyze $ARGUMENTS
```

2. Read `verdicts.json`, `summary.json`, and `check-matrix.json` from the
   reported analysis directory. Always use the public `AIVB-xxx` IDs in
   anything you show the user.

3. Summarize:
   - pages analyzed;
   - average score and bucket distribution;
   - top failed checks (with `AIVB-xxx`, severity, fail count);
   - top NEEDS_REVIEW items.

4. **If `--thorough` was passed**:
   a. Read `needs-review-queue.json` from the analysis directory.
   b. For each `{url, hash, checkId, heuristicEvidence}` entry:
      - Read the corresponding page snapshot from
        `crawl-runs/<runId>/pages/<hash>.json`.
      - Invoke the `aiv-page-auditor` subagent with the snapshot, the
        check definition, and the heuristic evidence.
      - Apply the returned `{value, evidence, confidence}` patch to the
        in-memory verdicts.
   c. Write the patched verdicts back to `verdicts.json` (preserve the
      original heuristic verdict under `heuristicValue` / `heuristicEvidence`
      on each judged entry; set `value` and `evidence` to the judge's
      values; set `judgedBy: "aiv-page-auditor"`).
   d. Recompute `summary.json` and `check-matrix.json` from the patched
      verdicts and overwrite them.

5. Recommend the next step using the namespaced command form:
   - `/ai-visibility-booster:aiv-priority <domain>` to generate the
     single-site priority HTML report.
   - `/ai-visibility-booster:aiv-report <domain>` for the Markdown report.

Rules:
- Never recommend rewriting page content.
- Never present `Sxxx` as a primary public ID.
- Never claim PASS for a check without quoting evidence from the artifact.
- When `--thorough` is used, the judge is the page auditor subagent;
  do not call any external LLM or service.
