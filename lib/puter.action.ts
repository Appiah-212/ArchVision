import puter from "@heyputer/puter.js";
import { deleteHostedAsset, getOrCreateHostingConfig, uploadFileToHosting, uploadImageToHosting } from "./puter.hosting";
import { fetchBlobFromUrl, getImageExtension } from "./utils";
import { PUTER_WORKER_URL } from "./constants";
import { validateFloorPlanAnalysis, type FloorPlanAnalysis } from "./floor-plan-analysis";

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
    return { ...project, sourceImage: sourceResult.value || "", renderedImage };
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
): Promise<{ limit: number; remaining: number }> => {
    if (!PUTER_WORKER_URL) throw new Error("AI generation is unavailable: Worker URL is not configured");

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/generation/authorize`,
        {
            method: "POST",
            body: JSON.stringify({ id }),
        },
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
        throw new Error("The Worker returned an invalid generation response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to authorize AI generation");
    }
    if (data.authorized !== true ||
        typeof data.limit !== "number" ||
        typeof data.remaining !== "number") {
        throw new Error("The Worker returned an invalid generation authorization");
    }
    return { limit: data.limit, remaining: data.remaining };
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
): Promise<FloorPlanAnalysis> => {
    if (!PUTER_WORKER_URL) throw new Error("Floor-plan analysis is unavailable: Worker URL is not configured");

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/floor-plan-analysis/save`,
        {
            method: "POST",
            body: JSON.stringify({ id, analysis }),
        },
    );
    let data: { analysis?: unknown; error?: string };
    try {
        data = (await response.json()) as typeof data;
    } catch {
        throw new Error("The Worker returned an invalid saved analysis response");
    }
    if (!response.ok) {
        throw new Error(data.error || "Unable to save floor-plan analysis");
    }
    return validateFloorPlanAnalysis(data.analysis);
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
            resolvedSource = await uploadPrivateAsset({
                id: projectId,
                label: "source",
                file: sourceFile,
                url: sourceImage,
            });
            resolvedRender = renderedFile || renderedImage
                ? await uploadPrivateAsset({
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
            ...rest
        } = item;
        const payload = {
            ...rest,
            sourceImage: resolvedSource,
            renderedImage: resolvedRender,
        };
        const privateProject = visibility === "public"
            ? {
                ...rest,
                sourceImage: await uploadPrivateAsset({
                    id: projectId,
                    label: "source",
                    file: sourceFile,
                    url: sourceImage,
                }),
                renderedImage: renderedFile || renderedImage
                    ? await uploadPrivateAsset({
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
            })
            : null;
        if (project.renderedImage && !rendered) {
            throw new Error("Failed to publish the rendered image");
        }
        if (rendered) assets.push(rendered);

        return await updateProjectSharing(id, "share", {
            sourceImage: source.url,
            renderedImage: rendered?.url,
            paths: assets.map(({ path }) => path),
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