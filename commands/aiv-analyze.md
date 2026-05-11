---
description: Analyze selected pages of a crawled site against the 36 AIVB checks.
argument-hint: "<domain> [--random N --seed N] [--all] [--urls csv] [--run-id ID]"
allowed-tools: Bash, Read, Write
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

4. If there are NEEDS_REVIEW items where the page snapshot has enough
   evidence, invoke the `ai-visibility-basic-checks` skill and the
   `aiv-page-auditor` agent to confirm or downgrade those verdicts. Save
   any updated verdicts back into `verdicts.json` under `claudeReview`
   keys; do not overwrite the deterministic/heuristic verdict fields.

5. Recommend the next step using the namespaced command form (some
   Claude Code installations expose un-namespaced aliases, but the
   namespaced form is reliable after marketplace installation):
   - `/ai-visibility-booster:aiv-add-competitor <domain> https://<competitor>`
     if no competitors are registered yet;
   - `/ai-visibility-booster:aiv-compare <domain> --competitors <csv>`
     if competitors are registered and analyzed;
   - `/ai-visibility-booster:aiv-report <domain>` for the final
     Markdown report.

Rules:
- never recommend rewriting page content;
- never present `Sxxx` as a primary public ID;
- never claim PASS for a check without quoting evidence from the artifact.
