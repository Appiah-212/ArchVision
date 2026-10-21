import puter from "@heyputer/puter.js";
import { deleteHostedAsset, getOrCreateHostingConfig, uploadFileToHosting, uploadImageToHosting } from "./puter.hosting";
import { fetchBlobFromUrl, getImageExtension } from "./utils";
import { PUTER_WORKER_URL } from "./constants";
import { validateFloorPlanAnalysis, type FloorPlanAnalysis } from "./floor-plan-analysis";
import {
    validateRenderConfiguration,
    type RenderConfiguration,
} from "./render-configuration";
import {
    getRenderVersions,
    validateRenderVersion,
    type RenderVersion,
} from "./render-version";
import type { AuthorizedGenerationContext, GenerationMode } from "./generation-types";
import { validateFidelityEvaluation, type FidelityEvaluation } from "./fidelity-evaluation";
import { repairResearchWorkspaceSnapshots, validateResearchWorkspace, type ResearchWorkspaceResponse } from "./research-evaluation";

const PRIVATE_ASSET_PREFIX = "archvision_private_asset:";

const uploadPrivateAsset = async ({
    id,
    label,
    file,
    url,
}: {
    id: string;
    label: "source" | "rendered";
    file?: File | Blob | null;
    url?: string | null;
}): Promise<string> => {
    const resolved = file
        ? { blob: file, contentType: file.type }
        : url
            ? await fetchBlobFromUrl(url)
            : null;
    if (!resolved?.blob) throw new Error(`Could not read the ${label} image`);

    const extension = getImageExtension(
        resolved.contentType || resolved.blob.type,
        url || "",
    );
    const contentType = resolved.contentType || resolved.blob.type || ({
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
    }[extension] || "image/png");
    const formData = new FormData();
    formData.set("id", id);
    formData.set("label", label);
    formData.set(
        "file",
        new File([resolved.blob], `${label}.${extension}`, { type: contentType }),
    );

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/private-asset`,
        { method: "POST", body: formData },
    );
    if (!response.ok) {
        throw new Error(`Failed to store private ${label} image: ${await response.text()}`);
    }

    const data = (await response.json()) as { asset?: string };
    if (!data.asset?.startsWith(PRIVATE_ASSET_PREFIX)) {
        throw new Error("The worker did not return a private image reference");
    }
    return data.asset;
};

const resolvePrivateAsset = async (
    image: string | null | undefined,
    id: string,
    label: "source" | "rendered",
): Promise<string | null | undefined> => {
    if (!image?.startsWith(PRIVATE_ASSET_PREFIX)) return image;

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/private-asset?id=${encodeURIComponent(id)}&label=${label}`,
        { method: "GET" },
    );
    if (!response.ok) {
        throw new Error(`Failed to retrieve private ${label} image: ${await response.text()}`);
    }
    return URL.createObjectURL(await response.blob());
};

const resolvePrivateProjectAssets = async (project: DesignItem): Promise<DesignItem> => {
    const versions = getRenderVersions(project);
    const [sourceResult, renderedResult] = await Promise.allSettled([
        resolvePrivateAsset(project.sourceImage, project.id, "source"),
        resolvePrivateAsset(project.renderedImage, project.id, "rendered"),
    ]);
    if (sourceResult.status === "rejected") throw sourceResult.reason;

    let renderedImage: string | null | undefined;
    if (renderedResult.status === "fulfilled") {
        renderedImage = renderedResult.value;
    } else {
        console.warn(
            `Private rendered image is unavailable for project ${project.id}; using its source image.`,
            renderedResult.reason,
        );
        renderedImage = null;
    }
    const resolvedVersionImages = await Promise.all(versions.map(async (version) => {
        if (version.isLegacy) {
            return [version.id, renderedImage || project.renderedImage || ""] as const;
        }
        if (!version.imageAssetReference?.startsWith(PRIVATE_ASSET_PREFIX)) {
            return [version.id, version.imageAssetReference || ""] as const;
        }
        try {
            const response = await puter.workers.exec(
                `${PUTER_WORKER_URL}/api/projects/render-versions/asset?id=${encodeURIComponent(project.id)}&versionId=${encodeURIComponent(version.id)}`,
                { method: "GET" },
            );
            if (!response.ok) {
                throw new Error(`Failed to retrieve private render version: ${await response.text()}`);
            }
            return [version.id, URL.createObjectURL(await response.blob())] as const;
        } catch (error) {
            console.warn(
                `Private render version ${version.id} is unavailable for project ${project.id}.`,
                error,
            );
            return [version.id, ""] as const;
        }
    }));
    const versionImages = Object.fromEntries(
        resolvedVersionImages.filter(([, image]) => Boolean(image)),
    );
    const activeRenderVersionId = versions.some(
        ({ id }) => id === project.activeRenderVersionId,
    )
        ? project.activeRenderVersionId
        : versions[versions.length - 1]?.id ?? null;
    return {
        ...project,
        sourceImage: sourceResult.value || "",
        // Keep the persisted reference separately from the resolved display URL.
        // Fidelity records must use the exact source reference stored on the Worker
        // project, even when an older project also has a stale sourcePath value.
        sourcePath: project.sourceImage,
        renderedImage,
        ...(project.renderedImage?.startsWith(PRIVATE_ASSET_PREFIX)
            ? { renderedPath: project.renderedImage }
            : project.renderedPath ? { renderedPath: project.renderedPath } : {}),
        renderVersions: versions,
        activeRenderVersionId,
        renderVersionImages: versionImages,
    };
};

