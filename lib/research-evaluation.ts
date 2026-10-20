import type { FidelityEvaluation, FidelityCriterionId } from "./fidelity-evaluation";
import type { RenderVersion } from "./render-version";
import { validateRenderConfiguration } from "./render-configuration";

export const RESEARCH_PROTOCOL_VERSION = "archvision-pilot-v1";
export const RESEARCH_WORKSPACE_SCHEMA_VERSION = 1 as const;
export type DatasetComplexity = "LOW" | "MEDIUM" | "HIGH" | "UNASSESSED";
export type PermissionStatus = "OWNER_CREATED" | "PERMISSION_DOCUMENTED" | "PENDING" | "EXCLUDED";
export type ExperimentStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETE";

export interface DatasetRegistration {
    registrationId: string;
    datasetIdentifier: string;
    anonymousPlanIdentifier: string;
    sourceProjectId: string;
    sourceCategory: string;
    complexity: DatasetComplexity;
    inclusionCriteria: string[];
    exclusionCriteria: string[];
    permissionStatus: PermissionStatus;
    permissionNotes: string;
    status: "APPROVED" | "EXCLUDED";
    createdAt: string;
    updatedAt: string;
}

export interface QualitativeReview {
    reviewerCode: string;
    completedAt: string;
    modeAComments: string;
    modeBComments: string;
    architecturalRealism: string;
    practicalUsefulness: string;
    layoutConsistency: string;
    visualClarity: string;
    reviewerConfidence: string;
    advantagesAndDisadvantages: string;
}

export interface PairedComparison {
    pairId: string;
    registrationId: string;
    sourceProjectId: string;
    baselineRenderVersionId: string;
    enhancedRenderVersionId: string;
    baselineEvaluationRecordId: string | null;
    enhancedEvaluationRecordId: string | null;
    baselinePresentedAsA: boolean;
    uncontrolledDifferences: string[];
    limitations: string[];
    qualitativeReview?: QualitativeReview;
}

export interface RenderGenerationSnapshot {
    renderVersionId: string;
    generationMode: "baseline" | "enhanced";
    modelIdentifier: string;
    promptTemplateVersion: string;
    configurationSnapshot: RenderVersion["configurationSnapshot"];
    approvedAnalysisRevision: number | null;
    generatedAt: string;
    generationLatencyMs: number | null;
    generationStatus: "complete";
}

export interface ResearchExperiment {
    experimentId: string;
    experimentName: string;
    researchQuestion: string;
    protocolVersion: string;
    datasetIdentifier: string;
    sourceProjectIds: string[];
    baselineRenderVersionIds: string[];
    enhancedRenderVersionIds: string[];
    evaluationRecordIds: string[];
    evaluationRubricVersion: string;
    generationModelIdentifiers: string[];
    promptTemplateVersions: string[];
    configurationSnapshots: Array<{ renderVersionId: string; snapshot: RenderVersion["configurationSnapshot"] }>;
    generationSnapshots: RenderGenerationSnapshot[];
    analysisRevisionIdentifiers: Array<{ projectId: string; revision: number | null }>;
    experimentalConditions: {
        controlledVariables: string[];
        uncontrolledVariables: string[];
        notes: string[];
    };
    comparisons: PairedComparison[];
    blindReviewEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    experimentStatus: ExperimentStatus;
    notes: string[];
    limitations: string[];
}

export interface ResearchWorkspace {
    schemaVersion: typeof RESEARCH_WORKSPACE_SCHEMA_VERSION;
    datasets: DatasetRegistration[];
    experiments: ResearchExperiment[];
}

export interface ResearchProjectSummary {
    id: string;
    name: string;
    versions: RenderVersion[];
    evaluations: FidelityEvaluation[];
    generationOutcomes: Array<{ mode: "baseline" | "enhanced"; status: "complete" | "failed"; latencyMs?: number; occurredAt: string }>;
    warnings?: string[];
}

export interface ResearchWorkspaceResponse {
    workspace: ResearchWorkspace;
    projects: ResearchProjectSummary[];
    retrievalLatencyMs: number;
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const only = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).every((key) => fields.includes(key));
const str = (v: unknown, max = 200, optional = false): v is string => typeof v === "string" && v.length <= max && (optional || !!v.trim());
const list = (v: unknown, max = 100): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => str(x, 1000, true));
const enumValue = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === "string" && values.includes(value as T);
const validConfiguration = (value: unknown) => { if (value === null) return true; try { validateRenderConfiguration(value); return true; } catch { return false; } };

export const validateDatasetRegistration = (value: unknown): DatasetRegistration => {
    if (!record(value) || !only(value, ["registrationId", "datasetIdentifier", "anonymousPlanIdentifier", "sourceProjectId", "sourceCategory", "complexity", "inclusionCriteria", "exclusionCriteria", "permissionStatus", "permissionNotes", "status", "createdAt", "updatedAt"]) || !str(value.registrationId, 160) || !str(value.datasetIdentifier, 80) || !str(value.anonymousPlanIdentifier, 80) ||
        !str(value.sourceProjectId, 200) || !str(value.sourceCategory, 120) || !enumValue(value.complexity, ["LOW", "MEDIUM", "HIGH", "UNASSESSED"] as const) ||
        !list(value.inclusionCriteria) || !list(value.exclusionCriteria) || !enumValue(value.permissionStatus, ["OWNER_CREATED", "PERMISSION_DOCUMENTED", "PENDING", "EXCLUDED"] as const) ||
        !str(value.permissionNotes, 1000, true) || !enumValue(value.status, ["APPROVED", "EXCLUDED"] as const) ||
        !str(value.createdAt, 80) || !Number.isFinite(Date.parse(value.createdAt)) || !str(value.updatedAt, 80) || !Number.isFinite(Date.parse(value.updatedAt))) {
        throw new Error("Dataset registration is invalid.");
    }
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value.datasetIdentifier) || !/^[A-Za-z0-9_-]{1,80}$/.test(value.anonymousPlanIdentifier)) throw new Error("Dataset and anonymous plan identifiers must use letters, numbers, hyphens, or underscores only.");
    return value as unknown as DatasetRegistration;
};

