const PROJECT_PREFIX = 'archvision_project_';
const PUBLIC_PROJECT_PREFIX = 'archvision_public_project_';
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
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${project.id}`);
            if (publicProject?.ownerId !== profile.uuid) {
                return jsonError(403, 'Only the project owner can update a shared project');
            }

            const updatedProject = {
                ...payload,
                isPublic: true,
                sharedBy: publicProject.sharedBy,
                sharedAt: publicProject.sharedAt,
            };
            await me.puter.kv.set(`${PUBLIC_PROJECT_PREFIX}${project.id}`, updatedProject);
            return jsonResponse({ project: updatedProject });
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
        const privateProjects = (await userPuter.kv.list(PROJECT_PREFIX, true))
            .filter(({ key, value }) =>
                key.startsWith(userPrefix) ||
                (key === `${PROJECT_PREFIX}${value?.id}` && !value?.ownerId)
            )
            .map(({ value }) => ({ ...value, isPublic: false }));
        const publicProjects = (await me.puter.kv.list(PUBLIC_PROJECT_PREFIX, true))
            .map(({ value }) => value);
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
        const userPuter = user?.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const id = new URL(request.url).searchParams.get('id');
        if(!id) return jsonError(400, 'Project id is required');

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

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const legacyPrivateKey = `${PROJECT_PREFIX}${id}`;
        const publicKey = `${PUBLIC_PROJECT_PREFIX}${id}`;
        let sourcePrivateKey = privateKey;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            sourcePrivateKey = legacyPrivateKey;
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

        const sharedAt = new Date().toISOString();
        const publicProject = {
            ...project,
            ownerId: profile.uuid,
            sharedBy: profile.username || 'Unknown user',
            sharedAt,
            isPublic: true,
        };

        await me.puter.kv.set(publicKey, publicProject);
        try {
            await userPuter.kv.del(sourcePrivateKey);
        } catch (error) {
            await me.puter.kv.del(publicKey);
            await userPuter.kv.set(sourcePrivateKey, project);
            throw error;
        }

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
        if (existingPrivate) {
            return jsonError(409, 'A private project with this id already exists');
        }

        const { sharedBy: _sharedBy, sharedAt: _sharedAt, ...project } = publicProject;
        const privateProject = {
            ...project,
            isPublic: false,
            ownerId: profile.uuid,
            updatedAt: new Date().toISOString(),
        };

        await userPuter.kv.set(privateKey, privateProject);
        try {
            await me.puter.kv.del(publicKey);
        } catch (error) {
            await userPuter.kv.del(privateKey);
            throw error;
        }

        return jsonResponse({ project: privateProject });
    } catch (e) {
        return jsonError(500, 'Failed to unshare project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})
