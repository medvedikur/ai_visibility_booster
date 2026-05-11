import { CHECKS, CHECKS_BY_ID } from "./checks.mjs";

function pct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function topProblemAreas(checkSummary) {
  const rows = [];
  for (const [checkId, counts] of Object.entries(checkSummary)) {
    const total = (counts.PASS || 0) + (counts.FAIL || 0) + (counts.NEEDS_REVIEW || 0);
    if (!total) continue;
    const failRate = (counts.FAIL || 0) / total;
    if (failRate > 0 || (counts.NEEDS_REVIEW || 0) > 0) {
      const c = CHECKS_BY_ID.get(checkId);
      rows.push({
        checkId,
        title: c?.title || "",
        severity: c?.severity || "",
        gapCategory: c?.gapCategory || "",
        minimalFix: c?.minimalFix || "",
        failRate,
        failCount: counts.FAIL || 0,
        needsReviewCount: counts.NEEDS_REVIEW || 0,
        total
      });
    }
  }
  rows.sort((a, b) => b.failRate - a.failRate || b.failCount - a.failCount);
  return rows.slice(0, 15);
}

function bucketLine(bc) {
  const all = bc || {};
  return `very_bad=${all.very_bad || 0}, bad=${all.bad || 0}, low=${all.low || 0}, average=${all.average || 0}, high=${all.high || 0}`;
}

export function buildReportMarkdown({ domain, analysis, crawlStats, comparison, plugin }) {
  const lines = [];
  lines.push(`# AI Visibility Booster Report`);
  lines.push("");
  lines.push(`Domain: ${domain}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Plugin: ${plugin?.name || "ai-visibility-booster"} v${plugin?.version || "0.1.2"}`);
  lines.push(`Checklist scope: 36 BASIC checks (AIVB-001 through AIVB-036).`);
  lines.push("");

  lines.push(`## A. Current site situation`);
  lines.push("");
  lines.push(`### Crawl coverage`);
  if (crawlStats) {
    lines.push(`- Total candidate URLs discovered: ${crawlStats.totalCandidates ?? "n/a"}`);
    lines.push(`- Pages fetched: ${crawlStats.fetched ?? "n/a"}`);
    if (crawlStats.statusCounts) {
      const dist = Object.entries(crawlStats.statusCounts).map(([k, v]) => `${k}=${v}`).join(", ");
      lines.push(`- HTTP status distribution: ${dist}`);
    }
    lines.push(`- Sitemap entries: ${crawlStats.sitemapEntries ?? "n/a"}`);
  } else {
    lines.push(`- No crawl artifacts available.`);
  }
  lines.push("");
  lines.push(`### 36-check summary`);
  const summary = analysis?.summary || {};
  lines.push(`- Pages analyzed: ${summary.pages ?? 0}`);
  lines.push(`- Average page score: ${summary.averageScore ?? 0}`);
  lines.push(`- Bucket distribution: ${bucketLine(summary.bucketCounts)}`);
  lines.push("");

  lines.push(`### Top problem areas`);
  lines.push("");
  lines.push(`| Public ID | Title | Severity | FAIL | NEEDS_REVIEW | Pages |`);
  lines.push(`|---|---|---|---:|---:|---:|`);
  const topRows = topProblemAreas(summary.checkSummary || {});
  for (const row of topRows) {
    lines.push(`| ${row.checkId} | ${row.title} | ${row.severity} | ${row.failCount} | ${row.needsReviewCount} | ${row.total} |`);
  }
  if (!topRows.length) lines.push(`| — | No FAILs or NEEDS_REVIEW items. | — | 0 | 0 | 0 |`);
  lines.push("");

  lines.push(`### Minimal fix recommendations`);
  lines.push("");
  if (topRows.length === 0) {
    lines.push(`- No fixes required from this run.`);
  } else {
    for (const row of topRows.slice(0, 10)) {
      lines.push(`- **${row.checkId}** (${row.severity}, ${row.gapCategory}) — ${row.minimalFix}`);
    }
  }
  lines.push("");
  lines.push(`These recommendations are minimal technical fixes (metadata, structure, alt text, captions, schema, internal links). They are not prescriptions to rewrite page content.`);
  lines.push("");

  if (comparison) {
    lines.push(`## B. Competitor comparison`);
    lines.push("");
    lines.push(`Competitors analyzed: ${comparison.competitors.map((c) => `${c.domain} (${c.pages} pages)`).join(", ") || "none"}`);
    if (comparison.warnings.length) {
      lines.push("");
      lines.push(`Coverage warnings:`);
      for (const w of comparison.warnings) lines.push(`- ${w}`);
    }
    lines.push("");
    lines.push(`### Where target is worse than competitors`);
    lines.push("");
    if (!comparison.targetWorse.length) {
      lines.push(`- None within the +0.10 fail-rate threshold.`);
    } else {
      lines.push(`| Public ID | Title | vs competitor | Delta (target − competitor fail rate) |`);
      lines.push(`|---|---|---|---:|`);
      for (const row of comparison.targetWorse.slice(0, 15)) {
        lines.push(`| ${row.checkId} | ${row.title} | ${row.competitor} | ${row.delta.toFixed(2)} |`);
      }
    }
    lines.push("");
    lines.push(`### Where target is better than competitors`);
    lines.push("");
    if (!comparison.targetBetter.length) {
      lines.push(`- None within the −0.10 fail-rate threshold.`);
    } else {
      lines.push(`| Public ID | Title | vs competitor | Delta (target − competitor fail rate) |`);
      lines.push(`|---|---|---|---:|`);
      for (const row of comparison.targetBetter.slice(0, 15)) {
        lines.push(`| ${row.checkId} | ${row.title} | ${row.competitor} | ${row.delta.toFixed(2)} |`);
      }
    }
    lines.push("");
  }

  lines.push(`## Caveats`);
  lines.push("");
  lines.push(`- This v0.1.x score is a heuristic based on the 36 BASIC checks; it is not a Semrush AI Visibility score.`);
  lines.push(`- The plugin does not promise AI citations, AI Overview placements, or guaranteed ranking changes.`);
  lines.push(`- Heuristic and needs-claude-review checks should be confirmed by a human or Claude review before remediation.`);
  lines.push(`- Source provenance for every check is in docs/source-research.md.`);
  lines.push("");

  return lines.join("\n");
}