const validateQualitativeReview = (value: unknown): QualitativeReview => {
    if (!record(value) || !only(value, ["reviewerCode", "completedAt", "modeAComments", "modeBComments", "architecturalRealism", "practicalUsefulness", "layoutConsistency", "visualClarity", "reviewerConfidence", "advantagesAndDisadvantages"]) || !str(value.reviewerCode, 120) || !str(value.completedAt, 80) || !Number.isFinite(Date.parse(value.completedAt)) ||
        !str(value.modeAComments, 3000, true) || !str(value.modeBComments, 3000, true) || !str(value.architecturalRealism, 2000, true) ||
        !str(value.practicalUsefulness, 2000, true) || !str(value.layoutConsistency, 2000, true) || !str(value.visualClarity, 2000, true) ||
        !str(value.reviewerConfidence, 1000, true) || !str(value.advantagesAndDisadvantages, 3000, true)) throw new Error("Qualitative review is invalid.");
    return value as unknown as QualitativeReview;
};

const validatePair = (value: unknown): PairedComparison => {
    if (!record(value) || !only(value, ["pairId", "registrationId", "sourceProjectId", "baselineRenderVersionId", "enhancedRenderVersionId", "baselineEvaluationRecordId", "enhancedEvaluationRecordId", "baselinePresentedAsA", "uncontrolledDifferences", "limitations", "qualitativeReview"]) || !str(value.pairId, 160) || !str(value.registrationId, 160) || !str(value.sourceProjectId, 200) ||
        !str(value.baselineRenderVersionId, 160) || !str(value.enhancedRenderVersionId, 160) || value.baselineRenderVersionId === value.enhancedRenderVersionId ||
        !(value.baselineEvaluationRecordId === null || str(value.baselineEvaluationRecordId, 160)) ||
        !(value.enhancedEvaluationRecordId === null || str(value.enhancedEvaluationRecordId, 160)) || typeof value.baselinePresentedAsA !== "boolean" ||
        !list(value.uncontrolledDifferences) || !list(value.limitations) ||
        (value.qualitativeReview !== undefined && !record(value.qualitativeReview))) throw new Error("Paired comparison is invalid.");
    return { ...value, ...(value.qualitativeReview ? { qualitativeReview: validateQualitativeReview(value.qualitativeReview) } : {}) } as PairedComparison;
};

