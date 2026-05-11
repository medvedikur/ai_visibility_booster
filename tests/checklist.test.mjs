import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKS, CHECKS_BY_ID, CHECKS_BY_SOURCE_ID } from "../lib/checks.mjs";

const EXPECTED_MAPPING = [
  ["AIVB-001", "S001"],
  ["AIVB-002", "S002"],
  ["AIVB-003", "S004"],
  ["AIVB-004", "S006"],
  ["AIVB-005", "S008"],
  ["AIVB-006", "S012"],
  ["AIVB-007", "S023"],
  ["AIVB-008", "S030"],
  ["AIVB-009", "S031"],
  ["AIVB-010", "S035"],
  ["AIVB-011", "S036"],
  ["AIVB-012", "S037"],
  ["AIVB-013", "S040"],
  ["AIVB-014", "S041"],
  ["AIVB-015", "S042"],
  ["AIVB-016", "S044"],
  ["AIVB-017", "S045"],
  ["AIVB-018", "S046"],
  ["AIVB-019", "S047"],
  ["AIVB-020", "S048"],
  ["AIVB-021", "S049"],
  ["AIVB-022", "S050"],
  ["AIVB-023", "S051"],
  ["AIVB-024", "S052"],
  ["AIVB-025", "S054"],
  ["AIVB-026", "S055"],
  ["AIVB-027", "S057"],
  ["AIVB-028", "S058"],
  ["AIVB-029", "S060"],
  ["AIVB-030", "S061"],
  ["AIVB-031", "S062"],
  ["AIVB-032", "S063"],
  ["AIVB-033", "S065"],
  ["AIVB-034", "S066"],
  ["AIVB-035", "S067"],
  ["AIVB-036", "S070"]
];

const VALID_SEVERITY = new Set(["Critical", "High", "Medium", "Low"]);
const VALID_MODES = new Set(["deterministic", "heuristic", "needs-claude-review"]);

test("checklist has exactly 36 checks", () => {
  assert.equal(CHECKS.length, 36, `expected 36 checks, got ${CHECKS.length}`);
  assert.notEqual(CHECKS.length, 25, "checklist must not be 25 (regression)");
});

test("public IDs are AIVB-001..AIVB-036 in order", () => {
  const ids = CHECKS.map((c) => c.id);
  const expected = EXPECTED_MAPPING.map(([pub]) => pub);
  assert.deepEqual(ids, expected);
});

test("source ID mapping matches canonical table", () => {
  const actual = CHECKS.map((c) => [c.id, c.sourceId]);
  assert.deepEqual(actual, EXPECTED_MAPPING);
});

test("public IDs are unique", () => {
  const ids = CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate public ID");
});

test("source IDs are unique", () => {
  const ids = CHECKS.map((c) => c.sourceId);
  assert.equal(new Set(ids).size, ids.length, "duplicate source ID");
});

test("primary id never uses Sxxx form", () => {
  for (const check of CHECKS) {
    assert.match(check.id, /^AIVB-\d{3}$/, `bad public ID: ${check.id}`);
    assert.doesNotMatch(check.id, /^S\d{3}$/, `Sxxx used as primary id: ${check.id}`);
  }
});

test("every check has required fields", () => {
  for (const check of CHECKS) {
    for (const field of [
      "id",
      "sourceId",
      "title",
      "description",
      "severity",
      "gapCategory",
      "scope",
      "evaluationMode",
      "minimalFix",
      "sourceEvidence"
    ]) {
      assert.ok(
        check[field] !== undefined && check[field] !== "",
        `${check.id} missing field ${field}`
      );
    }
    assert.ok(VALID_SEVERITY.has(check.severity), `${check.id} bad severity ${check.severity}`);
    assert.ok(VALID_MODES.has(check.evaluationMode), `${check.id} bad mode ${check.evaluationMode}`);
    assert.ok(check.scope === "page" || check.scope === "site", `${check.id} bad scope ${check.scope}`);
    assert.equal(check.sourceEvidence.repository, "medvedikur/a1qa_com_ai_visibility");
    assert.ok(Array.isArray(check.sourceEvidence.files));
  }
});

test("indexes by id and sourceId are populated", () => {
  for (const [pub, src] of EXPECTED_MAPPING) {
    assert.ok(CHECKS_BY_ID.get(pub), `missing CHECKS_BY_ID[${pub}]`);
    assert.equal(CHECKS_BY_SOURCE_ID.get(src)?.id, pub);
  }
});
