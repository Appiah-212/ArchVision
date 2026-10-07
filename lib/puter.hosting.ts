import puter from "@heyputer/puter.js";
import { createHostingSlug, fetchBlobFromUrl, getHostedUrl, getImageExtension, HOSTING_CONFIG_KEY, imageUrlToPngBlob, isHostedUrl } from "./utils";

type HostingConfig = { subdomain: string; };
type HostedAsset = { url: string };

export const getOrCreateHostingConfig = async (): Promise<HostingConfig | null> => {
    const existing = (await puter.kv.get(HOSTING_CONFIG_KEY)) as HostingConfig | null;
    if(existing?.subdomain) return { subdomain: existing.subdomain};

    const subdomain = createHostingSlug();

    try {
        const created = await puter.hosting.create(subdomain, '.');

         return  { subdomain: created.subdomain};       

    } catch (e) {
        console.warn(`Could not find subdomain: ${e}`);
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
    const dir = `projects/${projectId}`;
    const filePath = `${dir}/${label}.${ext}`;
    const uploadFile = new File([blob], `${label}.${ext}`, { type: contentType });

    await puter.fs.mkdir(dir, { createMissingParents: true });
    await puter.fs.write(filePath, uploadFile);

    const hostedUrl = getHostedUrl({ subdomain: hosting.subdomain }, filePath);
    return hostedUrl ? { url: hostedUrl } : null;
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
    if(isHostedUrl(url)) return { url };

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