export const validateResearchExperiment = (value: unknown): ResearchExperiment => {
    if (!record(value) || !only(value, ["experimentId", "experimentName", "researchQuestion", "protocolVersion", "datasetIdentifier", "sourceProjectIds", "baselineRenderVersionIds", "enhancedRenderVersionIds", "evaluationRecordIds", "evaluationRubricVersion", "generationModelIdentifiers", "promptTemplateVersions", "configurationSnapshots", "generationSnapshots", "analysisRevisionIdentifiers", "experimentalConditions", "comparisons", "blindReviewEnabled", "createdAt", "updatedAt", "experimentStatus", "notes", "limitations"]) || !str(value.experimentId, 160) || !str(value.experimentName, 160) || !str(value.researchQuestion, 1000) ||
        !str(value.protocolVersion, 100) || !str(value.datasetIdentifier, 80) || !list(value.sourceProjectIds) ||
        !list(value.baselineRenderVersionIds) || !list(value.enhancedRenderVersionIds) || !list(value.evaluationRecordIds) ||
        !str(value.evaluationRubricVersion, 100) || value.evaluationRubricVersion !== "archvision-structural-fidelity-v1" || !list(value.generationModelIdentifiers) || !list(value.promptTemplateVersions) ||
        !Array.isArray(value.configurationSnapshots) || !Array.isArray(value.generationSnapshots) || !Array.isArray(value.analysisRevisionIdentifiers) || !record(value.experimentalConditions) ||
        !only(value.experimentalConditions, ["controlledVariables", "uncontrolledVariables", "notes"]) || !list(value.experimentalConditions.controlledVariables) || !list(value.experimentalConditions.uncontrolledVariables) || !list(value.experimentalConditions.notes) ||
        !Array.isArray(value.comparisons) || !value.comparisons.every((pair) => { try { validatePair(pair); return true; } catch { return false; } }) ||
        typeof value.blindReviewEnabled !== "boolean" || !str(value.createdAt, 80) || !Number.isFinite(Date.parse(value.createdAt)) ||
        !str(value.updatedAt, 80) || !Number.isFinite(Date.parse(value.updatedAt)) || !enumValue(value.experimentStatus, ["PLANNED", "IN_PROGRESS", "COMPLETE"] as const) ||
        !list(value.notes) || !list(value.limitations)) throw new Error("Research experiment is invalid.");
    const pairs = (value.comparisons as unknown[]).map(validatePair);
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    const expected = {
        sourceProjectIds: [...new Set(pairs.map((p) => p.sourceProjectId))].sort(),
        baselineRenderVersionIds: [...new Set(pairs.map((p) => p.baselineRenderVersionId))].sort(),
        enhancedRenderVersionIds: [...new Set(pairs.map((p) => p.enhancedRenderVersionId))].sort(),
        evaluationRecordIds: [...new Set(pairs.flatMap((p) => [p.baselineEvaluationRecordId, p.enhancedEvaluationRecordId].filter((x): x is string => Boolean(x))))].sort(),
    };
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        const supplied = value[key] as string[];
        if (!unique(supplied) || JSON.stringify([...supplied].sort()) !== JSON.stringify(expected[key])) throw new Error(`Experiment ${key} do not match its paired comparisons.`);
    }
    if (new Set(pairs.map((p) => p.pairId)).size !== pairs.length) throw new Error("Experiment contains duplicate comparison ids.");
    const snapshots = value.configurationSnapshots as unknown[];
    if (!snapshots.every((item) => record(item) && only(item, ["renderVersionId", "snapshot"]) && str(item.renderVersionId, 160) && validConfiguration(item.snapshot))) throw new Error("Experiment configuration snapshots are invalid.");
    const generations = value.generationSnapshots as unknown[];
    if (!generations.every((item) => record(item) && only(item, ["renderVersionId", "generationMode", "modelIdentifier", "promptTemplateVersion", "configurationSnapshot", "approvedAnalysisRevision", "generatedAt", "generationLatencyMs", "generationStatus"]) && str(item.renderVersionId, 160) && enumValue(item.generationMode, ["baseline", "enhanced"] as const) && str(item.modelIdentifier, 120) && str(item.promptTemplateVersion, 120) && validConfiguration(item.configurationSnapshot) && (item.approvedAnalysisRevision === null || (Number.isSafeInteger(item.approvedAnalysisRevision) && Number(item.approvedAnalysisRevision) > 0)) && str(item.generatedAt, 80) && Number.isFinite(Date.parse(item.generatedAt)) && (item.generationLatencyMs === null || (Number.isSafeInteger(item.generationLatencyMs) && Number(item.generationLatencyMs) >= 0)) && item.generationStatus === "complete")) throw new Error("Experiment generation snapshots are invalid.");
    const selectedRenderIds = [...new Set([...expected.baselineRenderVersionIds, ...expected.enhancedRenderVersionIds])].sort();
    const snapshotIds = generations.map((item) => (item as Record<string, unknown>).renderVersionId as string).sort();
    const configIds = snapshots.map((item) => (item as Record<string, unknown>).renderVersionId as string).sort();
    if (JSON.stringify(snapshotIds) !== JSON.stringify(selectedRenderIds) || JSON.stringify(configIds) !== JSON.stringify(selectedRenderIds) || generations.length !== selectedRenderIds.length || snapshots.length !== selectedRenderIds.length) throw new Error("Experiment snapshots do not match its selected render versions.");
    const generationRecords = generations as Array<Record<string, unknown>>;
    const uniqueValues = (items: unknown[]) => [...new Set(items)].sort();
    if (JSON.stringify(uniqueValues(generationRecords.map((item) => item.modelIdentifier))) !== JSON.stringify([...value.generationModelIdentifiers as string[]].sort()) || JSON.stringify(uniqueValues(generationRecords.map((item) => item.promptTemplateVersion))) !== JSON.stringify([...value.promptTemplateVersions as string[]].sort())) throw new Error("Experiment model and prompt metadata do not match its generation snapshots.");
    const revisions = value.analysisRevisionIdentifiers as unknown[];
    if (!revisions.every((item) => record(item) && only(item, ["projectId", "revision"]) && str(item.projectId, 200) && (item.revision === null || (Number.isSafeInteger(item.revision) && Number(item.revision) > 0)))) throw new Error("Experiment analysis revisions are invalid.");
    return { ...value, comparisons: pairs } as unknown as ResearchExperiment;
};

export const validateResearchWorkspace = (value: unknown): ResearchWorkspace => {
    if (!record(value) || !only(value, ["schemaVersion", "datasets", "experiments"]) || value.schemaVersion !== RESEARCH_WORKSPACE_SCHEMA_VERSION || !Array.isArray(value.datasets) || !Array.isArray(value.experiments)) throw new Error("Research workspace is invalid.");
    const datasets = value.datasets.map(validateDatasetRegistration);
    const experiments = value.experiments.map(validateResearchExperiment);
    if (new Set(datasets.map((d) => d.registrationId)).size !== datasets.length || new Set(experiments.map((e) => e.experimentId)).size !== experiments.length) throw new Error("Research workspace contains duplicate record ids.");
    return { schemaVersion: RESEARCH_WORKSPACE_SCHEMA_VERSION, datasets, experiments };
};

export const createEmptyResearchWorkspace = (): ResearchWorkspace => ({ schemaVersion: RESEARCH_WORKSPACE_SCHEMA_VERSION, datasets: [], experiments: [] });

