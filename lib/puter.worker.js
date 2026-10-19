const PROJECT_PREFIX = 'archvision_project_';
const PUBLIC_PROJECT_PREFIX = 'archvision_public_project_';
const PRIVATE_ASSET_PREFIX = 'archvision_private_asset:';
const PRIVATE_ASSET_ROOT = 'archvision_private_assets';
const MAX_PRIVATE_ASSET_SIZE = 50 * 1024 * 1024;
const MAX_DAILY_GENERATIONS = 20;
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type' : 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    })
}
const jsonError = (status, message, extra ={}) => jsonResponse({ error: message, ...extra }, status);

const getUserProfile = async (userPuter) => {
    try {
        return await userPuter.auth.getUser();
    } catch {
        return null;
    }
}

const getPrivateAssetFileName = (value) => {
    if (typeof value !== 'string' || !value.startsWith(PRIVATE_ASSET_PREFIX)) return null;
    const fileName = value.slice(PRIVATE_ASSET_PREFIX.length);
    return /^[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/i.test(fileName)
        ? fileName
        : null;
}

const getPrivateAssetPath = (ownerId, fileName) =>
    `${PRIVATE_ASSET_ROOT}/${ownerId}/${fileName}`;

const getImageExtensionForType = (contentType) => ({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
})[contentType];
const getImageTypeForExtension = (extension) => ({
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
})[extension];

const getPublicAssetPaths = (id, paths) => {
    if (!Array.isArray(paths)) return null;
    const safeId = encodeURIComponent(id).replace(/\./g, '%2E');
    const prefix = `projects/${safeId}/`;
    const validPaths = paths.filter((path) =>
        typeof path === 'string' &&
        path.startsWith(prefix) &&
        /^(source|rendered)\.(png|jpe?g|webp|gif|svg)$/i.test(path.slice(prefix.length))
    );
    return validPaths.length === paths.length ? validPaths : null;
}

const isPublicHostedUrl = (value) => {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname.endsWith('.puter.site');
    } catch {
        return false;
    }
}

const getHostedPath = (value) => {
    if (!isPublicHostedUrl(value)) return null;
    return new URL(value).pathname.replace(/^\/+/, '');
}

