export async function judgeAnalysis({ analysis, snapshots = {}, invoke, onProgress }) {
  let judged = 0;
  let failed = 0;
  let unchanged = 0;
  let residualNeedsReview = 0;
  const cloned = {
    ...analysis,
    verdicts: (analysis.verdicts || []).map((page) => ({
      ...page,
      verdicts: page.verdicts.map((v) => ({ ...v }))
    }))
  };
  for (const page of cloned.verdicts) {
    const snapshot = snapshots[page.hash] || null;
    for (const v of page.verdicts) {
      if (v.value !== "NEEDS_REVIEW") continue;
      try {
        if (typeof onProgress === "function") {
          onProgress({ pageUrl: page.url, checkId: v.checkId });
        }
        const result = await invoke({
          pageUrl: page.url,
          checkId: v.checkId,
          sourceId: v.sourceId,
          severity: v.severity,
          heuristicEvidence: v.evidence,
          snapshot
        });
        if (!result || !result.value || result.value === "NEEDS_REVIEW") {
          residualNeedsReview += 1;
          unchanged += 1;
          v.judgedBy = "aiv-page-auditor";
          v.evidence = result?.evidence || `${v.evidence} (judge inconclusive)`;
          continue;
        }
        v.value = result.value;
        v.evidence = result.evidence || v.evidence;
        v.judgedBy = "aiv-page-auditor";
        if (typeof result.confidence === "number") v.confidence = result.confidence;
        judged += 1;
      } catch (err) {
        failed += 1;
        residualNeedsReview += 1;
        v.evidence = `judge failed: ${err.message}`;
      }
    }
  }
  return { analysis: cloned, judged, failed, unchanged, residualNeedsReview };
}