export interface MetricSummary { sampleSize: number; mean: number | null; median: number | null; minimum: number | null; maximum: number | null; standardDeviation: number | null; missingObservations: number; }
const summarize = (values: number[], total: number): MetricSummary => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { sampleSize: 0, mean: null, median: null, minimum: null, maximum: null, standardDeviation: null, missingObservations: total };
    const mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length;
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const standardDeviation = sorted.length > 1 ? Math.sqrt(sorted.reduce((sum, n) => sum + ((n - mean) ** 2), 0) / (sorted.length - 1)) : null;
    return { sampleSize: sorted.length, mean, median, minimum: sorted[0], maximum: sorted[sorted.length - 1], standardDeviation, missingObservations: Math.max(0, total - sorted.length) };
};
const evaluationMap = (evaluations: FidelityEvaluation[]) => new Map(evaluations.map((e) => [e.id, e]));
const renderMap = (projects: ResearchProjectSummary[]) => new Map(projects.flatMap((p) => p.versions.map((v) => [v.id, v] as const)));
const criterionIds: FidelityCriterionId[] = ["room_count", "room_function", "spatial_relationship", "major_walls", "doors_windows", "missing_invented"];

export interface PairBenchmark {
    pairId: string; anonymousPlanIdentifier: string; baselineScore: number | null; enhancedScore: number | null; pairedDifference: number | null;
    baselineCoverage: number; enhancedCoverage: number; baselineEvaluationPresent: boolean; enhancedEvaluationPresent: boolean; insufficientEvidence: boolean; coverageWarning: boolean;
    baselineDiscrepancies: number | null; enhancedDiscrepancies: number | null; baselineLatencyMs: number | null; enhancedLatencyMs: number | null;
    criterionDifferences: Array<{ criterionId: FidelityCriterionId; baseline: number | null; enhanced: number | null; difference: number | null }>;
}
export interface ExperimentBenchmark {
    pairResults: PairBenchmark[]; matchedEvaluablePairs: number; incompletePairs: number;
    baselineFidelity: MetricSummary; enhancedFidelity: MetricSummary; pairedDifferences: MetricSummary;
    baselineCoverage: MetricSummary; enhancedCoverage: MetricSummary;
    baselineDiscrepancies: MetricSummary; enhancedDiscrepancies: MetricSummary;
    baselineGenerationLatency: MetricSummary; enhancedGenerationLatency: MetricSummary;
    recordedGenerationSuccessRate: number | null; baselineGenerationSuccessRate: number | null; enhancedGenerationSuccessRate: number | null; recordedSuccesses: number; recordedFailures: number; unassessableCriteria: number;
    criterionConsistency: Array<{ criterionId: FidelityCriterionId; baselineAssessable: number; baselineCannotDetermine: number; baselineMeanPoints: number | null; enhancedAssessable: number; enhancedCannotDetermine: number; enhancedMeanPoints: number | null }>;
    missingObservations: number; storageRetrievalLatencyMs: number | null;
}

const evalScore = (e: FidelityEvaluation | undefined) => e?.status === "COMPLETE" ? e.overallScore : null;
const points = (evaluation: FidelityEvaluation | undefined, id: FidelityCriterionId): number | null => {
    const rating = evaluation?.criteria.find((c) => c.criterionId === id)?.rating;
    return rating === "PRESERVED" ? 2 : rating === "PARTIALLY_PRESERVED" ? 1 : rating === "NOT_PRESERVED" ? 0 : null;
};

