import { describe, expect, it } from "vitest";
import { createEmptyFidelityCriteria, createFidelityEvaluation, scoreFidelityCriteria, validateFidelityEvaluation, FIDELITY_RUBRIC_VERSION } from "../lib/fidelity-evaluation";

const make = (criteria = createEmptyFidelityCriteria()) => createFidelityEvaluation({
    id: "evaluation-1", projectId: "project-1", renderVersionId: "version-1",
    sourceImageReference: "archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png",
    generationProvenance: { versionNumber: 1, generationMode: "baseline", modelIdentifier: "legacy/unknown", promptTemplateVersion: "legacy/unknown", configurationSnapshot: null, renderCreatedAt: "2026-10-20T00:00:00.000Z" },
    approvedAnalysisRevision: 1, reviewerIdentifier: "reviewer-1", criteria, observations: [], discrepancies: [], limitations: [],
}, "2026-10-20T00:00:00.000Z");

describe("structural fidelity rubric", () => {
    it("scores preserved, partial and incorrect ratings with equal weights", () => {
        const criteria = createEmptyFidelityCriteria();
        criteria[0].rating = "PRESERVED";
        criteria[1].rating = "PARTIALLY_PRESERVED";
        criteria[2].rating = "NOT_PRESERVED";
        expect(scoreFidelityCriteria(criteria)).toMatchObject({ overallScore: 50, applicableCriteria: 3, unassessableCriteria: 3, status: "COMPLETE" });
    });
    it("excludes cannot-determine ratings and reports no evidence without a numeric score", () => {
        expect(scoreFidelityCriteria(createEmptyFidelityCriteria())).toMatchObject({ overallScore: null, applicableCriteria: 0, unassessableCriteria: 6, status: "INSUFFICIENT_EVIDENCE" });
        const criteria = createEmptyFidelityCriteria(); criteria[0].rating = "PRESERVED";
        expect(scoreFidelityCriteria(criteria)).toMatchObject({ overallScore: 100, applicableCriteria: 1, unassessableCriteria: 5 });
    });
    it("validates stable rubric definitions and deterministic computed fields", () => {
        const evaluation = make();
        expect(evaluation.rubricVersion).toBe(FIDELITY_RUBRIC_VERSION);
        expect(validateFidelityEvaluation(evaluation)).toEqual(evaluation);
        expect(() => validateFidelityEvaluation({ ...evaluation, overallScore: 100 })).toThrow(/score/);
        expect(() => validateFidelityEvaluation({ ...evaluation, criteria: [{ ...evaluation.criteria[0], reviewerNotes: "<script>".repeat(300) }, ...evaluation.criteria.slice(1)] })).toThrow(/criterion/);
    });
    it("supports immutable linked revisions as distinct records", () => {
        const first = make();
        const next = createFidelityEvaluation({ ...first, id: "evaluation-2", criteria: first.criteria, observations: [], discrepancies: [], limitations: [] }, "2026-10-21T00:00:00.000Z", first.id);
        expect(next).toMatchObject({ id: "evaluation-2", revisionOf: first.id, renderVersionId: first.renderVersionId });
        expect(first.id).not.toBe(next.id);
    });
});
