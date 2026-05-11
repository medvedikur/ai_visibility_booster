const BUCKET_STYLE = {
  HIGH:   { bg: "#fdecea", color: "#8b1a16", label: "HIGH PRIORITY — fix first" },
  MEDIUM: { bg: "#fff8e0", color: "#8a6d10", label: "MEDIUM PRIORITY" },
  LOW:    { bg: "#f3fbf6", color: "#1d6f42", label: "LOW PRIORITY" },
  NONE:   { bg: "#fafafa", color: "#888",    label: "NO PROBLEM — nothing to fix here" }
};

const SEVERITY_LABEL = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whyCell(row) {
  if (row.failPct === null) {
    return `<strong>No applicable pages on this site.</strong>`;
  }
  if (row.failPct < 5) {
    return `<strong>Not worth fixing</strong> — only ${row.failPct}% of pages have this issue.`;
  }
  return `<strong>What's wrong:</strong> ${escapeHtml(row.priorityProblem)}<br/><strong>What to fix:</strong> ${escapeHtml(row.minimalFix)}`;
}

function failPctCell(row) {
  if (row.failPct === null) return `<span title="No applicable pages">N/A</span>`;
  const cls = row.failPct >= 60 ? "fail-high" : row.failPct >= 25 ? "fail-mid" : "fail-low";
  return `<span class="${cls}">${row.failPct}%</span>`;
}

function renderRow(row) {
  const style = BUCKET_STYLE[row.bucket] || BUCKET_STYLE.NONE;
  const scoreTip = `Priority ${row.priority} (${row.failPct === null ? "no data" : `${row.failPct}% of pages fail`} × severity ${row.severityFactor.toFixed(2)})`;
  const ruleTip = `${row.title} (provenance: ${row.sourceId})`;
  return `<tr style="background:${style.bg}">
  <td class="score-cell" title="${escapeHtml(scoreTip)}"><span class="bucket-tag" style="background:${style.bg};color:${style.color};border:1px solid ${style.color}33;">${row.priority}</span></td>
  <td class="cid" title="${escapeHtml(ruleTip)}">${escapeHtml(row.checkId)}</td>
  <td>${escapeHtml(SEVERITY_LABEL[row.severity] || row.severity)}</td>
  <td class="rule" title="${escapeHtml(ruleTip)}">${escapeHtml(row.title)}</td>
  <td class="num">${failPctCell(row)}${row.needsReviewCount ? ` <span class="needs-review" title="Verdicts that remained NEEDS_REVIEW">(+${row.needsReviewCount} unresolved)</span>` : ""}</td>
  <td class="rule-full">${whyCell(row)}</td>
</tr>`;
}

function renderDivider(bucket, colspan) {
  const style = BUCKET_STYLE[bucket];
  const icon = bucket === "HIGH" ? "🔴" : bucket === "MEDIUM" ? "🟡" : bucket === "LOW" ? "🟢" : "⚪";
  return `<tr class="section-divider"><td colspan="${colspan}">${icon} ${style.label}</td></tr>`;
}

function renderRowsWithDividers(rows) {
  const colspan = 6;
  let out = "";
  let last = "";
  for (const row of rows) {
    if (row.bucket !== last) {
      out += renderDivider(row.bucket, colspan);
      last = row.bucket;
    }
    out += renderRow(row);
  }
  return out;
}

function renderCoverageWarning(coverage) {
  if (coverage.thorough) {
    if (coverage.residualNeedsReview > 0) {
      return `<p>${coverage.residualNeedsReview} verdicts remained NEEDS_REVIEW after the --thorough pass; they are excluded from the priority denominator.</p>`;
    }
    return `<p>Analysis was run with --thorough; all heuristic NEEDS_REVIEW verdicts were resolved by the page auditor.</p>`;
  }
  return `<p><strong>Heads up:</strong> the underlying analysis was not LLM-resolved (--thorough not used). Priority scores for heuristic and needs-claude-review checks are likely understated. Run <code>/aiv-analyze ${escapeHtml(coverage.domain || "<domain>")} --thorough</code> and regenerate the report.</p>`;
}