export const calculateExperimentBenchmark = (experiment: ResearchExperiment, workspace: ResearchWorkspace, projects: ResearchProjectSummary[], retrievalLatencyMs: number | null = null): ExperimentBenchmark => {
    const evaluations = evaluationMap(projects.flatMap((p) => p.evaluations));
    const renders = renderMap(projects);
    const generationSnapshots = new Map(experiment.generationSnapshots.map((snapshot) => [snapshot.renderVersionId, snapshot]));
    const registrations = new Map(workspace.datasets.map((d) => [d.registrationId, d]));
    const pairResults = experiment.comparisons.map((pair): PairBenchmark => {
        const baseline = pair.baselineEvaluationRecordId ? evaluations.get(pair.baselineEvaluationRecordId) : undefined;
        const enhanced = pair.enhancedEvaluationRecordId ? evaluations.get(pair.enhancedEvaluationRecordId) : undefined;
        const bScore = evalScore(baseline); const eScore = evalScore(enhanced);
        const bCoverage = baseline ? baseline.applicableCriteria / 6 : 0;
        const eCoverage = enhanced ? enhanced.applicableCriteria / 6 : 0;
        return {
            pairId: pair.pairId, anonymousPlanIdentifier: registrations.get(pair.registrationId)?.anonymousPlanIdentifier ?? "Unregistered plan",
            baselineScore: bScore, enhancedScore: eScore, pairedDifference: bScore !== null && eScore !== null ? eScore - bScore : null,
            baselineCoverage: bCoverage, enhancedCoverage: eCoverage, baselineEvaluationPresent: Boolean(baseline), enhancedEvaluationPresent: Boolean(enhanced), insufficientEvidence: bScore === null || eScore === null,
            coverageWarning: Math.abs(bCoverage - eCoverage) > (1 / 6), baselineDiscrepancies: baseline ? baseline.discrepancies.length : null,
            enhancedDiscrepancies: enhanced ? enhanced.discrepancies.length : null, baselineLatencyMs: renders.get(pair.baselineRenderVersionId)?.generationLatencyMs ?? generationSnapshots.get(pair.baselineRenderVersionId)?.generationLatencyMs ?? null,
            enhancedLatencyMs: renders.get(pair.enhancedRenderVersionId)?.generationLatencyMs ?? generationSnapshots.get(pair.enhancedRenderVersionId)?.generationLatencyMs ?? null,
            criterionDifferences: criterionIds.map((criterionId) => { const b = points(baseline, criterionId); const e = points(enhanced, criterionId); return { criterionId, baseline: b, enhanced: e, difference: b !== null && e !== null ? e - b : null }; }),
        };
    });
    const baselineScores = pairResults.map((p) => p.baselineScore).filter((x): x is number => x !== null);
    const enhancedScores = pairResults.map((p) => p.enhancedScore).filter((x): x is number => x !== null);
    const differences = pairResults.map((p) => p.pairedDifference).filter((x): x is number => x !== null);
    const allEvals = experiment.comparisons.flatMap((pair) => [pair.baselineEvaluationRecordId ? evaluations.get(pair.baselineEvaluationRecordId) : undefined, pair.enhancedEvaluationRecordId ? evaluations.get(pair.enhancedEvaluationRecordId) : undefined]);
    const allSelectedEvals = allEvals.filter((e): e is FidelityEvaluation => Boolean(e));
    const outcomes = experiment.sourceProjectIds.flatMap((id) => projects.find((p) => p.id === id)?.generationOutcomes ?? []);
    const successes = outcomes.filter((o) => o.status === "complete").length; const failures = outcomes.filter((o) => o.status === "failed").length;
    const successRate = (items: typeof outcomes) => items.length ? items.filter((item) => item.status === "complete").length / items.length * 100 : null;
    const bLatencies = pairResults.map((p) => p.baselineLatencyMs).filter((x): x is number => x !== null);
    const eLatencies = pairResults.map((p) => p.enhancedLatencyMs).filter((x): x is number => x !== null);
    const criterionConsistency = criterionIds.map((id) => {
        const b = experiment.comparisons.map((pair) => pair.baselineEvaluationRecordId ? points(evaluations.get(pair.baselineEvaluationRecordId), id) : null).filter((x): x is number => x !== null);
        const e = experiment.comparisons.map((pair) => pair.enhancedEvaluationRecordId ? points(evaluations.get(pair.enhancedEvaluationRecordId), id) : null).filter((x): x is number => x !== null);
        const bCannot = experiment.comparisons.filter((pair) => pair.baselineEvaluationRecordId && evaluations.get(pair.baselineEvaluationRecordId)?.criteria.find((criterion) => criterion.criterionId === id)?.rating === "CANNOT_DETERMINE").length;
        const eCannot = experiment.comparisons.filter((pair) => pair.enhancedEvaluationRecordId && evaluations.get(pair.enhancedEvaluationRecordId)?.criteria.find((criterion) => criterion.criterionId === id)?.rating === "CANNOT_DETERMINE").length;
        return { criterionId: id, baselineAssessable: b.length, baselineCannotDetermine: bCannot, baselineMeanPoints: b.length ? b.reduce((a, n) => a + n, 0) / b.length : null, enhancedAssessable: e.length, enhancedCannotDetermine: eCannot, enhancedMeanPoints: e.length ? e.reduce((a, n) => a + n, 0) / e.length : null };
    });
    return {
        pairResults, matchedEvaluablePairs: differences.length, incompletePairs: pairResults.filter((p) => p.insufficientEvidence).length,
        baselineFidelity: summarize(baselineScores, experiment.comparisons.length), enhancedFidelity: summarize(enhancedScores, experiment.comparisons.length), pairedDifferences: summarize(differences, experiment.comparisons.length),
        baselineCoverage: summarize(pairResults.filter((p) => experiment.comparisons.find((pair) => pair.pairId === p.pairId)?.baselineEvaluationRecordId).map((p) => p.baselineCoverage * 100), experiment.comparisons.length),
        enhancedCoverage: summarize(pairResults.filter((p) => experiment.comparisons.find((pair) => pair.pairId === p.pairId)?.enhancedEvaluationRecordId).map((p) => p.enhancedCoverage * 100), experiment.comparisons.length),
        baselineDiscrepancies: summarize(pairResults.map((p) => p.baselineDiscrepancies).filter((x): x is number => x !== null), experiment.comparisons.length), enhancedDiscrepancies: summarize(pairResults.map((p) => p.enhancedDiscrepancies).filter((x): x is number => x !== null), experiment.comparisons.length),
        baselineGenerationLatency: summarize(bLatencies, experiment.comparisons.length), enhancedGenerationLatency: summarize(eLatencies, experiment.comparisons.length),
        recordedGenerationSuccessRate: successRate(outcomes), baselineGenerationSuccessRate: successRate(outcomes.filter((item) => item.mode === "baseline")), enhancedGenerationSuccessRate: successRate(outcomes.filter((item) => item.mode === "enhanced")), recordedSuccesses: successes, recordedFailures: failures,
        unassessableCriteria: allSelectedEvals.reduce((sum, e) => sum + e.unassessableCriteria, 0),
        criterionConsistency, missingObservations: pairResults.reduce((total, p) => total + (p.baselineScore === null ? 1 : 0) + (p.enhancedScore === null ? 1 : 0) + (p.baselineLatencyMs === null ? 1 : 0) + (p.enhancedLatencyMs === null ? 1 : 0), 0),
        storageRetrievalLatencyMs: retrievalLatencyMs,
    };
};

