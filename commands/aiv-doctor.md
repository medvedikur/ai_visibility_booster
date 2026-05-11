---
description: Validate the AI Visibility Booster plugin install (Node version, manifest, CLI, English-only docs, artifact directory).
allowed-tools: Bash, Read
---

Run the doctor probes and report what passed/failed.

## What to do

1. Run:

```
node ${CLAUDE_PLUGIN_ROOT}/bin/aiv.mjs doctor
```

2. Show the output verbatim. If anything fails, suggest the most relevant
   fix:
   - Node < 20 → upgrade Node to 20 or newer;
   - Manifest missing → check that the plugin was loaded with the correct
     directory;
   - Cyrillic detected in public docs → file an issue at
     `https://github.com/medvedikur/ai_visibility_booster/issues`;
   - Artifact directory creation failed → check filesystem permissions on
     the working directory.
