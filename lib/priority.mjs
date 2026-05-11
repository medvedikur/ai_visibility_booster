import { CHECKS } from "./checks.mjs";
import { clamp } from "./utils.mjs";

const SEVERITY_FACTOR = {
  Critical: 1.0,
  High: 0.85,
  Medium: 0.7,
  Low: 0.5
};

export function severityFactor(severity) {
  return SEVERITY_FACTOR[severity] ?? 0;
}

export function bucketForPriority(score) {
  if (score >= 50) return "HIGH";
  if (score >= 20) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "NONE";
}

function countsForCheck(analysis, checkId) {
  let pass = 0;
  let fail = 0;
  let needs = 0;
  let na = 0;
  for (const page of analysis.verdicts || []) {
    for (const v of page.verdicts || []) {
      if (v.checkId !== checkId) continue;
      if (v.value === "PASS") pass += 1;
      else if (v.value === "FAIL") fail += 1;
      else if (v.value === "NEEDS_REVIEW") needs += 1;
      else if (v.value === "N/A") na += 1;
    }
  }
  return { pass, fail, needs, na };
}

export function computePriorityRows(analysis) {
  const rows = [];
  for (const check of CHECKS) {
    if (check.excludeFromPriority) continue;
    const c = countsForCheck(analysis, check.id);
    const denom = c.pass + c.fail;
    const failPct = denom > 0 ? Math.round((c.fail / denom) * 100) : null;
    const sevFactor = severityFactor(check.severity);
    let priority = 0;
    let note = "";
    if (failPct === null) {
      note = "No applicable pages on this site.";
    } else {
      priority = clamp(0, 100, Math.round(failPct * sevFactor));
    }
    rows.push({
      checkId: check.id,
      sourceId: check.sourceId,
      title: check.title,
      severity: check.severity,
      severityFactor: sevFactor,
      priorityProblem: check.priorityProblem,
      minimalFix: check.minimalFix,
      passCount: c.pass,
      failCount: c.fail,
      needsReviewCount: c.needs,
      naCount: c.na,
      failPct,
      priority,
      bucket: bucketForPriority(priority),
      note
    });
  }
  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const af = a.failPct ?? -1;
    const bf = b.failPct ?? -1;
    if (bf !== af) return bf - af;
    return a.checkId.localeCompare(b.checkId);
  });
  return rows;
}
