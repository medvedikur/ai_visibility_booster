import { clamp } from "./utils.mjs";

const WEIGHTS = {
  Critical: 5,
  High: 4,
  Medium: 2,
  Low: 1
};

export function severityWeight(severity) {
  return WEIGHTS[severity] ?? 0;
}

export function scorePage(verdicts) {
  let penalty = 0;
  let needsReview = 0;
  for (const v of verdicts) {
    if (v.value === "FAIL") {
      penalty += severityWeight(v.severity);
    } else if (v.value === "NEEDS_REVIEW") {
      needsReview += 1;
    }
  }
  const raw = 100 - penalty - 0.5 * needsReview;
  return clamp(0, 100, Math.round(raw * 100) / 100);
}

export function bucketFor(score) {
  if (score >= 95) return "high";
  if (score >= 90) return "average";
  if (score >= 80) return "low";
  if (score >= 60) return "bad";
  return "very_bad";
}

export function emptyBucketCounts() {
  return { very_bad: 0, bad: 0, low: 0, average: 0, high: 0 };
}
