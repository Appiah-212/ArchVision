import {
    validateFloorPlanAnalysis,
    type FloorPlanAnalysis,
} from "./floor-plan-analysis";
import {
    validateRenderConfiguration,
    type RenderConfiguration,
} from "./render-configuration";
import type { GenerationMode, GenerationStatus } from "./generation-types";

export interface RenderVersion {
    id: string;
    projectId: string;
    versionNumber: number;
    imageAssetReference: string | null;
    generationMode: GenerationMode;
    modelIdentifier: string;
    promptTemplateVersion: string;
    configurationSnapshot: RenderConfiguration | null;
    approvedAnalysisRevision: number | null;
    approvedAnalysisSnapshot?: FloorPlanAnalysis;
    createdAt: string;
    generationLatencyMs?: number;
    generationStatus: GenerationStatus;
    name?: string;
    notes?: string;
    isLegacy?: boolean;
}

const PRIVATE_ASSET_PREFIX = "archvision_private_asset:";
const PRIVATE_ASSET_PATTERN =
    /^archvision_private_asset:[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/i;

export const isRenderVersionId = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length <= 160 &&
    /^[A-Za-z0-9_-]+$/.test(value);

const isValidImageReference = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4096 &&
    !/[\u0000-\u0020]/.test(value) &&
    (PRIVATE_ASSET_PATTERN.test(value) ||
        /^(https:\/\/|blob:|data:image\/)/i.test(value));

export const isRenderVersion = (value: unknown): value is RenderVersion => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const version = value as Partial<RenderVersion>;
    const requiredKeys = [
        "id",
        "projectId",
        "versionNumber",
        "imageAssetReference",
        "generationMode",
        "modelIdentifier",
        "promptTemplateVersion",
        "configurationSnapshot",
        "approvedAnalysisRevision",
        "createdAt",
        "generationStatus",
    ];
    const allowedKeys = new Set([
        ...requiredKeys,
        "approvedAnalysisSnapshot",
        "generationLatencyMs",
        "name",
        "notes",
        "isLegacy",
    ]);

    if (
        requiredKeys.some((key) => !(key in value)) ||
        Object.keys(value).some((key) => !allowedKeys.has(key)) ||
        !isRenderVersionId(version.id) ||
        typeof version.projectId !== "string" ||
        !version.projectId.trim() ||
        version.projectId.length > 200 ||
        !Number.isSafeInteger(version.versionNumber) ||
        (version.versionNumber ?? 0) < 1 ||
        (version.imageAssetReference !== null &&
            !isValidImageReference(version.imageAssetReference)) ||
        (version.generationMode !== "baseline" && version.generationMode !== "enhanced") ||
        typeof version.modelIdentifier !== "string" ||
        !version.modelIdentifier.trim() ||
        version.modelIdentifier.length > 120 ||
        typeof version.promptTemplateVersion !== "string" ||
        !version.promptTemplateVersion.trim() ||
        version.promptTemplateVersion.length > 120 ||
        typeof version.createdAt !== "string" ||
        !Number.isFinite(Date.parse(version.createdAt)) ||
        !["generating", "complete", "failed"].includes(version.generationStatus ?? "") ||
        (version.approvedAnalysisRevision !== null &&
            (!Number.isSafeInteger(version.approvedAnalysisRevision) ||
                (version.approvedAnalysisRevision ?? 0) < 1)) ||
        (version.generationLatencyMs !== undefined &&
            (!Number.isSafeInteger(version.generationLatencyMs) ||
                version.generationLatencyMs < 0 ||
                version.generationLatencyMs > 1_800_000)) ||
        (version.name !== undefined &&
            (typeof version.name !== "string" || version.name.length > 80)) ||
        (version.notes !== undefined &&
            (typeof version.notes !== "string" || version.notes.length > 2_000)) ||
        (version.isLegacy !== undefined && typeof version.isLegacy !== "boolean")
    ) {
        return false;
    }

    try {
        if (version.configurationSnapshot !== null) {
            validateRenderConfiguration(version.configurationSnapshot);
        }
        if (version.approvedAnalysisSnapshot !== undefined) {
            validateFloorPlanAnalysis(version.approvedAnalysisSnapshot);
        }
        return true;
    } catch {
        return false;
    }
};

export const validateRenderVersion = (value: unknown): RenderVersion => {
    if (!isRenderVersion(value)) throw new Error("Render version metadata is invalid.");
    return value;
};

