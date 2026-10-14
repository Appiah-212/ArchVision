import puter from "@heyputer/puter.js";
import { getOrCreateHostingConfig, uploadFileToHosting, uploadImageToHosting } from "./puter.hosting";
import { isHostedUrl } from "./utils";
import { PUTER_WORKER_URL } from "./constants";

const isBlobOrDataUrl = (value: string | null | undefined): value is string =>
    typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"));

export const signIn = async () => await puter.auth.signIn()

export const signOut = async () => puter.auth.signOut();

export const getCurrentUser = async () => {
    try {
        return await puter.auth.getUser();
    } catch {
        return null;
    }
}

export const createProject = async ({ item, visibility="private" }: CreateProjectParams):
 Promise<DesignItem | null | undefined> => {
    if (!PUTER_WORKER_URL){
        console.warn('Missing VITE_PUTER_WORKER_URL; skip history fetch');
        return null;
    }
    const projectId = item.id;
    const sourceImage = item.sourceImage ?? "";
    const renderedImage = item.renderedImage ?? "";
    const sourceFile = item.sourceFile ?? null;
    const renderedFile = item.renderedFile ?? null;

    const hosting = await getOrCreateHostingConfig();

    const hostedSource = projectId && sourceFile
        ? await uploadFileToHosting({ hosting, file: sourceFile, projectId, label: 'source' })
        : projectId && sourceImage && !isBlobOrDataUrl(sourceImage)
            ? await uploadImageToHosting({ hosting, url: sourceImage, projectId, label: 'source' })
            : null;

    const hostedRender = projectId && renderedFile
        ? await uploadFileToHosting({ hosting, file: renderedFile, projectId, label: 'rendered' })
        : projectId && renderedImage && !isBlobOrDataUrl(renderedImage)
            ? await uploadImageToHosting({ hosting, url: renderedImage, projectId, label: 'rendered' })
            : null;

    const resolvedSource = hostedSource?.url || (isHostedUrl(sourceImage)
        ? sourceImage
        : isBlobOrDataUrl(sourceImage)
            ? sourceImage
            : ''
    );

    if(!resolvedSource) {
        console.warn('Failed to host source image, skipping save.')
        return null;
    }

    const resolvedRender = hostedRender?.url
        ? hostedRender?.url
        : isHostedUrl(renderedImage) || isBlobOrDataUrl(renderedImage)
            ? renderedImage
            : undefined;
    
    const {
        sourcePath: _sourcePath,
        renderedPath: _renderedPath,
        publicPath: _publicPath,
        sourceFile: _sourceFile,
        renderedFile: _renderedFile,
        ... rest

    } = item;

    const payload = {
        ...rest,
        sourceImage: resolvedSource,
        renderedImage: resolvedRender,
    }

    try {
        const response = await puter.workers.exec(`${PUTER_WORKER_URL}/api/projects/save`, {
           
            method: 'POST',
            body: JSON.stringify({
                project: payload,
                visibility
            })
        });

        if (!response.ok) {
            console.error('failed to save the project', await response.text());
            return null;
        }

        const data = (await response.json()) as { project?: DesignItem | null };

        return data?.project ?? null;

    } catch (e) {
        console.log('Failed to save project', e)
        return null;
    }
       
 }

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
        return Array.isArray(data?.projects) ? data.projects : [];

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

    console.log("Fetching project with ID:", id);

    try {
        const response = await puter.workers.exec(
            `${PUTER_WORKER_URL}/api/projects/get?id=${encodeURIComponent(id)}`,
            { method: "GET" },
        );

        console.log("Fetch project response:", response);

        if (!response.ok) {
            console.error("Failed to fetch project:", await response.text());
            return null;
        }

        const data = (await response.json()) as {
            project?: DesignItem | null;
        };

        console.log("Fetched project data:", data);

        return data?.project ?? null;
    } catch (error) {
        console.error("Failed to fetch project:", error);
        return null;
    }
};

const updateProjectSharing = async (
    id: string,
    action: "share" | "unshare",
): Promise<DesignItem> => {
    if (!PUTER_WORKER_URL) {
        throw new Error("Missing VITE_PUTER_WORKER_URL");
    }

    const response = await puter.workers.exec(
        `${PUTER_WORKER_URL}/api/projects/${action}`,
        {
            method: "POST",
            body: JSON.stringify({ id }),
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

export const shareProject = (id: string) => updateProjectSharing(id, "share");

export const unshareProject = (id: string) => updateProjectSharing(id, "unshare");