export const signIn = async () => await puter.auth.signIn()

export const signOut = async () => puter.auth.signOut();

export const getCurrentUser = async () => {
    try {
        return await puter.auth.getUser();
    } catch {
        return null;
    }
}

export const authorizeProjectGeneration = async (
    id: string,
    generationMode?: GenerationMode,
): Promise<{ limit: number; remaining: number } & AuthorizedGenerationContext> => {
    if (!PUTER_WORKER_URL) throw new Error("AI generation is unavailable: Worker URL is not configured");

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/generation/authorize`,
        {
            method: "POST",
            body: JSON.stringify({ id, ...(generationMode ? { generationMode } : {}) }),
        },
    );
    let data: {
        authorized?: boolean;
        limit?: number;
        remaining?: number;
        generationMode?: GenerationMode;
        generationTimestamp?: string;
        approvedAnalysisRevision?: number | null;
        versionId?: string;
        versionNumber?: number;
        traceabilityAnalysisRevision?: number | null;
        traceabilityAnalysis?: unknown;
        traceabilityConfiguration?: unknown;
        analysis?: unknown;
        configuration?: unknown;
        error?: string;
    };
    try {
        data = (await response.json()) as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid generation response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to authorize AI generation");
    }
    if (data.authorized !== true ||
        typeof data.limit !== "number" ||
        typeof data.remaining !== "number" ||
        (data.generationMode !== "baseline" && data.generationMode !== "enhanced") ||
        typeof data.generationTimestamp !== "string" ||
        !Number.isFinite(Date.parse(data.generationTimestamp)) ||
        typeof data.versionId !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(data.versionId) ||
        !Number.isSafeInteger(data.versionNumber) ||
        (data.versionNumber ?? 0) < 1 ||
        (data.approvedAnalysisRevision !== null &&
            (!Number.isSafeInteger(data.approvedAnalysisRevision) ||
                (data.approvedAnalysisRevision ?? 0) < 1))) {
        throw new Error("The Worker returned an invalid generation authorization");
    }
    if (data.traceabilityAnalysisRevision !== null &&
        (!Number.isSafeInteger(data.traceabilityAnalysisRevision) ||
            (data.traceabilityAnalysisRevision ?? 0) < 1)) {
        throw new Error("The Worker returned an invalid analysis revision snapshot");
    }
    const traceabilityAnalysis = data.traceabilityAnalysis === undefined
        ? undefined
        : validateFloorPlanAnalysis(data.traceabilityAnalysis);
    const traceabilityConfiguration = data.traceabilityConfiguration === undefined
        ? undefined
        : validateRenderConfiguration(data.traceabilityConfiguration);
    if (data.generationMode === "enhanced" &&
        (data.approvedAnalysisRevision === null || data.analysis === undefined ||
            data.configuration === undefined)) {
        throw new Error("The Worker did not return the approved enhanced-generation inputs");
    }
    return {
        limit: data.limit,
        remaining: data.remaining,
        generationMode: data.generationMode,
        generationTimestamp: data.generationTimestamp,
        approvedAnalysisRevision: data.approvedAnalysisRevision ?? null,
        versionId: data.versionId,
        versionNumber: data.versionNumber!,
        traceabilityAnalysisRevision: data.traceabilityAnalysisRevision ?? null,
        ...(traceabilityAnalysis ? { traceabilityAnalysis } : {}),
        ...(traceabilityConfiguration ? { traceabilityConfiguration } : {}),
        ...(data.generationMode === "enhanced"
            ? {
                analysis: validateFloorPlanAnalysis(data.analysis),
                configuration: validateRenderConfiguration(data.configuration),
            }
            : {}),
    };
};

export const markProjectGenerationFailed = async (
    id: string,
    generationTimestamp: string,
): Promise<void> => {
    if (!PUTER_WORKER_URL) throw new Error("AI generation is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/generation/fail`,
        {
            method: "POST",
            body: JSON.stringify({ id, generationTimestamp }),
        },
    );
    if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Unable to record the generation failure");
    }
};

