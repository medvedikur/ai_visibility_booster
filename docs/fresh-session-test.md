# Fresh-Session Manual Test

The Claude Code CLI does not provide a non-interactive way for a non-Claude
process to install and exercise plugin commands at v0.1.1 cut time. The
"fresh session" verification therefore has manual steps. Follow them on a
machine that does not already have the plugin loaded.

## Prerequisites

- Node.js 20 or newer.
- A working Claude Code install with plugin support.
- An empty working directory.

## Steps

1. Clone the repository:
   ```
   git clone https://github.com/medvedikur/ai_visibility_booster.git
   cd ai_visibility_booster
   ```
2. Sanity-check the binary runs:
   ```
   node bin/aiv.mjs doctor
   node bin/aiv.mjs checklist | head -3
   ```
   Expected: `Doctor: OK`; checklist starts with `AIVB-001`.
3. Load the plugin into Claude Code per the official local-plugin loading
   instructions for your Claude Code version.
4. In Claude Code:
   - Run `/aiv-doctor`. Expected: doctor output with all `[ok]` lines.
   - Run `/aiv-checklist`. Expected: a 36-row table with public IDs
     `AIVB-001` through `AIVB-036`. Source IDs (`Sxxx`) appear only in the
     `Source` column.
   - Run `/aiv-crawl https://site.com --limit 10`. Expected: status
     summary and an artifact path under `./.ai-visibility/sites/site.com/`.
   - Run `/aiv-analyze site.com --random 3 --seed 1`. Expected: per-page
     scores and an analysis path under `./.ai-visibility/sites/site.com/analyses/`.
   - Run `/aiv-report site.com`. Expected: a report path under
     `./.ai-visibility/reports/`. The report must:
     - Use `AIVB-xxx` IDs as primary identifiers in tables and bullets.
     - Have a "Caveats" section that explicitly disclaims AI citation /
       ranking guarantees.
     - Not recommend rewriting page content.
5. Confirm the local fixture pipeline still works without network:
   ```
   node bin/aiv.mjs crawl tests/fixtures/site --limit 20 --out .tmp/aiv-fixture
   node bin/aiv.mjs analyze fixture.local --all --artifacts .tmp/aiv-fixture
   node bin/aiv.mjs report fixture.local --artifacts .tmp/aiv-fixture --format md
   ```

## Known constraints

- The build agent could not execute steps 3 and 4 (loading the plugin into
  a live Claude Code session and pressing slash commands) non-interactively.
  Step 5 (the fixture pipeline) is exercised by `tests/cli.test.mjs` and
  ran green at v0.1.1 cut.
- Until the marketplace install is accepted, plugin loading uses the local
  development path; update the README "Marketplace install" section after
  acceptance.
