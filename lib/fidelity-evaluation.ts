import { validateFloorPlanAnalysis, type FloorPlanAnalysis } from "./floor-plan-analysis";
import type { RenderVersion } from "./render-version";
import type { RenderConfiguration } from "./render-configuration";
import { validateRenderConfiguration } from "./render-configuration";

export const FIDELITY_RUBRIC_VERSION = "archvision-structural-fidelity-v1";
export const FIDELITY_CRITERIA = [
    { criterionId: "room_count", label: "Room count consistency" },
    { criterionId: "room_function", label: "Room function consistency" },
    { criterionId: "spatial_relationship", label: "Spatial relationship consistency" },
    { criterionId: "major_walls", label: "Major wall arrangement" },
    { criterionId: "doors_windows", label: "Door and window preservation" },
    { criterionId: "missing_invented", label: "Missing or invented features" },
] as const;
export type FidelityCriterionId = typeof FIDELITY_CRITERIA[number]["criterionId"];
export type FidelityRating = "PRESERVED" | "PARTIALLY_PRESERVED" | "NOT_PRESERVED" | "CANNOT_DETERMINE";
export type FidelityEvaluationStatus = "COMPLETE" | "INSUFFICIENT_EVIDENCE";

export interface FidelityCriterion {
    criterionId: FidelityCriterionId;
    label: string;
    rating: FidelityRating;
    reviewerNotes: string;
    supportingEvidence: string[];
    confidenceOrVisibilityNotes: string;
}

export interface FidelityEvaluation {
    id: string;
    projectId: string;
    renderVersionId: string;
    sourceImageReference: string;
    generationProvenance: {
        versionNumber: number;
        generationMode: "baseline" | "enhanced";
        modelIdentifier: string;
        promptTemplateVersion: string;
        configurationSnapshot: RenderConfiguration | null;
        renderCreatedAt: string;
    };
    approvedAnalysisRevision: number | null;
    approvedAnalysisSnapshot?: FloorPlanAnalysis;
    rubricVersion: string;
    evaluationMethod: "HUMAN_REVIEW";
    reviewerIdentifier: string;
    createdAt: string;
    updatedAt: string;
    criteria: FidelityCriterion[];
    overallScore: number | null;
    applicableCriteria: number;
    unassessableCriteria: number;
    observations: string[];
    discrepancies: string[];
    limitations: string[];
    status: FidelityEvaluationStatus;
    revisionOf?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number, optional = false): v is string =>
    typeof v === "string" && v.length <= max && (optional || !!v.trim());
const ids = new Set<string>(FIDELITY_CRITERIA.map(({ criterionId }) => criterionId));
export const ratingPoints = (rating: FidelityRating): number | null =>
    rating === "PRESERVED" ? 2 : rating === "PARTIALLY_PRESERVED" ? 1 : rating === "NOT_PRESERVED" ? 0 : null;

export const scoreFidelityCriteria = (criteria: FidelityCriterion[]) => {
    const applicable = criteria.filter(({ rating }) => rating !== "CANNOT_DETERMINE");
    const unassessableCriteria = criteria.length - applicable.length;
    if (!applicable.length) return { overallScore: null, applicableCriteria: 0, unassessableCriteria, status: "INSUFFICIENT_EVIDENCE" as const };
    const points = applicable.reduce((sum, { rating }) => sum + (ratingPoints(rating) ?? 0), 0);
    return { overallScore: Math.round((points / (applicable.length * 2)) * 10000) / 100, applicableCriteria: applicable.length, unassessableCriteria, status: "COMPLETE" as const };
};

export const createEmptyFidelityCriteria = (): FidelityCriterion[] => FIDELITY_CRITERIA.map((item) => ({ ...item, rating: "CANNOT_DETERMINE", reviewerNotes: "", supportingEvidence: [], confidenceOrVisibilityNotes: "" }));