export const uploadRenderVersionAsset = async ({
    id,
    versionId,
    generationTimestamp,
    image,
}: {
    id: string;
    versionId: string;
    generationTimestamp: string;
    image: string;
}): Promise<string> => {
    if (!PUTER_WORKER_URL) throw new Error("Render version storage is unavailable: Worker URL is not configured");
    const resolved = await fetchBlobFromUrl(image);
    if (!resolved?.blob) throw new Error("The generated render image could not be read.");
    const extension = getImageExtension(
        resolved.contentType || resolved.blob.type,
        image,
    );
    const expectedAsset = `${PRIVATE_ASSET_PREFIX}${versionId}.${extension}`;
    const formData = new FormData();
    formData.set("id", id);
    formData.set("versionId", versionId);
    formData.set("generationTimestamp", generationTimestamp);
    formData.set(
        "file",
        new File([resolved.blob], `render.${extension}`, {
            type: resolved.contentType || resolved.blob.type || "image/png",
        }),
    );
    try {
        const response = await puter.workers.exec(
            `${PUTER_WORKER_URL}/api/projects/render-versions/asset`,
            { method: "POST", body: formData },
        );
        let data: { asset?: string; error?: string };
        try {
            data = await response.json() as typeof data;
        } catch {
            throw new Error("The Worker returned an invalid render asset response");
        }
        if (!response.ok) throw new Error(data.error || "Failed to store render version image");
        if (data.asset !== expectedAsset) {
            throw new Error("The Worker returned an unexpected render image reference");
        }
        return data.asset;
    } catch (error) {
        try {
            await deleteUncommittedRenderVersionAsset({
                id,
                versionId,
                generationTimestamp,
                imageAssetReference: expectedAsset,
            });
        } catch (cleanupError) {
            console.error("Failed to clean up an uncommitted render asset:", cleanupError);
        }
        throw error;
    }
};

export const deleteUncommittedRenderVersionAsset = async ({
    id,
    versionId,
    generationTimestamp,
    imageAssetReference,
}: {
    id: string;
    versionId: string;
    generationTimestamp: string;
    imageAssetReference: string;
}): Promise<void> => {
    if (!PUTER_WORKER_URL) throw new Error("Render version storage is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/render-versions/asset/delete`,
        {
            method: "POST",
            body: JSON.stringify({
                id,
                versionId,
                generationTimestamp,
                imageAssetReference,
            }),
        },
    );
    if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Failed to remove uncommitted render image");
    }
};

export const commitRenderVersion = async ({
    id,
    versionId,
    generationTimestamp,
    imageAssetReference,
    generationLatencyMs,
}: {
    id: string;
    versionId: string;
    generationTimestamp: string;
    imageAssetReference: string;
    generationLatencyMs: number;
}): Promise<{ project: DesignItem; version: RenderVersion }> => {
    if (!PUTER_WORKER_URL) throw new Error("Render version storage is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/render-versions/commit`,
        {
            method: "POST",
            body: JSON.stringify({
                id,
                versionId,
                generationTimestamp,
                imageAssetReference,
                generationLatencyMs,
            }),
        },
    );
    let data: { project?: DesignItem; version?: unknown; error?: string };
    try {
        data = await response.json() as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid render version response");
    }
    if (!response.ok) throw new Error(data.error || "Failed to save render version metadata");
    if (!data.project || !data.version) {
        throw new Error("The Worker did not return the saved render version");
    }
    const version = validateRenderVersion(data.version);
    if (version.projectId !== id || version.id !== versionId) {
        throw new Error("The Worker returned a render version for a different project");
    }
    return {
        project: await resolvePrivateProjectAssets(data.project),
        version,
    };
};