export interface LegacyRenderProject {
    id: string;
    renderedImage?: string | null;
    renderedPath?: string | null;
    timestamp?: number;
    generationMetadata?: {
        generationMode?: GenerationMode;
        modelIdentifier?: string;
        promptTemplateVersion?: string;
        configurationSnapshot?: RenderConfiguration | null;
        approvedAnalysisRevision?: number | null;
        generationTimestamp?: string;
        generationLatencyMs?: number;
        generationStatus?: GenerationStatus;
    };
    floorPlanAnalysis?: FloorPlanAnalysis;
    approvedAnalysisRevision?: number;
    renderConfiguration?: RenderConfiguration;
}

const stableLegacyId = (projectId: string) => {
    let hash = 2166136261;
    for (let index = 0; index < projectId.length; index += 1) {
        hash = Math.imul(hash ^ projectId.charCodeAt(index), 16777619);
    }
    return `legacy_${(hash >>> 0).toString(16)}`;
};

export const createLegacyRenderVersion = (
    project: LegacyRenderProject,
): RenderVersion | null => {
    const imageAssetReference = project.renderedPath || project.renderedImage || null;
    if (!imageAssetReference) return null;
    const metadata = project.generationMetadata;
    const candidateRevision = metadata?.approvedAnalysisRevision ??
        project.approvedAnalysisRevision ??
        null;
    const revision = Number.isSafeInteger(candidateRevision) && (candidateRevision ?? 0) > 0
        ? candidateRevision
        : null;
    const snapshot = revision && project.floorPlanAnalysis
        ? project.floorPlanAnalysis
        : undefined;
    let configuration: RenderConfiguration | null = null;
    try {
        const candidateConfiguration = metadata?.configurationSnapshot ??
            project.renderConfiguration ??
            null;
        if (candidateConfiguration) {
            configuration = validateRenderConfiguration(candidateConfiguration);
        }
    } catch {
        configuration = null;
    }
    const metadataTimestamp = metadata?.generationTimestamp;
    const timestamp = (metadataTimestamp && Number.isFinite(Date.parse(metadataTimestamp))
        ? metadataTimestamp
        : undefined) ??
        (typeof project.timestamp === "number" && Number.isFinite(project.timestamp)
            ? new Date(project.timestamp).toISOString()
            : new Date(0).toISOString());
    const generationMode = metadata?.generationMode === "enhanced"
        ? "enhanced"
        : "baseline";
    const promptTemplateVersion =
        metadata?.promptTemplateVersion === "archvision-baseline-v1" ||
        metadata?.promptTemplateVersion === "archvision-enhanced-v1"
            ? metadata.promptTemplateVersion
            : "legacy/unknown";
    const generationLatencyMs = Number.isSafeInteger(metadata?.generationLatencyMs) &&
        (metadata?.generationLatencyMs ?? -1) >= 0 &&
        (metadata?.generationLatencyMs ?? 1_800_001) <= 1_800_000
        ? metadata?.generationLatencyMs
        : undefined;

    return validateRenderVersion({
        id: stableLegacyId(project.id),
        projectId: project.id,
        versionNumber: 1,
        imageAssetReference,
        generationMode,
        modelIdentifier: typeof metadata?.modelIdentifier === "string" &&
            metadata.modelIdentifier.trim().length > 0 &&
            metadata.modelIdentifier.length <= 120
            ? metadata.modelIdentifier
            : "legacy/unknown",
        promptTemplateVersion,
        configurationSnapshot: configuration,
        approvedAnalysisRevision: revision,
        ...(snapshot ? { approvedAnalysisSnapshot: snapshot } : {}),
        createdAt: timestamp,
        ...(generationLatencyMs !== undefined
            ? { generationLatencyMs }
            : {}),
        generationStatus: metadata?.generationStatus === "failed"
            ? "failed"
            : "complete",
        name: "Original render",
        isLegacy: true,
    });
};

export const getRenderVersions = (
    project: LegacyRenderProject & { renderVersions?: unknown },
): RenderVersion[] => {
    if (project.renderVersions !== undefined) {
        if (!Array.isArray(project.renderVersions)) {
            throw new Error("The project contains invalid render version metadata.");
        }
        if (project.renderVersions.length > 0 &&
            (!project.renderVersions.every(isRenderVersion) ||
            new Set(project.renderVersions.map(({ id }) => id)).size !== project.renderVersions.length ||
            new Set(project.renderVersions.map(({ versionNumber }) => versionNumber)).size !== project.renderVersions.length ||
            project.renderVersions.some((version) => version.projectId !== project.id))) {
            throw new Error("The project contains invalid render version metadata.");
        }
        if (project.renderVersions.length > 0) {
            return [...project.renderVersions].sort((left, right) =>
                left.versionNumber - right.versionNumber);
        }
    }

    const legacyVersion = createLegacyRenderVersion(project);
    return legacyVersion ? [legacyVersion] : [];
};