export function buildPriorityReportHtml({ domain, rows, coverage, plugin }) {
  const generatedAt = new Date().toISOString();
  const cov = { ...coverage, domain };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AI Visibility fix-priority — ${escapeHtml(domain)}</title>
<style>
body { font: 13px/1.45 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #111; background: #fafafa; }
h1 { margin: 0 0 4px; }
.summary-box { background: #fff; border: 1px solid #e3e3e3; border-radius: 6px; padding: 14px 16px; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-size: 12px; background: #fff; }
th, td { padding: 7px 8px; border-bottom: 1px solid #ececec; vertical-align: top; }
th { background: #f6f6f6; text-align: left; position: sticky; top: 0; z-index: 5; }
td.cid { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; white-space: nowrap; cursor: help; font-weight: 600; }
td.rule { max-width: 480px; cursor: help; word-wrap: break-word; }
td.rule-full { max-width: 420px; word-wrap: break-word; line-height: 1.45; font-size: 12px; color: #333; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.score-cell { text-align: center; font-weight: 700; font-size: 16px; cursor: help; }
.bucket-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; min-width: 60px; text-align: center; }
.section-divider td { background: linear-gradient(to right, #ddd, #fafafa); padding: 4px 8px; font-size: 11px; color: #666; font-weight: 600; }
.fail-low { color: #1d6f42; }
.fail-mid { color: #b3711a; }
.fail-high { color: #8b1a16; font-weight: 600; }
.needs-review { color: #8a6d10; font-size: 10px; }
code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
</style>
</head>
<body>
<h1>AI Visibility fix-priority — ${escapeHtml(domain)}</h1>
<div class="summary-box">
  <strong>How to read this table:</strong> top rows are the most important fixes; bottom rows are checks where the problem barely exists. Row background tracks priority (red → yellow → green → gray). The <strong>PRIORITY</strong> column is a 0-100 importance score. Severity and Priority scales are explained below the table.
</div>

<table>
<thead>
<tr>
  <th>PRIORITY</th>
  <th>ID</th>
  <th>Severity</th>
  <th>What is checked</th>
  <th>Pages failing</th>
  <th>Why this priority</th>
</tr>
</thead>
<tbody>
${renderRowsWithDividers(rows)}
</tbody>
</table>

<div class="summary-box" style="margin-top:24px;">
<h3 style="margin:0 0 8px 0;">What "Severity" means</h3>
<p>The intrinsic criticality of the check, regardless of whether your site fails it.</p>
<ul>
  <li><strong>Critical</strong> — without this the page cannot enter the index or AI answers at all.</li>
  <li><strong>High</strong> — strongly reduces AI citation likelihood.</li>
  <li><strong>Medium</strong> — noticeably hurts quality but does not block.</li>
  <li><strong>Low</strong> — minor hygiene.</li>
</ul>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">What "Priority" means</h3>
<p>Score from 0 to 100 = how much you should fix this check on this site. Combines two factors:</p>
<ol>
  <li>What share of your pages currently fail the check.</li>
  <li>Severity of the check itself (Critical weighs more than Low).</li>
</ol>
<p>Bucketing:</p>
<ul>
  <li><strong style="color:#8b1a16">🔴 HIGH (50-100)</strong> — high-severity check failing on a lot of pages. Fix first.</li>
  <li><strong style="color:#8a6d10">🟡 MEDIUM (20-49)</strong> — real problem, lower severity or smaller footprint.</li>
  <li><strong style="color:#1d6f42">🟢 LOW (5-19)</strong> — background hygiene.</li>
  <li><strong style="color:#666">⚪ NONE (&lt;5)</strong> — nothing meaningful to fix.</li>
</ul>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">Checks excluded from priority computation</h3>
<p>AIVB-029 (Core Web Vitals) is excluded because it requires a third-party performance data source the plugin does not call. Run PageSpeed Insights or CrUX separately to evaluate this check.</p>
</div>

<div class="summary-box">
<h3 style="margin:0 0 8px 0;">Coverage</h3>
<p>Analyzed ${cov.pagesAnalyzed} pages from a crawl of ${cov.totalUrls} URLs.</p>
${renderCoverageWarning(cov)}
<p style="margin-top:8px;font-size:11px;color:#666">Generated ${escapeHtml(generatedAt)} by ${escapeHtml(plugin.name)} v${escapeHtml(plugin.version)}.</p>
</div>
</body>
</html>`;
}
