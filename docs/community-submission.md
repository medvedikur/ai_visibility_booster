# Community Plugin Directory Submission

The Claude Code plugin directory accepts submissions through the official
form at:

https://clau.de/plugin-directory-submission

> Do **not** open a pull request against `anthropics/claude-plugins-community`.
> That repository is a read-only mirror.

## Form fields

| Field | Value |
|---|---|
| Plugin name | `ai-visibility-booster` |
| Description | Technical AI Visibility audits for websites: crawl URL inventories, run 36 basic AI crawler-readiness checks, compare competitors, and generate local reports. |
| Category (recommended) | development |
| Alternative category | productivity |
| Source | https://github.com/medvedikur/ai_visibility_booster |
| Version / ref | v0.1.0 |
| Homepage | https://github.com/medvedikur/ai_visibility_booster |
| Author | medvedikur |
| Tags | ai-visibility, technical-seo, ai-search, crawler-readiness, website-audit, claude-code |

## Security notes

- Public same-origin crawling only by default.
- No authentication or CAPTCHA bypass.
- No secrets are read or written.
- Local artifacts only (`./.ai-visibility/`); no third-party API calls in
  v0.1.0.
- All public-facing output uses the new public IDs `AIVB-001` through
  `AIVB-036`. Source IDs (`Sxxx`) are stored as provenance metadata only.

## Submission status (as of v0.1.0 cut)

- The repository, manifest, commands, skills, agents, and CLI are ready
  for submission.
- The owner (medvedikur) must complete the form at the URL above. This
  agent did **not** submit through the form (no browser automation or
  authenticated form-submission tool was available at build time).
- Once accepted, update the README "Marketplace install" section with the
  exact install command shown by the marketplace.

## Pre-submission checklist

- [ ] Local install passes `node bin/aiv.mjs doctor` on a clean clone.
- [ ] `npm test` passes on a clean clone.
- [ ] `node bin/aiv.mjs checklist` prints exactly 36 `AIVB-xxx` IDs.
- [ ] README, docs, commands, skills, and agents contain no Cyrillic
  characters (`tests/language.test.mjs`).
- [ ] `.claude-plugin/plugin.json` parseable; `name` is
  `ai-visibility-booster`.
- [ ] GitHub repo description and topics set.
- [ ] `v0.1.0` git tag and GitHub release created.
