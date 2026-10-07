import puter from "@heyputer/puter.js";
import { getOrCreateHostingConfig, uploadFileToHosting, uploadImageToHosting } from "./puter.hosting";
import { isHostedUrl } from "./utils";

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

export const createProject = async ({ item }: CreateProjectParams):
 Promise<DesignItem | null | undefined> => {
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
        // Call the Puter worker to store project in kv

        return payload;

    } catch (e) {
        console.log('Failed to save project', e)
        return null;
    }
       
 }
