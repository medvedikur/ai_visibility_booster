import { CHECKS } from "./checks.mjs";

const LOW_SAMPLE = 10;

function rateByCheck(analysis) {
  const counts = new Map();
  for (const check of CHECKS) {
    counts.set(check.id, { fail: 0, total: 0 });
  }
  for (const page of analysis.verdicts || []) {
    for (const v of page.verdicts) {
      const c = counts.get(v.checkId);
      if (!c) continue;
      c.total += 1;
      if (v.value === "FAIL") c.fail += 1;
    }
  }
  const out = {};
  for (const [id, c] of counts.entries()) {
    out[id] = { fail: c.fail, total: c.total, rate: c.total ? c.fail / c.total : 0 };
  }
  return out;
}

export function compareSites(targetAnalysis, competitors) {
  const targetRates = rateByCheck(targetAnalysis);
  const targetPages = (targetAnalysis.verdicts || []).length;
  const warnings = [];
  if (targetPages < LOW_SAMPLE) {
    warnings.push(`Target has only ${targetPages} analyzed pages; treat deltas as low-confidence.`);
  }

  const competitorAnalyses = competitors.map((c) => ({
    domain: c.domain,
    pages: (c.analysis.verdicts || []).length,
    rates: rateByCheck(c.analysis)
  }));
  for (const c of competitorAnalyses) {
    if (c.pages < LOW_SAMPLE) {
      warnings.push(`Competitor ${c.domain} has only ${c.pages} analyzed pages; treat deltas as low-confidence.`);
    }
  }

  const checks = [];
  for (const check of CHECKS) {
    const target = targetRates[check.id];
    const competitorsRow = competitorAnalyses.map((c) => {
      const comp = c.rates[check.id];
      const delta = target.rate - comp.rate;
      const lowConfidence = c.pages < LOW_SAMPLE || targetPages < LOW_SAMPLE;
      return {
        domain: c.domain,
        failRate: comp.rate,
        failCount: comp.fail,
        total: comp.total,
        delta,
        confidence: lowConfidence ? "low" : "high"
      };
    });
    checks.push({
      checkId: check.id,
      sourceId: check.sourceId,
      title: check.title,
      severity: check.severity,
      gapCategory: check.gapCategory,
      targetFailRate: target.rate,
      targetFailCount: target.fail,
      targetTotal: target.total,
      competitors: competitorsRow
    });
  }

  const targetWorse = [];
  const targetBetter = [];
  for (const row of checks) {
    for (const c of row.competitors) {
      if (c.delta >= 0.1) targetWorse.push({ ...row, competitor: c.domain, delta: c.delta });
      if (c.delta <= -0.1) targetBetter.push({ ...row, competitor: c.domain, delta: c.delta });
    }
  }
  targetWorse.sort((a, b) => b.delta - a.delta);
  targetBetter.sort((a, b) => a.delta - b.delta);

  return {
    targetDomain: targetAnalysis?.input?.target || targetAnalysis?.input?.domain || "",
    competitors: competitorAnalyses.map((c) => ({ domain: c.domain, pages: c.pages })),
    checks,
    targetWorse,
    targetBetter,
    warnings
  };
}
