---
description: Compare a target domain against registered competitors using saved analyses.
argument-hint: "<target-domain> [--competitors csv]"
allowed-tools: Bash, Read
---

Compute per-`AIVB-xxx` FAIL-rate deltas between the target and each
competitor, write `comparison.json` under
`./.ai-visibility/comparisons/<timestamp>/`.

## What to do

1. Run the CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs compare $ARGUMENTS
```

2. Read the comparison artifact and surface for the user:
   - which competitors were used and how many pages each had analyzed;
   - any coverage warnings (low sample size <10 pages);
   - top checks where target is **worse** than competitors;
   - top checks where target is **better** than competitors;
   - confidence labels.

3. Use the `ai-visibility-competitor-comparison` skill to frame the
   comparison cautiously. Do not claim total competitor superiority from a
   single check delta.

Rules:
- always show `AIVB-xxx` IDs;
- never imply that closing these gaps will guarantee citations or rankings;
- never compare pages that were not actually analyzed on both sides.
