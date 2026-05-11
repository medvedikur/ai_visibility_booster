---
description: Print the 36 public AI Visibility checks (AIVB-001..AIVB-036) with severity, mode, source ID, and fix family.
allowed-tools: Bash
---

Print the canonical 36-check table. Public IDs are `AIVB-001` through
`AIVB-036`. Source IDs (`Sxxx`) are shown only as provenance metadata in the
"Source" column.

## What to do

1. Run:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs checklist
```

2. Present the output verbatim. Do not paraphrase rows or relabel public
   IDs. If the user wants a deeper explanation of any check, point to
   `docs/source-research.md`.

Rules:
- never claim the runtime scope is 25 checks;
- never present `Sxxx` as the primary user-facing ID.
