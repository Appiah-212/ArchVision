import { describe, expect, it } from "vitest";
import { calculateExperimentBenchmark, createResearchExperiment, experimentExport, experimentExportCsv, validateDatasetRegistration, validateResearchWorkspace, type ResearchProjectSummary, type ResearchWorkspace } from "../lib/research-evaluation";
import type { RenderVersion } from "../lib/render-version";
import { createEmptyFidelityCriteria, createFidelityEvaluation } from "../lib/fidelity-evaluation";

const source = "archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png";
const makeVersion = (id: string, projectId: string, generationMode: "baseline" | "enhanced", versionNumber: number): RenderVersion => ({ id, projectId, versionNumber, imageAssetReference: `archvision_private_asset:123e4567-e89b-12d3-a456-42661417400${versionNumber + 1}.png`, generationMode, modelIdentifier: "gemini-3.1-flash-image-preview", promptTemplateVersion: generationMode === "baseline" ? "archvision-baseline-v1" : "archvision-enhanced-v1", configurationSnapshot: null, approvedAnalysisRevision: null, createdAt: "2026-10-20T00:00:00.000Z", generationLatencyMs: versionNumber * 100, generationStatus: "complete" });
const projectId = "plan-1";
const baseline = makeVersion("version-base", projectId, "baseline", 1);
const enhanced = makeVersion("version-enh", projectId, "enhanced", 2);
const evaluation = (id: string, version: RenderVersion, rating: "PRESERVED" | "PARTIALLY_PRESERVED" | "NOT_PRESERVED" | "CANNOT_DETERMINE") => {
  const criteria = createEmptyFidelityCriteria(); criteria[0].rating = rating;
  return createFidelityEvaluation({ id, projectId, renderVersionId: version.id, sourceImageReference: source, generationProvenance: { versionNumber: version.versionNumber, generationMode: version.generationMode, modelIdentifier: version.modelIdentifier, promptTemplateVersion: version.promptTemplateVersion, configurationSnapshot: version.configurationSnapshot, renderCreatedAt: version.createdAt }, approvedAnalysisRevision: null, reviewerIdentifier: "reviewer-code", criteria, observations: [], discrepancies: [], limitations: [] }, "2026-10-20T01:00:00.000Z");
};
const workspace: ResearchWorkspace = { schemaVersion: 1, datasets: [{ registrationId: "reg-1", datasetIdentifier: "pilot-01", anonymousPlanIdentifier: "Plan-001", sourceProjectId: projectId, sourceCategory: "Residential", complexity: "MEDIUM", inclusionCriteria: ["Owner created"], exclusionCriteria: [], permissionStatus: "OWNER_CREATED", permissionNotes: "Created for research", status: "APPROVED", createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" }], experiments: [] };
const project: ResearchProjectSummary = { id: projectId, name: "Private Residence Name", versions: [baseline, enhanced], evaluations: [evaluation("eval-base", baseline, "PARTIALLY_PRESERVED"), evaluation("eval-enh", enhanced, "PRESERVED")], generationOutcomes: [{ mode: "baseline", status: "complete", latencyMs: 100, occurredAt: baseline.createdAt }, { mode: "enhanced", status: "complete", latencyMs: 200, occurredAt: enhanced.createdAt }] };
const experiment = createResearchExperiment({ experimentName: "Pilot", researchQuestion: "Compare modes", protocolVersion: "archvision-pilot-v1", datasetIdentifier: "pilot-01", evaluationRubricVersion: "archvision-structural-fidelity-v1", experimentalConditions: { controlledVariables: ["source plan", "rubric"], uncontrolledVariables: ["generation stochasticity"], notes: [] }, comparisons: [{ pairId: "pair-1", registrationId: "reg-1", sourceProjectId: projectId, baselineRenderVersionId: baseline.id, enhancedRenderVersionId: enhanced.id, baselineEvaluationRecordId: "eval-base", enhancedEvaluationRecordId: "eval-enh", baselinePresentedAsA: true, uncontrolledDifferences: [], limitations: [] }], blindReviewEnabled: true, experimentStatus: "IN_PROGRESS", notes: [], limitations: [] }, [project], "2026-10-20T02:00:00.000Z");

describe("Phase 2.6 research evaluation", () => {
  it("validates registry, typed protocol, and paired version associations", () => {
    expect(validateDatasetRegistration(workspace.datasets[0])).toEqual(workspace.datasets[0]);
    expect(validateResearchWorkspace({ ...workspace, experiments: [experiment] }).experiments[0]).toEqual(experiment);
    expect(() => validateDatasetRegistration({ ...workspace.datasets[0], permissionNotes: "x".repeat(1001) })).toThrow(/invalid/i);
    expect(() => createResearchExperiment({ ...experiment, comparisons: [{ ...experiment.comparisons[0], sourceProjectId: "other" }] }, [project])).toThrow(/unavailable|assessment/i);
  });
  it("calculates descriptive score, coverage, paired difference and latency without treating missing scores as zero", () => {
    const result = calculateExperimentBenchmark(experiment, { ...workspace, experiments: [experiment] }, [project], 7);
    expect(result).toMatchObject({ matchedEvaluablePairs: 1, incompletePairs: 0, pairedDifferences: { mean: 50 }, baselineGenerationLatency: { mean: 100 }, enhancedGenerationLatency: { mean: 200 }, recordedGenerationSuccessRate: 100, storageRetrievalLatencyMs: 7 });
    expect(result.pairResults[0].pairedDifference).toBe(50);
    expect(result.baselineCoverage.mean).toBeCloseTo(100 / 6, 5);
  });
  it("flags insufficient evidence and excludes missing values from paired differences", () => {
    const missing = createResearchExperiment({ ...experiment, comparisons: [{ ...experiment.comparisons[0], baselineEvaluationRecordId: null, enhancedEvaluationRecordId: null }] }, [project]);
    const result = calculateExperimentBenchmark(missing, { ...workspace, experiments: [missing] }, [project]);
    expect(result.matchedEvaluablePairs).toBe(0);
    expect(result.incompletePairs).toBe(1);
    expect(result.pairedDifferences.mean).toBeNull();
    expect(result.pairedDifferences.missingObservations).toBe(1);
  });
  it("exports useful reproducibility data without private project ids, names, image references or analysis snapshots", () => {
    const result = calculateExperimentBenchmark(experiment, { ...workspace, experiments: [experiment] }, [project]);
    const output = experimentExport(experiment, result, { ...workspace, experiments: [experiment] }, [project]);
    const json = JSON.stringify(output);
    expect(json).toContain("Plan-001"); expect(json).toContain("archvision-enhanced-v1");
    expect(json).not.toContain(projectId); expect(json).not.toContain("Private Residence Name"); expect(json).not.toContain("archvision_private_asset:"); expect(json).not.toContain("sourceImageReference");
    const csv = experimentExportCsv(experiment, { ...workspace, experiments: [experiment] }, [project]);
    expect(csv).toContain("paired_difference_enhanced_minus_baseline"); expect(csv).toContain("Plan-001"); expect(csv).not.toContain(projectId);
  });
  it("escapes spreadsheet formulas preceded by whitespace in research CSV fields", () => {
    const unsafe = { ...experiment, comparisons: experiment.comparisons.map((pair) => ({ ...pair, limitations: ["  \t=HYPERLINK(\"https://example.invalid\")"] })) };
    const csv = experimentExportCsv(unsafe, { ...workspace, experiments: [unsafe] }, [project]);
    expect(csv).toContain("'  \t=HYPERLINK");
  });
  it("preserves empty dataset and experiment states without invented rows", () => {
    const empty = validateResearchWorkspace({ schemaVersion: 1, datasets: [], experiments: [] });
    expect(empty).toEqual({ schemaVersion: 1, datasets: [], experiments: [] });
    expect(calculateExperimentBenchmark({ ...experiment, comparisons: [], sourceProjectIds: [], baselineRenderVersionIds: [], enhancedRenderVersionIds: [], evaluationRecordIds: [], generationModelIdentifiers: [], promptTemplateVersions: [], configurationSnapshots: [], generationSnapshots: [], analysisRevisionIdentifiers: [] }, empty, []).baselineFidelity.mean).toBeNull();
  });
});