export const setActiveRenderVersion = async (
    id: string,
    versionId: string,
): Promise<DesignItem> => {
    if (!PUTER_WORKER_URL) throw new Error("Render version storage is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/render-versions/active`,
        { method: "POST", body: JSON.stringify({ id, versionId }) },
    );
    let data: { project?: DesignItem; error?: string };
    try {
        data = await response.json() as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid active render response");
    }
    if (!response.ok) throw new Error(data.error || "Failed to select active render version");
    if (!data.project) throw new Error("The Worker did not return the updated project");
    return resolvePrivateProjectAssets(data.project);
};

export const updateRenderVersionDetails = async (
    id: string,
    versionId: string,
    details: { name: string; notes: string },
): Promise<DesignItem> => {
    if (!PUTER_WORKER_URL) throw new Error("Render version storage is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/render-versions/update`,
        { method: "POST", body: JSON.stringify({ id, versionId, ...details }) },
    );
    let data: { project?: DesignItem; error?: string };
    try {
        data = await response.json() as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid render details response");
    }
    if (!response.ok) throw new Error(data.error || "Failed to update render version details");
    if (!data.project) throw new Error("The Worker did not return the updated project");
    return resolvePrivateProjectAssets(data.project);
};

export const authorizeFloorPlanAnalysis = async (
    id: string,
): Promise<{ limit: number; remaining: number }> => {
    if (!PUTER_WORKER_URL) throw new Error("Floor-plan analysis is unavailable: Worker URL is not configured");

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/floor-plan-analysis/authorize`,
        { method: "POST", body: JSON.stringify({ id }) },
    );
    let data: {
        authorized?: boolean;
        limit?: number;
        remaining?: number;
        error?: string;
    };
    try {
        data = (await response.json()) as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid analysis authorization response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to authorize floor-plan analysis");
    }
    if (data.authorized !== true ||
        typeof data.limit !== "number" ||
        typeof data.remaining !== "number") {
        throw new Error("The Worker returned an invalid analysis authorization");
    }
    return { limit: data.limit, remaining: data.remaining };
};

export const saveFloorPlanAnalysis = async (
    id: string,
    analysis: FloorPlanAnalysis,
): Promise<{ analysis: FloorPlanAnalysis; approvedAnalysisRevision: number }> => {
    if (!PUTER_WORKER_URL) throw new Error("Floor-plan analysis is unavailable: Worker URL is not configured");

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/floor-plan-analysis/save`,
        {
            method: "POST",
            body: JSON.stringify({ id, analysis }),
        },
    );
    let data: { analysis?: unknown; approvedAnalysisRevision?: number; error?: string };
    try {
        data = (await response.json()) as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid saved analysis response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to save floor-plan analysis");
    }
    if (!Number.isSafeInteger(data.approvedAnalysisRevision) ||
        (data.approvedAnalysisRevision ?? 0) < 1) {
        throw new Error("The Worker returned an invalid approved analysis revision");
    }
    return {
        analysis: validateFloorPlanAnalysis(data.analysis),
        approvedAnalysisRevision: data.approvedAnalysisRevision!,
    };
};

export const saveRenderConfiguration = async (
    id: string,
    configuration: RenderConfiguration,
): Promise<RenderConfiguration> => {
    if (!PUTER_WORKER_URL) throw new Error("Design settings are unavailable: Worker URL is not configured");
    const validConfiguration = validateRenderConfiguration(configuration);
    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/render-configuration/save`,
        {
            method: "POST",
            body: JSON.stringify({ id, configuration: validConfiguration }),
        },
    );
    let data: { configuration?: unknown; error?: string };
    try {
        data = (await response.json()) as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid design settings response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to save design settings");
    }
    return validateRenderConfiguration(data.configuration);
};

export const getFidelityEvaluations = async (id: string): Promise<FidelityEvaluation[]> => {
    if (!PUTER_WORKER_URL) throw new Error("Fidelity assessments are unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/fidelity-evaluations?id=${encodeURIComponent(id)}`, { method: "GET" });
    const data = await response.json() as { evaluations?: unknown; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to retrieve fidelity assessments");
    if (!Array.isArray(data.evaluations)) throw new Error("The Worker returned invalid fidelity assessments");
    return data.evaluations.map(validateFidelityEvaluation);
};

