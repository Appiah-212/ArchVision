import type { FloorPlanAnalysis } from "./floor-plan-analysis";
import type { RenderConfiguration } from "./render-configuration";

export type GenerationMode = "baseline" | "enhanced";
export type GenerationStatus = "generating" | "complete" | "failed";

export interface GenerationMetadata {
    generationMode: GenerationMode;
    modelIdentifier: string;
    promptTemplateVersion: string;
    configurationSnapshot: RenderConfiguration | null;
    approvedAnalysisRevision: number | null;
    generationTimestamp: string;
    generationStatus: GenerationStatus;
    generationLatencyMs?: number;
    versionId?: string;
    versionNumber?: number;
}

export interface AuthorizedGenerationContext {
    generationMode: GenerationMode;
    generationTimestamp: string;
    approvedAnalysisRevision: number | null;
    versionId: string;
    versionNumber: number;
    traceabilityAnalysisRevision: number | null;
    traceabilityAnalysis?: FloorPlanAnalysis;
    traceabilityConfiguration?: RenderConfiguration;
    analysis?: FloorPlanAnalysis;
    configuration?: RenderConfiguration;
}