export const createResearchExperiment = (input: Omit<ResearchExperiment, "experimentId" | "createdAt" | "updatedAt" | "sourceProjectIds" | "baselineRenderVersionIds" | "enhancedRenderVersionIds" | "evaluationRecordIds" | "generationModelIdentifiers" | "promptTemplateVersions" | "configurationSnapshots" | "generationSnapshots" | "analysisRevisionIdentifiers"> & { experimentId?: string }, projects: ResearchProjectSummary[], now = new Date().toISOString()): ResearchExperiment => {
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const pairs = input.comparisons;
    const selected = pairs.flatMap((pair) => {
        const project = projectById.get(pair.sourceProjectId);
        if (!project) throw new Error("A paired comparison references an unavailable source project.");
        const baseline = project.versions.find((v) => v.id === pair.baselineRenderVersionId);
        const enhanced = project.versions.find((v) => v.id === pair.enhancedRenderVersionId);
        if (!baseline || !enhanced || baseline.generationMode !== "baseline" || enhanced.generationMode !== "enhanced") throw new Error("Select one existing baseline and one existing enhanced render for each plan.");
        return [baseline, enhanced];
    });
    // A render can be reused by more than one pair. Keep one provenance record
    // per render version, matching the workspace schema's unique render IDs.
    const uniqueSelected = [...new Map(selected.map((version) => [version.id, version])).values()];
    const evals = projects.flatMap((p) => p.evaluations);
    const record = (pair: PairedComparison, id: string | null, renderId: string) => {
        if (id === null) return;
        const evaluation = evals.find((e) => e.id === id);
        if (!evaluation || evaluation.projectId !== pair.sourceProjectId || evaluation.renderVersionId !== renderId) throw new Error("A selected fidelity assessment does not match its render version.");
    };
    pairs.forEach((pair) => { record(pair, pair.baselineEvaluationRecordId, pair.baselineRenderVersionId); record(pair, pair.enhancedEvaluationRecordId, pair.enhancedRenderVersionId); });
    const revisions = new Map<string, number | null>();
    for (const render of uniqueSelected) if (!revisions.has(render.projectId)) revisions.set(render.projectId, render.approvedAnalysisRevision);
    return validateResearchExperiment({
        ...input, experimentId: input.experimentId ?? crypto.randomUUID(), createdAt: now, updatedAt: now,
        sourceProjectIds: [...new Set(pairs.map((p) => p.sourceProjectId))],
        baselineRenderVersionIds: [...new Set(pairs.map((p) => p.baselineRenderVersionId))], enhancedRenderVersionIds: [...new Set(pairs.map((p) => p.enhancedRenderVersionId))],
        evaluationRecordIds: [...new Set(pairs.flatMap((p) => [p.baselineEvaluationRecordId, p.enhancedEvaluationRecordId].filter((x): x is string => Boolean(x))))],
        evaluationRubricVersion: "archvision-structural-fidelity-v1",
        generationModelIdentifiers: [...new Set(uniqueSelected.map((v) => v.modelIdentifier))], promptTemplateVersions: [...new Set(uniqueSelected.map((v) => v.promptTemplateVersion))],
        configurationSnapshots: uniqueSelected.map((v) => ({ renderVersionId: v.id, snapshot: v.configurationSnapshot })),
        generationSnapshots: uniqueSelected.map((v) => ({ renderVersionId: v.id, generationMode: v.generationMode, modelIdentifier: v.modelIdentifier, promptTemplateVersion: v.promptTemplateVersion, configurationSnapshot: v.configurationSnapshot, approvedAnalysisRevision: v.approvedAnalysisRevision, generatedAt: v.createdAt, generationLatencyMs: v.generationLatencyMs ?? null, generationStatus: "complete" })),
        analysisRevisionIdentifiers: [...revisions].map(([projectId, revision]) => ({ projectId, revision })),
    });
};

/** Rebuild derived provenance snapshots when loading records written by older page versions. */
export const repairResearchWorkspaceSnapshots = (value: unknown, projects: ResearchProjectSummary[]) => {
    if (!record(value) || !Array.isArray(value.experiments)) return { workspace: value, changed: false };
    let changed = false;
    const experiments = value.experiments.map((candidate) => {
        if (!record(candidate) || !Array.isArray(candidate.comparisons) ||
            typeof candidate.experimentId !== "string" || typeof candidate.createdAt !== "string" ||
            typeof candidate.updatedAt !== "string") return candidate;
        try {
            const rebuilt = createResearchExperiment(
                candidate as unknown as Parameters<typeof createResearchExperiment>[0],
                projects,
                candidate.createdAt,
            );
            rebuilt.updatedAt = candidate.updatedAt;
            const derivedFields = [
                "sourceProjectIds",
                "baselineRenderVersionIds",
                "enhancedRenderVersionIds",
                "evaluationRecordIds",
                "generationModelIdentifiers",
                "promptTemplateVersions",
                "configurationSnapshots",
                "generationSnapshots",
                "analysisRevisionIdentifiers",
            ] as const;
            if (!derivedFields.some((field) =>
                JSON.stringify(candidate[field]) !== JSON.stringify(rebuilt[field]))) return candidate;
            changed = true;
            return rebuilt;
        } catch {
            return candidate;
        }
    });
    return { workspace: changed ? { ...value, experiments } : value, changed };
};