export const saveFidelityEvaluation = async (id: string, evaluation: FidelityEvaluation): Promise<FidelityEvaluation> => {
    if (!PUTER_WORKER_URL) throw new Error("Fidelity assessments are unavailable: Worker URL is not configured");
    const validEvaluation = validateFidelityEvaluation(evaluation);
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/fidelity-evaluations/save`, { method: "POST", body: JSON.stringify({ id, evaluation: validEvaluation }) });
    const data = await response.json() as { evaluation?: unknown; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to save fidelity assessment");
    return validateFidelityEvaluation(data.evaluation);
};

export const getResearchWorkspace = async (): Promise<ResearchWorkspaceResponse> => {
    if (!PUTER_WORKER_URL) throw new Error("Research evaluation is unavailable: Worker URL is not configured");
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/research/workspace`, { method: "GET" });
    const data = await response.json() as { workspace?: unknown; projects?: unknown; retrievalLatencyMs?: unknown; error?: string; message?: string };
    if (!response.ok) throw new Error(`${data.error || "Unable to load research workspace"} (HTTP ${response.status})${data.message ? `: ${data.message}` : ""}`);
    if (!Array.isArray(data.projects) || typeof data.retrievalLatencyMs !== "number" || !Number.isFinite(data.retrievalLatencyMs)) throw new Error("The Worker returned an invalid research workspace");
    const projects = data.projects.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Worker returned an invalid research project summary");
        const summary = value as Record<string, unknown>;
        if (typeof summary.id !== "string" || !summary.id.trim() || typeof summary.name !== "string" || !Array.isArray(summary.versions) || !Array.isArray(summary.evaluations) || !Array.isArray(summary.generationOutcomes)) throw new Error("The Worker returned an invalid research project summary");
        const versions = summary.versions.map((version) => validateRenderVersion(version));
        if (versions.some((version) => version.projectId !== summary.id)) throw new Error("Research render version references a different project");
        const evaluations = summary.evaluations.map((evaluation) => validateFidelityEvaluation(evaluation));
        if (evaluations.some((evaluation) => evaluation.projectId !== summary.id)) throw new Error("Research fidelity record references a different project");
        const generationOutcomes = summary.generationOutcomes.map((outcome) => {
            if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) throw new Error("Research generation outcome is invalid");
            const item = outcome as Record<string, unknown>;
            if ((item.mode !== "baseline" && item.mode !== "enhanced") || (item.status !== "complete" && item.status !== "failed") || typeof item.occurredAt !== "string" || !Number.isFinite(Date.parse(item.occurredAt)) || (item.latencyMs !== undefined && (!Number.isSafeInteger(item.latencyMs) || Number(item.latencyMs) < 0))) throw new Error("Research generation outcome is invalid");
            return { mode: item.mode as "baseline" | "enhanced", status: item.status as "complete" | "failed", occurredAt: item.occurredAt as string, ...(item.latencyMs !== undefined ? { latencyMs: item.latencyMs as number } : {}) };
        });
        const warnings = Array.isArray(summary.warnings) && summary.warnings.every((item) => typeof item === "string") ? summary.warnings as string[] : [];
        return { id: summary.id, name: summary.name, versions, evaluations, generationOutcomes, warnings };
    });
    const repaired = repairResearchWorkspaceSnapshots(data.workspace, projects);
    const workspace = validateResearchWorkspace(repaired.workspace);
    if (repaired.changed) {
        try {
            await saveResearchWorkspace(workspace);
        } catch (error) {
            console.warn("Could not persist repaired research render snapshots:", error);
        }
    }
    return { workspace, projects, retrievalLatencyMs: data.retrievalLatencyMs };
};