export const validateFidelityEvaluation = (value: unknown): FidelityEvaluation => {
    if (!isRecord(value) || !text(value.id, 160) || !text(value.projectId, 200) || !text(value.renderVersionId, 160) ||
        !text(value.sourceImageReference, 4096) || !text(value.rubricVersion, 100) || value.evaluationMethod !== "HUMAN_REVIEW" ||
        !text(value.reviewerIdentifier, 200) || !text(value.createdAt, 80) || !Number.isFinite(Date.parse(value.createdAt)) ||
        !text(value.updatedAt, 80) || !Number.isFinite(Date.parse(value.updatedAt)) || !Array.isArray(value.criteria) || value.criteria.length !== 6 ||
        !Array.isArray(value.observations) || value.observations.length > 100 || !value.observations.every((item) => text(item, 1000, true)) ||
        !Array.isArray(value.discrepancies) || value.discrepancies.length > 100 || !value.discrepancies.every((item) => text(item, 1000, true)) ||
        !Array.isArray(value.limitations) || value.limitations.length > 100 || !value.limitations.every((item) => text(item, 1000, true))) {
        throw new Error("Fidelity evaluation is invalid.");
    }
    const allowedEvaluationKeys = new Set(["id", "projectId", "renderVersionId", "sourceImageReference", "generationProvenance", "approvedAnalysisRevision", "approvedAnalysisSnapshot", "rubricVersion", "evaluationMethod", "reviewerIdentifier", "createdAt", "updatedAt", "criteria", "overallScore", "applicableCriteria", "unassessableCriteria", "observations", "discrepancies", "limitations", "status", "revisionOf"]);
    if (Object.keys(value).some((key) => !allowedEvaluationKeys.has(key))) throw new Error("Fidelity evaluation contains unsupported fields.");
    const provenance = value.generationProvenance;
    if (isRecord(provenance) && Object.keys(provenance).some((key) => !["versionNumber", "generationMode", "modelIdentifier", "promptTemplateVersion", "configurationSnapshot", "renderCreatedAt"].includes(key))) throw new Error("Fidelity evaluation generation provenance contains unsupported fields.");
    if (!isRecord(provenance) || !Number.isSafeInteger(provenance.versionNumber) || Number(provenance.versionNumber) < 1 ||
        !["baseline", "enhanced"].includes(String(provenance.generationMode)) || !text(provenance.modelIdentifier, 120) ||
        !text(provenance.promptTemplateVersion, 120) || !text(provenance.renderCreatedAt, 80) ||
        !Number.isFinite(Date.parse(provenance.renderCreatedAt))) throw new Error("Fidelity evaluation generation provenance is invalid.");
    if (provenance.configurationSnapshot !== null) {
        // Reuse the canonical settings validator to reject untrusted JSON.
        validateRenderConfiguration(provenance.configurationSnapshot);
    }
    if (value.approvedAnalysisRevision !== null && (!Number.isSafeInteger(value.approvedAnalysisRevision) || Number(value.approvedAnalysisRevision) < 1)) throw new Error("Fidelity evaluation analysis revision is invalid.");
    const approvedAnalysisSnapshot = value.approvedAnalysisSnapshot === undefined ? undefined : validateFloorPlanAnalysis(value.approvedAnalysisSnapshot);
    if (value.revisionOf !== undefined && !text(value.revisionOf, 160)) throw new Error("Fidelity evaluation revision link is invalid.");
    const criteria = value.criteria.map((item): FidelityCriterion => {
        if (!isRecord(item) || !ids.has(String(item.criterionId)) || !text(item.label, 100) ||
            !["PRESERVED", "PARTIALLY_PRESERVED", "NOT_PRESERVED", "CANNOT_DETERMINE"].includes(String(item.rating)) ||
            !text(item.reviewerNotes, 2000, true) || !text(item.confidenceOrVisibilityNotes, 1000, true) ||
            !Array.isArray(item.supportingEvidence) || item.supportingEvidence.length > 20 || !item.supportingEvidence.every((e) => text(e, 1000, true))) throw new Error("Fidelity criterion is invalid.");
        if (Object.keys(item).some((key) => !["criterionId", "label", "rating", "reviewerNotes", "supportingEvidence", "confidenceOrVisibilityNotes"].includes(key))) throw new Error("Fidelity criterion contains unsupported fields.");
        const definition = FIDELITY_CRITERIA.find(({ criterionId }) => criterionId === item.criterionId);
        if (!definition || item.label !== definition.label) throw new Error("Fidelity rubric definition is invalid.");
        return { criterionId: item.criterionId as FidelityCriterionId, label: definition.label, rating: item.rating as FidelityRating, reviewerNotes: item.reviewerNotes as string, supportingEvidence: item.supportingEvidence as string[], confidenceOrVisibilityNotes: item.confidenceOrVisibilityNotes as string };
    });
    if (new Set(criteria.map(({ criterionId }) => criterionId)).size !== 6) throw new Error("Fidelity evaluation criteria are duplicated.");
    const score = scoreFidelityCriteria(criteria);
    if (value.overallScore !== score.overallScore || value.applicableCriteria !== score.applicableCriteria || value.unassessableCriteria !== score.unassessableCriteria || value.status !== score.status) throw new Error("Fidelity evaluation score does not match its ratings.");
    return { id: value.id as string, projectId: value.projectId as string, renderVersionId: value.renderVersionId as string, sourceImageReference: value.sourceImageReference as string, generationProvenance: provenance as FidelityEvaluation["generationProvenance"], approvedAnalysisRevision: value.approvedAnalysisRevision as number | null, ...(approvedAnalysisSnapshot ? { approvedAnalysisSnapshot } : {}), rubricVersion: value.rubricVersion as string, evaluationMethod: "HUMAN_REVIEW", reviewerIdentifier: value.reviewerIdentifier as string, createdAt: value.createdAt as string, updatedAt: value.updatedAt as string, criteria, ...score, observations: value.observations as string[], discrepancies: value.discrepancies as string[], limitations: value.limitations as string[], ...(value.revisionOf ? { revisionOf: value.revisionOf as string } : {}) };
};

