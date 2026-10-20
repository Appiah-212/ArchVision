import { validateFloorPlanAnalysis } from "./floor-plan-analysis";
import { isRenderConfiguration } from "./render-configuration";
import type { GenerationMode } from "./generation-types";

export const isGenerationInProgress = (
    metadata: { generationStatus?: string; generationTimestamp?: string } | null | undefined,
    now = Date.now(),
): boolean => Boolean(
    metadata?.generationStatus === "generating" &&
    typeof metadata.generationTimestamp === "string" &&
    Number.isFinite(Date.parse(metadata.generationTimestamp)) &&
    Date.parse(metadata.generationTimestamp) <= now &&
    now - Date.parse(metadata.generationTimestamp) < 30 * 60 * 1000,
);

export interface EnhancedGenerationReadiness {
    ready: boolean;
    missingPrerequisites: string[];
}

const hasApprovedAnalysis = (analysis: unknown): boolean => {
    try {
        validateFloorPlanAnalysis(analysis);
        return true;
    } catch {
        return false;
    }
};

export const normalizeGenerationMode = (
    value: unknown,
): GenerationMode => {
    if (value === undefined || value === null) return "baseline";
    if (value === "baseline" || value === "enhanced") return value;
    throw new Error("Generation mode is invalid.");
};

export const shouldAutomaticallyGenerate = (project: {
    generationMode?: unknown;
    renderedImage?: string | null;
    generationMetadata?: { generationStatus?: string; generationTimestamp?: string };
}): boolean => !project.renderedImage &&
    normalizeGenerationMode(project.generationMode) === "baseline" &&
    !isGenerationInProgress(project.generationMetadata);

export const getEnhancedGenerationReadiness = (
    analysis: unknown,
    configuration: unknown,
    isOwner: boolean,
    hasRenderedImage: boolean,
): EnhancedGenerationReadiness => {
    const missingPrerequisites: string[] = [];
    if (!isOwner) missingPrerequisites.push("Sign in as the project owner.");
    if (!hasApprovedAnalysis(analysis)) {
        missingPrerequisites.push("Analyze and approve the floor-plan findings.");
    }
    if (!isRenderConfiguration(configuration)) {
        missingPrerequisites.push("Save valid architectural design settings.");
    }
    if (hasRenderedImage) {
        missingPrerequisites.push("This project already has a render.");
    }
    return { ready: missingPrerequisites.length === 0, missingPrerequisites };
};