export const experimentExport = (experiment: ResearchExperiment, benchmark: ExperimentBenchmark, workspace: ResearchWorkspace, projects: ResearchProjectSummary[]) => {
    const registrations = new Map(workspace.datasets.map((d) => [d.registrationId, d]));
    const evals = evaluationMap(projects.flatMap((p) => p.evaluations)); const renders = renderMap(projects);
    const redact = (value: unknown): unknown => {
        if (typeof value === "string") {
            let result = value.replace(/archvision_private_asset:[a-f0-9-]+\.(?:png|jpe?g|webp|gif)/gi, "[private image reference]");
            for (const project of projects) for (const privateText of [project.id, project.name]) if (privateText) result = result.replaceAll(privateText, "[redacted project]");
            return result;
        }
        if (Array.isArray(value)) return value.map(redact);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
        return value;
    };
    const safeRender = (version: RenderVersion | undefined) => version ? ({ id: version.id, versionNumber: version.versionNumber, generationMode: version.generationMode, modelIdentifier: version.modelIdentifier, promptTemplateVersion: version.promptTemplateVersion, configurationSnapshot: version.configurationSnapshot, approvedAnalysisRevision: version.approvedAnalysisRevision, createdAt: version.createdAt, generationStatus: version.generationStatus, generationLatencyMs: version.generationLatencyMs ?? null }) : null;
    const safeEvaluation = (evaluation: FidelityEvaluation | undefined) => evaluation ? ({ id: evaluation.id, renderVersionId: evaluation.renderVersionId, rubricVersion: evaluation.rubricVersion, evaluationMethod: evaluation.evaluationMethod, createdAt: evaluation.createdAt, updatedAt: evaluation.updatedAt, criteria: evaluation.criteria, overallScore: evaluation.overallScore, applicableCriteria: evaluation.applicableCriteria, unassessableCriteria: evaluation.unassessableCriteria, observations: evaluation.observations, discrepancies: evaluation.discrepancies, limitations: evaluation.limitations, status: evaluation.status }) : null;
    const { sourceProjectIds: _privateProjectIds, comparisons: _comparisons, analysisRevisionIdentifiers: _privateRevisionIdentifiers, ...safeExperiment } = experiment;
    const exported = { exportVersion: "archvision-research-export-v1", protocolVersion: experiment.protocolVersion, evaluationRubricVersion: experiment.evaluationRubricVersion, experiment: safeExperiment, analysisRevisionIdentifiers: experiment.analysisRevisionIdentifiers.map((item) => ({ anonymousPlanIdentifier: workspace.datasets.find((d) => d.sourceProjectId === item.projectId)?.anonymousPlanIdentifier ?? "unknown", revision: item.revision })), scoreDisclaimer: "Rubric-based human visual assessment; not geometric accuracy.", dataDictionary: { anonymousPlanIdentifier: "Research pseudonym for one registered floor plan.", generationMode: "Recorded render mode; baseline or enhanced.", fidelityScore: "Human rubric-based visual score from 0 to 100; null if insufficient evidence.", coverage: "Applicable rubric criteria divided by six; cannot-determine criteria are excluded from scoring.", pairedDifference: "Enhanced score minus baseline score in percentage points; null unless both evaluations are complete." }, pairs: experiment.comparisons.map((pair) => ({ anonymousPlanIdentifier: registrations.get(pair.registrationId)?.anonymousPlanIdentifier ?? "unknown", pairId: pair.pairId, baselinePresentedAsA: pair.baselinePresentedAsA, baselineRenderVersionId: pair.baselineRenderVersionId, enhancedRenderVersionId: pair.enhancedRenderVersionId, baselineEvaluationRecordId: pair.baselineEvaluationRecordId, enhancedEvaluationRecordId: pair.enhancedEvaluationRecordId, uncontrolledDifferences: pair.uncontrolledDifferences, limitations: pair.limitations, qualitativeReview: pair.qualitativeReview ? (({ reviewerCode: _reviewerCode, ...review }) => review)(pair.qualitativeReview) : null, baselineRender: safeRender(renders.get(pair.baselineRenderVersionId)), enhancedRender: safeRender(renders.get(pair.enhancedRenderVersionId)), baselineEvaluation: safeEvaluation(pair.baselineEvaluationRecordId ? evals.get(pair.baselineEvaluationRecordId) : undefined), enhancedEvaluation: safeEvaluation(pair.enhancedEvaluationRecordId ? evals.get(pair.enhancedEvaluationRecordId) : undefined) })), benchmark };
    return redact(exported);
};

