import puter from "@heyputer/puter.js";
import { createHostingSlug, fetchBlobFromUrl, getHostedUrl, getImageExtension, HOSTING_CONFIG_KEY, imageUrlToPngBlob } from "./utils";

type HostingConfig = { subdomain: string; };
type HostedAsset = { url: string; path: string };

const getProjectDirectory = (projectId: string) =>
    `projects/${encodeURIComponent(projectId).replace(/\./g, "%2E")}`;

export const getOrCreateHostingConfig = async (): Promise<HostingConfig | null> => {
    const existing = (await puter.kv.get(HOSTING_CONFIG_KEY)) as HostingConfig | null;
    if(existing?.subdomain) return { subdomain: existing.subdomain};

    const subdomain = createHostingSlug();

    try {
        const created = await puter.hosting.create(subdomain, '.');
        const config = { subdomain: created.subdomain };

        await puter.kv.set(HOSTING_CONFIG_KEY, config);
        return config;

    } catch (e) {
        console.warn(`Could not create or save hosting configuration: ${e}`);
        return null;
    }
}

const writeBlobToHosting = async ({ hosting, blob, projectId, label, sourceUrl }: {
    hosting: HostingConfig | null;
    blob: Blob;
    projectId: string;
    label: "source" | "rendered";
    sourceUrl?: string;
}): Promise<HostedAsset | null> => {
    if (!hosting || !blob) return null;

    const contentType = blob.type || "";
    const ext = getImageExtension(contentType, sourceUrl || "");
    const dir = getProjectDirectory(projectId);
    const filePath = `${dir}/${label}.${ext}`;
    const uploadFile = new File([blob], `${label}.${ext}`, { type: contentType });

    await puter.fs.mkdir(dir, { createMissingParents: true });
    await puter.fs.write(filePath, uploadFile);

    const hostedUrl = getHostedUrl({ subdomain: hosting.subdomain }, filePath);
    return hostedUrl ? { url: hostedUrl, path: filePath } : null;
};

export const uploadFileToHosting = async ({ hosting, file, projectId, label}: {
    hosting: HostingConfig | null;
    file: File | Blob;
    projectId: string;
    label: "source" | "rendered";
}): Promise<HostedAsset | null> => {
    if (!hosting) return null;

    return writeBlobToHosting({
        hosting,
        blob: file,
        projectId,
        label,
        sourceUrl: file instanceof File ? file.name : undefined,
    });
};

export const uploadImageToHosting = async ({ hosting, url, projectId, label}: StoreHostedImageParams): Promise<HostedAsset | null> => {

    if(!hosting || !url) return null;

    try {
        const resolved = label === "rendered"
            ? await imageUrlToPngBlob(url)
                .then((blob) => blob? {blob, contentType: 'image/png'}: null)
            : await fetchBlobFromUrl(url);

        if(!resolved) return null;

        return writeBlobToHosting({
            hosting,
            blob: resolved.blob,
            projectId,
            label,
            sourceUrl: url,
        });

    } catch (e) {
        console.warn(`Failed to store hosted image: ${e}`);
        return null;
    }

}

export const deleteHostedAsset = async (asset: HostedAsset): Promise<void> => {
    await puter.fs.delete(asset.path);
};