export const createFidelityEvaluation = (input: Pick<FidelityEvaluation, "id" | "projectId" | "renderVersionId" | "sourceImageReference" | "generationProvenance" | "approvedAnalysisRevision" | "reviewerIdentifier" | "criteria" | "observations" | "discrepancies" | "limitations"> & Partial<Pick<FidelityEvaluation, "approvedAnalysisSnapshot">>, now = new Date().toISOString(), revisionOf?: string): FidelityEvaluation => {
    const score = scoreFidelityCriteria(input.criteria);
    return validateFidelityEvaluation({
        id: input.id, projectId: input.projectId, renderVersionId: input.renderVersionId,
        sourceImageReference: input.sourceImageReference, generationProvenance: input.generationProvenance,
        approvedAnalysisRevision: input.approvedAnalysisRevision,
        ...(input.approvedAnalysisSnapshot ? { approvedAnalysisSnapshot: input.approvedAnalysisSnapshot } : {}),
        reviewerIdentifier: input.reviewerIdentifier, criteria: input.criteria,
        observations: input.observations, discrepancies: input.discrepancies, limitations: input.limitations,
        ...score, rubricVersion: FIDELITY_RUBRIC_VERSION, evaluationMethod: "HUMAN_REVIEW",
        createdAt: now, updatedAt: now, ...(revisionOf ? { revisionOf } : {}),
    });
};

export const getAnalysisForVersion = (version: RenderVersion, _current?: FloorPlanAnalysis) => version.approvedAnalysisSnapshot;

export const fidelityEvaluationToCsv = (evaluation: FidelityEvaluation, _projectName = "", _renderVersion?: RenderVersion): string => {
    const quote = (v: unknown) => {
        const raw = String(v ?? "");
        const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
        return `"${safe.replaceAll('"', '""')}"`;
    };
    return [
        ["Render Version ID", evaluation.renderVersionId], ["Version number", evaluation.generationProvenance.versionNumber], ["Generation mode", evaluation.generationProvenance.generationMode], ["Model", evaluation.generationProvenance.modelIdentifier], ["Prompt template", evaluation.generationProvenance.promptTemplateVersion], ["Approved analysis revision", evaluation.approvedAnalysisRevision ?? "unknown"], ["Rubric Version", evaluation.rubricVersion], ["Evaluation Method", evaluation.evaluationMethod], ["Evaluation Date", evaluation.updatedAt], ["Overall Fidelity Score", evaluation.overallScore ?? "INSUFFICIENT_EVIDENCE"], ["Applicable Criteria", evaluation.applicableCriteria], ["Unassessable Criteria", evaluation.unassessableCriteria], ["Score coverage", `${evaluation.applicableCriteria}/6`],
        ...evaluation.criteria.flatMap((c) => [[`${c.label} rating`, c.rating], [`${c.label} notes`, c.reviewerNotes], [`${c.label} evidence`, c.supportingEvidence.join("; ")], [`${c.label} visibility`, c.confidenceOrVisibilityNotes]]),
        ["Observations", evaluation.observations.join("; ")], ["Discrepancies", evaluation.discrepancies.join("; ")], ["Limitations", evaluation.limitations.join("; ")], ["Pseudonymization note", "Direct project and reviewer identifiers, private asset references, design settings, and analysis snapshots are omitted. Pseudonymization does not guarantee anonymity."],
    ].map((row) => row.map(quote).join(",")).join("\r\n");
};