export const experimentExportCsv = (experiment: ResearchExperiment, workspace: ResearchWorkspace, projects: ResearchProjectSummary[]): string => {
    const registrationMap = new Map(workspace.datasets.map((d) => [d.registrationId, d]));
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const redact = (value: string) => { let result = value.replace(/archvision_private_asset:[a-f0-9-]+\.(?:png|jpe?g|webp|gif)/gi, "[private image reference]"); for (const project of projects) for (const privateText of [project.id, project.name]) if (privateText) result = result.replaceAll(privateText, "[redacted project]"); return result; };
    const quote = (v: unknown) => { const raw = redact(String(v ?? "")); const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
    const criterionColumns = ["room_count", "room_function", "spatial_relationship", "major_walls", "doors_windows", "missing_invented"];
    const header = ["experiment_id", "experiment_created_at", "protocol_version", "rubric_version", "anonymous_plan_id", "baseline_render_id", "baseline_mode", "baseline_generation_status", "baseline_generation_created_at", "baseline_model", "baseline_prompt", "baseline_configuration_snapshot", "baseline_analysis_revision", "baseline_evaluation_id", "baseline_evaluation_created_at", "baseline_score", "baseline_coverage", "baseline_evaluation_status", "baseline_latency_ms", "baseline_recorded_successes", "baseline_recorded_failures", ...criterionColumns.map((x) => `baseline_${x}_rating`), "baseline_reviewer_comments", "baseline_discrepancies", "enhanced_render_id", "enhanced_mode", "enhanced_generation_status", "enhanced_generation_created_at", "enhanced_model", "enhanced_prompt", "enhanced_configuration_snapshot", "enhanced_analysis_revision", "enhanced_evaluation_id", "enhanced_evaluation_created_at", "enhanced_score", "enhanced_coverage", "enhanced_evaluation_status", "enhanced_latency_ms", "enhanced_recorded_successes", "enhanced_recorded_failures", ...criterionColumns.map((x) => `enhanced_${x}_rating`), "enhanced_reviewer_comments", "enhanced_discrepancies", "paired_difference_enhanced_minus_baseline", "missing_evidence", "limitations", "blind_review_image_a_comments", "blind_review_image_b_comments", "blind_review_architectural_realism", "blind_review_practical_usefulness", "blind_review_layout_consistency", "blind_review_visual_clarity", "blind_review_reviewer_confidence", "blind_review_advantages_disadvantages"];
    const rows = experiment.comparisons.map((pair) => {
        const project = projectMap.get(pair.sourceProjectId); const b = project?.versions.find((v) => v.id === pair.baselineRenderVersionId); const e = project?.versions.find((v) => v.id === pair.enhancedRenderVersionId);
        const be = pair.baselineEvaluationRecordId ? project?.evaluations.find((x) => x.id === pair.baselineEvaluationRecordId) : undefined; const ee = pair.enhancedEvaluationRecordId ? project?.evaluations.find((x) => x.id === pair.enhancedEvaluationRecordId) : undefined;
        const bScore = evalScore(be); const eScore = evalScore(ee);
        const baselineOutcomes = project?.generationOutcomes.filter((outcome) => outcome.mode === "baseline") ?? [];
        const enhancedOutcomes = project?.generationOutcomes.filter((outcome) => outcome.mode === "enhanced") ?? [];
        const ratings = (evaluation: FidelityEvaluation | undefined) => criterionColumns.map((id) => evaluation?.criteria.find((criterion) => criterion.criterionId === id)?.rating ?? "missing");
        const comments = (evaluation: FidelityEvaluation | undefined) => evaluation?.criteria.map((criterion) => `${criterion.criterionId}: ${criterion.reviewerNotes}; evidence: ${criterion.supportingEvidence.join(" | ")}; visibility: ${criterion.confidenceOrVisibilityNotes}`).join("\n") ?? "";
        return [experiment.experimentId, experiment.createdAt, experiment.protocolVersion, experiment.evaluationRubricVersion, registrationMap.get(pair.registrationId)?.anonymousPlanIdentifier, b?.id, b?.generationMode, b?.generationStatus, b?.createdAt, b?.modelIdentifier, b?.promptTemplateVersion, b ? JSON.stringify(b.configurationSnapshot) : "missing", b?.approvedAnalysisRevision, be?.id, be?.createdAt, bScore, be ? `${be.applicableCriteria}/6` : "missing", be?.status ?? "missing", b?.generationLatencyMs, baselineOutcomes.filter((outcome) => outcome.status === "complete").length, baselineOutcomes.filter((outcome) => outcome.status === "failed").length, ...ratings(be), comments(be), be?.discrepancies.join(" | "), e?.id, e?.generationMode, e?.generationStatus, e?.createdAt, e?.modelIdentifier, e?.promptTemplateVersion, e ? JSON.stringify(e.configurationSnapshot) : "missing", e?.approvedAnalysisRevision, ee?.id, ee?.createdAt, eScore, ee ? `${ee.applicableCriteria}/6` : "missing", ee?.status ?? "missing", e?.generationLatencyMs, enhancedOutcomes.filter((outcome) => outcome.status === "complete").length, enhancedOutcomes.filter((outcome) => outcome.status === "failed").length, ...ratings(ee), comments(ee), ee?.discrepancies.join(" | "), bScore !== null && eScore !== null ? eScore - bScore : "", bScore === null || eScore === null, [...pair.limitations, ...pair.uncontrolledDifferences].join("; "), pair.qualitativeReview?.modeAComments, pair.qualitativeReview?.modeBComments, pair.qualitativeReview?.architecturalRealism, pair.qualitativeReview?.practicalUsefulness, pair.qualitativeReview?.layoutConsistency, pair.qualitativeReview?.visualClarity, pair.qualitativeReview?.reviewerConfidence, pair.qualitativeReview?.advantagesAndDisadvantages];
    });
    return [header, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
};