router.post('/api/projects/private-asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const formData = await request.formData();
        const id = formData.get('id');
        const label = formData.get('label');
        const file = formData.get('file');
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (label !== 'source' && label !== 'rendered') return jsonError(400, 'Asset label is invalid');
        if (!file || typeof file.arrayBuffer !== 'function' || typeof file.type !== 'string') {
            return jsonError(400, 'Image file is required');
        }
        if (file.size > MAX_PRIVATE_ASSET_SIZE) return jsonError(413, 'Image must not exceed 50 MB');

        const mediaType = file.type.split(';', 1)[0].trim().toLowerCase();
        const normalizedType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;
        const extension = getImageExtensionForType(normalizedType);
        if (!extension) return jsonError(400, `Unsupported image type: ${file.type || 'unknown'}`);

        const fileName = `${crypto.randomUUID()}.${extension}`;
        await me.puter.fs.write(getPrivateAssetPath(profile.uuid, fileName), file, {
            createMissingParents: true,
        });

        return jsonResponse({ asset: `${PRIVATE_ASSET_PREFIX}${fileName}` });
    } catch (e) {
        return jsonError(500, 'Failed to store private image', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.get('/api/projects/private-asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const label = url.searchParams.get('label');
        if (!id) return jsonError(400, 'Project id is required');
        if (label !== 'source' && label !== 'rendered') return jsonError(400, 'Asset label is invalid');

        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project || project.ownerId !== profile.uuid || project.isPublic) {
            return jsonError(404, 'Project not found');
        }

        const image = project[`${label}Image`];
        const fileName = getPrivateAssetFileName(image);
        if (!fileName) return jsonError(404, 'Private image not found');

        const blob = await me.puter.fs.read(getPrivateAssetPath(profile.uuid, fileName));
        const extension = fileName.split('.').pop().toLowerCase();
        const imageType = getImageExtensionForType(blob.type?.split(';', 1)[0].trim().toLowerCase())
            ? blob.type.split(';', 1)[0].trim().toLowerCase()
            : getImageTypeForExtension(extension);
        if (!imageType) return jsonError(500, 'Stored private image has an unsupported type');
        return new Response(await blob.arrayBuffer(), {
            headers: {
                'Content-Type': imageType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (e) {
        return jsonError(500, 'Failed to retrieve private image', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/generation/authorize', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            project = await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        }
        if (!project) {
            project = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
        }
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can generate a render');
        }
        if (project.renderedImage) return jsonError(409, 'This project already has a render');
        if (!project.sourceImage) return jsonError(400, 'Project source image is missing');

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const usageKey = `archvision_ai_generation:${profile.uuid}:${date}`;
        const usage = await me.puter.kv.incr(usageKey);
        if (usage > MAX_DAILY_GENERATIONS) {
            await me.puter.kv.incr(usageKey, -1);
            const resetAt = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
            );
            return jsonError(429, 'Daily AI generation limit reached. Try again after 00:00 UTC.', {
                limit: MAX_DAILY_GENERATIONS,
                resetAt,
            });
        }

        return jsonResponse({
            authorized: true,
            limit: MAX_DAILY_GENERATIONS,
            remaining: MAX_DAILY_GENERATIONS - usage,
        });
    } catch (e) {
        return jsonError(500, 'Failed to authorize AI generation', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/save', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const project = body?.project;

        if(!project?.id || !project?.sourceImage) return jsonError(400, 'Project ID and source image are required');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${project.id}`;
        const payload = {
            ...project,
            ownerId: profile.uuid,
            isPublic: false,
            updatedAt: new Date().toISOString(),
        };

        if (body?.visibility === 'public') {
            if (!isPublicHostedUrl(project.sourceImage) ||
                (project.renderedImage && !isPublicHostedUrl(project.renderedImage))) {
                return jsonError(400, 'Public project images must use hosted image URLs');
            }
            const publicAssetPaths = getPublicAssetPaths(project.id, body.publicAssetPaths);
            if (!publicAssetPaths ||
                !publicAssetPaths.includes(getHostedPath(project.sourceImage)) ||
                (project.renderedImage && !publicAssetPaths.includes(getHostedPath(project.renderedImage)))) {
                return jsonError(400, 'Public image paths are invalid');
            }

            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${project.id}`);
            if (publicProject?.ownerId !== profile.uuid) {
                return jsonError(403, 'Only the project owner can update a shared project');
            }
            const privateProject = body.privateProject;
            if (privateProject?.id !== project.id ||
                !getPrivateAssetFileName(privateProject.sourceImage) ||
                (privateProject.renderedImage && !getPrivateAssetFileName(privateProject.renderedImage))) {
                return jsonError(400, 'A private image backup is required for shared projects');
            }
            const oldPaths = publicProject.publicAssetPaths === undefined
                ? []
                : getPublicAssetPaths(project.id, publicProject.publicAssetPaths);
            if (!oldPaths) return jsonError(500, 'Existing shared image paths are invalid');
            const allPublicAssetPaths = [...new Set([...oldPaths, ...publicAssetPaths])];

            const updatedProject = {
                ...payload,
                isPublic: true,
                sharedBy: publicProject.sharedBy,
                sharedAt: publicProject.sharedAt,
                publicAssetPaths: allPublicAssetPaths,
            };
            const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${project.id}`;
            const previousPrivateProject = await userPuter.kv.get(privateKey);
            await userPuter.kv.set(privateKey, {
                ...privateProject,
                ownerId: profile.uuid,
                isPublic: false,
                updatedAt: new Date().toISOString(),
            });
            try {
                await me.puter.kv.set(`${PUBLIC_PROJECT_PREFIX}${project.id}`, updatedProject);
            } catch (error) {
                if (previousPrivateProject) {
                    await userPuter.kv.set(privateKey, previousPrivateProject);
                } else {
                    await userPuter.kv.del(privateKey);
                }
                throw error;
            }
            return jsonResponse({ project: updatedProject });
        }

        if (!getPrivateAssetFileName(project.sourceImage) ||
            (project.renderedImage && !getPrivateAssetFileName(project.renderedImage))) {
            return jsonError(400, 'Private project images must use private image storage');
        }

        await userPuter.kv.set(privateKey, payload);

        return jsonResponse({ project: payload });
    } catch (e) {
        return jsonError(500, 'Failed to save project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.get('/api/projects/list', async ({ user }) => {
    try {
        const userPuter = user?.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const userPrefix = `${PROJECT_PREFIX}${profile.uuid}_`;
        const publicProjects = (await me.puter.kv.list(PUBLIC_PROJECT_PREFIX, true))
            .map(({ value }) => value);
        const publicIds = new Set(
            publicProjects
                .filter(({ ownerId }) => ownerId === profile.uuid)
                .map(({ id }) => id),
        );
        const privateProjects = (await userPuter.kv.list(PROJECT_PREFIX, true))
            .filter(({ key, value }) =>
                key.startsWith(userPrefix) ||
                (key === `${PROJECT_PREFIX}${value?.id}` && !value?.ownerId)
            )
            .filter(({ value }) => !publicIds.has(value?.id))
            .map(({ value }) => ({ ...value, isPublic: false }));
        const projects = [...privateProjects, ...publicProjects]
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return jsonResponse({ projects });
    } catch (e) {
        return jsonError(500, 'Failed to list projects', {
            message: e.message || 'Unknown error',
        });
    }
})

router.get('/api/projects/get', async ({ request, user }) => {
    try {
        const id = new URL(request.url).searchParams.get('id');
        if(!id) return jsonError(400, 'Project id is required');

        const userPuter = user?.puter;

        if(!userPuter) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if(!publicProject) return jsonError(404, 'Project not found');

            return jsonResponse({ project: publicProject });
        }

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`)
            ?? await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
        if(project === undefined) return jsonError(404, 'Project not found');

        return jsonResponse({ project });
    } catch (e) {
        return jsonError(500, 'Failed to get project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/share', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if(typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        const publicAssetPaths = getPublicAssetPaths(id, body?.publicAssetPaths);
        if (!publicAssetPaths) return jsonError(400, 'Public image paths are invalid');
        if (!isPublicHostedUrl(body?.publicAssets?.sourceImage) ||
            (body.publicAssets.renderedImage && !isPublicHostedUrl(body.publicAssets.renderedImage))) {
            return jsonError(400, 'Public project images must use hosted image URLs');
        }
        if (!publicAssetPaths.includes(getHostedPath(body.publicAssets.sourceImage)) ||
            (body.publicAssets.renderedImage &&
                !publicAssetPaths.includes(getHostedPath(body.publicAssets.renderedImage)))) {
            return jsonError(400, 'Public image paths are invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const legacyPrivateKey = `${PROJECT_PREFIX}${id}`;
        const publicKey = `${PUBLIC_PROJECT_PREFIX}${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            project = await userPuter.kv.get(legacyPrivateKey);
        }

        if (!project) {
            const existingPublic = await me.puter.kv.get(publicKey);
            if (existingPublic?.ownerId === profile.uuid) {
                return jsonResponse({ project: existingPublic });
            }
            return jsonError(404, 'Private project not found');
        }

        const existingPublic = await me.puter.kv.get(publicKey);
        if (existingPublic && existingPublic.ownerId !== profile.uuid) {
            return jsonError(409, 'A public project with this id already exists');
        }
        const existingPaths = existingPublic?.publicAssetPaths === undefined
            ? []
            : getPublicAssetPaths(id, existingPublic.publicAssetPaths);
        if (!existingPaths) return jsonError(500, 'Existing shared image paths are invalid');

        const sharedAt = new Date().toISOString();
        const publicProject = {
            ...project,
            ownerId: profile.uuid,
            sharedBy: profile.username || 'Unknown user',
            sharedAt,
            isPublic: true,
            sourceImage: body.publicAssets.sourceImage,
            renderedImage: body.publicAssets.renderedImage || null,
            publicAssetPaths: [...new Set([...existingPaths, ...publicAssetPaths])],
        };

        await me.puter.kv.set(publicKey, publicProject);

        return jsonResponse({ project: publicProject });
    } catch (e) {
        return jsonError(500, 'Failed to share project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/unshare', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if(typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');

        const publicKey = `${PUBLIC_PROJECT_PREFIX}${id}`;
        const publicProject = await me.puter.kv.get(publicKey);
        if (!publicProject) return jsonError(404, 'Shared project not found');
        if (publicProject.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can unshare this project');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const existingPrivate = await userPuter.kv.get(privateKey);

        const publicAssetPaths = publicProject.publicAssetPaths === undefined
            ? []
            : getPublicAssetPaths(id, publicProject.publicAssetPaths);
        if (!publicAssetPaths) return jsonError(500, 'Shared image paths are invalid');
        for (const path of publicAssetPaths) {
            await userPuter.fs.delete(path);
        }

        let privateProject = existingPrivate;
        if (!privateProject) {
            const {
                sharedBy: _sharedBy,
                sharedAt: _sharedAt,
                publicAssetPaths: _publicAssetPaths,
                ...project
            } = publicProject;
            privateProject = {
                ...project,
                isPublic: false,
                ownerId: profile.uuid,
                updatedAt: new Date().toISOString(),
            };
            await userPuter.kv.set(privateKey, privateProject);
        }

        await me.puter.kv.del(publicKey);
        return jsonResponse({ project: privateProject });
    } catch (e) {
        return jsonError(500, 'Failed to unshare project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})
