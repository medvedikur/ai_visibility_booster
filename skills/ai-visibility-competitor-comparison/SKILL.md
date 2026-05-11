---
name: ai-visibility-competitor-comparison
description: Use when comparing a target site with competitor sites on AI Visibility checks, pass rates, crawl coverage, extraction gaps, or technical visibility deltas using ai-visibility-booster artifacts. Enforces AIVB-xxx public IDs and cautious framing of deltas.
---

# Comparing a target site against competitors

This skill governs how to interpret `comparison.json` produced by
`/aiv-compare` and how to talk about competitor deltas without overclaiming.

## What "comparison" means here

- We compare **only pages that were actually analyzed on both sides**.
- Per-`AIVB-xxx` FAIL rates are the unit of comparison.
- Delta = target FAIL rate − competitor FAIL rate.
  - `delta ≥ +0.10` ⇒ target worse than competitor on that check;
  - `delta ≤ −0.10` ⇒ target better than competitor on that check;
  - between −0.10 and +0.10 ⇒ effectively tied.
- Confidence is `low` whenever either side has fewer than 10 analyzed pages.

## Workflow

1. Open the latest `comparison.json` under `.ai-visibility/comparisons/`.
2. Surface coverage warnings first; never present deltas without coverage
   context if the sample is small.
3. List target-worse checks ordered by delta, with `AIVB-xxx`, severity,
   delta, and minimal fix family.
4. List target-better checks ordered by delta, with `AIVB-xxx`, severity,
   and a one-line note of what the competitor is doing differently.
5. Recommend the next 3–5 minimal technical fixes, scoped to the
   highest-severity target-worse checks.

## Cautious framing

- Do not infer total competitor superiority from one or two checks.
- Do not equate "smaller delta on `AIVB-019`" with "we will be cited more
  often". The 36 checks measure crawler-readiness/extractability, not
  citation outcomes.
- Note when a competitor is "better" purely because of low signal density
  (e.g. fewer images naturally yields fewer alt-text failures). The source
  research explicitly flags this for IBM in `docs/source-research.md`.

## Red flags

- Treating competitor wins as proof of strategy correctness without
  accounting for sample size or signal density.
- Comparing pages that were not analyzed on both sides.
- Using `Sxxx` as a primary public ID in tables.
- Promising ranking or AI citation outcomes from closing a delta.
- Reducing the runtime scope to "25 checks" anywhere in comparison output.