export const saveResearchWorkspace = async (workspace: ResearchWorkspaceResponse["workspace"]) => {
    if (!PUTER_WORKER_URL) throw new Error("Research evaluation is unavailable: Worker URL is not configured");
    const validWorkspace = validateResearchWorkspace(workspace);
    const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/research/workspace/save`, { method: "POST", body: JSON.stringify({ workspace: validWorkspace }) });
    const data = await response.json() as { workspace?: unknown; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to save research workspace");
    return validateResearchWorkspace(data.workspace);
};

export const createProject = async ({ item, visibility="private" }: CreateProjectParams):
 Promise<DesignItem | null | undefined> => {
    if (!PUTER_WORKER_URL){
        console.warn('Missing VITE_PUTER_WORKER_URL; skip history fetch');
        return null;
    }
    try {
        const projectId = item.id;
        const sourceImage = item.sourceImage ?? "";
        const renderedImage = item.renderedImage ?? "";
        const sourceFile = item.sourceFile ?? null;
        const renderedFile = item.renderedFile ?? null;
        const existingSourceRef = item.sourcePath?.startsWith(PRIVATE_ASSET_PREFIX)
            ? item.sourcePath
            : null;
        const existingRenderRef = item.renderedPath?.startsWith(PRIVATE_ASSET_PREFIX)
            ? item.renderedPath
            : null;
        const publicAssets: HostedAsset[] = [];
        let resolvedSource: string;
        let resolvedRender: string | null | undefined;

        if (visibility === "public") {
            const hosting = await getOrCreateHostingConfig();
            const sourceAsset = sourceFile
                ? await uploadFileToHosting({ hosting, file: sourceFile, projectId, label: "source" })
                : sourceImage
                    ? await uploadImageToHosting({ hosting, url: sourceImage, projectId, label: "source" })
                    : null;
            if (!sourceAsset) throw new Error("Failed to publish the source image");
            publicAssets.push(sourceAsset);
            resolvedSource = sourceAsset.url;

            const renderedAsset = renderedFile
                ? await uploadFileToHosting({ hosting, file: renderedFile, projectId, label: "rendered" })
                : renderedImage
                    ? await uploadImageToHosting({ hosting, url: renderedImage, projectId, label: "rendered" })
                    : null;
            if (renderedAsset) publicAssets.push(renderedAsset);
            resolvedRender = renderedAsset?.url;
        } else {
            resolvedSource = existingSourceRef ?? await uploadPrivateAsset({
                id: projectId,
                label: "source",
                file: sourceFile,
                url: sourceImage,
            });
            resolvedRender = renderedFile || renderedImage
                ? existingRenderRef ?? await uploadPrivateAsset({
                    id: projectId,
                    label: "rendered",
                    file: renderedFile,
                    url: renderedImage,
                })
                : undefined;
        }

        const {
            sourcePath: _sourcePath,
            renderedPath: _renderedPath,
            publicPath: _publicPath,
            sourceFile: _sourceFile,
            renderedFile: _renderedFile,
            renderVersionImages: _renderVersionImages,
            ...rest
        } = item;
        const {
            renderVersions: _renderVersions,
            activeRenderVersionId: _activeRenderVersionId,
            ...persistedFields
        } = rest;
        const payload = {
            ...persistedFields,
            sourceImage: resolvedSource,
            renderedImage: resolvedRender,
        };
        const privateProject = visibility === "public"
            ? {
                ...persistedFields,
                sourceImage: existingSourceRef ?? await uploadPrivateAsset({
                    id: projectId,
                    label: "source",
                    file: sourceFile,
                    url: sourceImage,
                }),
                renderedImage: renderedFile || renderedImage
                    ? existingRenderRef ?? await uploadPrivateAsset({
                        id: projectId,
                        label: "rendered",
                        file: renderedFile,
                        url: renderedImage,
                    })
                    : undefined,
            }
            : undefined;

        const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/save`, {
            method: 'POST',
            body: JSON.stringify({
                project: payload,
                privateProject,
                visibility,
                publicAssetPaths: publicAssets.map(({ path }) => path),
            })
        });

        if (!response.ok) {
            console.error('Failed to save the project', await response.text());
            return null;
        }

        const data = (await response.json()) as { project?: DesignItem | null };
        return data?.project ? await resolvePrivateProjectAssets(data.project) : null;
    } catch (e) {
        console.error('Failed to save project', e);
        return null;
    }
};

 export const getProjects = async () => {
    if(!PUTER_WORKER_URL) {
        console.warn('Missing VITE_PUTER_WORKER_URL; skip history fetch;');
        return []
    }

    try {
        const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/list`, { method: 'GET' });

        if(!response.ok) {
            console.error('Failed to fetch history', await response.text());
            return[]
        }

        const data = (await response.json()) as { projects?: DesignItem[] | null };
        return Array.isArray(data?.projects)
            ? await Promise.all(data.projects.map(async (project) => {
                try {
                    return await resolvePrivateProjectAssets(project);
                } catch (error) {
                    console.error(`Failed to load private images for project ${project.id}:`, error);
                    return { ...project, sourceImage: "", renderedImage: null };
                }
            }))
            : [];

    } catch (e) {
        console.error('Failed to get projects', e);
        return [];
    }
 }
export const getProjectById = async ({ id }: { id: string }) => {
    if (!PUTER_WORKER_URL) {
        console.warn("Missing VITE_PUTER_WORKER_URL; skipping project fetch.");
        return null;
    }

    try {
        const url = `${PUTER_WORKER_URL}/api/projects/get?id=${encodeURIComponent(id)}`;
        const user = await getCurrentUser();
        const response = user
            ? await puter.workers.exec(url, { method: "GET" })
            : await fetch(url);

        if (!response.ok) {
            if (response.status !== 404 || user) {
                console.error("Failed to fetch project:", await response.text());
            }
            return null;
        }

        const data = (await response.json()) as {
            project?: DesignItem | null;
        };

        return data?.project
            ? user
                ? await resolvePrivateProjectAssets(data.project)
                : data.project
            : null;
    } catch (error) {
        console.error("Failed to fetch project:", error);
        return null;
    }
};

const updateProjectSharing = async (
    id: string,
    action: "share" | "unshare",
    publicAssets?: {
        sourceImage: string;
        renderedImage?: string;
        paths: string[];
        renderVersionId?: string;
    },
): Promise<DesignItem> => {
    if (!PUTER_WORKER_URL) {
        throw new Error("Missing VITE_PUTER_WORKER_URL");
    }

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/${action}`,
        {
            method: "POST",
            body: JSON.stringify({
                id,
                publicAssets,
                publicAssetPaths: publicAssets?.paths,
                renderVersionId: publicAssets?.renderVersionId,
            }),
        },
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to ${action} project: ${errorBody}`);
    }

    const data = (await response.json()) as { project?: DesignItem };
    if (!data.project) {
        throw new Error(`The worker did not return the ${action}d project`);
    }

    return data.project;
};

export const shareProject = async (id: string): Promise<DesignItem> => {
    const project = await getProjectById({ id });
    if (!project?.sourceImage) throw new Error("Private project could not be loaded");

    const hosting = await getOrCreateHostingConfig();
    const assets: HostedAsset[] = [];
    const versions = getRenderVersions(project);
    const activeVersion = versions.find(
        ({ id: versionId }) => versionId === project.activeRenderVersionId,
    ) ?? versions[versions.length - 1];

    try {
        const source = await uploadImageToHosting({
            hosting,
            url: project.sourceImage,
            projectId: id,
            label: "source",
        });
        if (!source) throw new Error("Failed to publish the source image");
        assets.push(source);

        const rendered = project.renderedImage
            ? await uploadImageToHosting({
                hosting,
                url: project.renderedImage,
                projectId: id,
                label: "rendered",
                ...(activeVersion ? { assetSuffix: activeVersion.id } : {}),
            })
            : null;
        if (project.renderedImage && !rendered) {
            throw new Error("Failed to publish the rendered image");
        }
        if (project.renderedImage && !activeVersion) {
            throw new Error("The active render version could not be verified");
        }
        if (rendered) assets.push(rendered);

        return await updateProjectSharing(id, "share", {
            sourceImage: source.url,
            renderedImage: rendered?.url,
            paths: assets.map(({ path }) => path),
            ...(activeVersion ? { renderVersionId: activeVersion.id } : {}),
        });
    } catch (error) {
        for (const asset of assets) {
            try {
                await deleteHostedAsset(asset);
            } catch (cleanupError) {
                console.error("Failed to remove an unpublished shared image:", cleanupError);
            }
        }
        throw error;
    }
};

export const unshareProject = (id: string) => updateProjectSharing(id, "unshare");
