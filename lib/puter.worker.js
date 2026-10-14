const PROJECT_PREFIX = 'archvision_project_';
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

const getUserId = async(userPuter) => {
    try {
        const user = await userPuter.auth.getUser();

        return user?.uuid || null;
    } catch {
        return null;
    }
}

router.post('/api/projects/save', async ({ request, user}) => {
    try {
        const userPuter = user.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const project = body?.project;

        if(!project?.id || project?.sourceImage) return jsonError(400, 'Project not found');

        const payload = {
            ...project,
            updatedAt: new Date().toISOString(),
        }

        const userId = await getUserId(userPuter);
        if(!userId) return jsonError(401, 'Authentication failed');

        const key = `${PROJECT_PREFIX}${project.id}`;
        await userPuter.kv.set(key, payload)


    } catch (e) {
        return jsonError(500, 'Failed to save project', { message: e.message || 'Unknown errror'});
    }
})

router.get('/api/projects/list', async ({ user }) => {
    try {
        const userPuter = user.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const userId = await getUserId(userPuter);
        if(!userId) return jsonError(401, 'Authentication failed');

        const projects = (await userPuter.kv.list(PROJECT_PREFIX, true))
            .map(({value}) => ({ ...value, isPublic:true}))

        return { projects };
    } catch (e) {
        return jsonError(500, 'Failed to list projects', {
            message: e.message || 'Unknown error',
        });
    }
})

router.get('/api/projects/get', async ({ request, user }) => {
    try {
        const userPuter = user.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const userId = await getUserId(userPuter);
        if(!userId) return jsonError(401, 'Authentication failed');

        const id = new URL(request.url).searchParams.get('id');
        if(!id) return jsonError(400, 'Project id is required');

        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if(project === undefined) return jsonError(404, 'Project not found');

        return jsonResponse({ project });
    } catch (e) {
        return jsonError(500, 'Failed to get project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})
