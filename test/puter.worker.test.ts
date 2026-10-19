import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerContext = { request: Request; user?: unknown };
type WorkerHandler = (context: WorkerContext) => Promise<Response>;

const workerSource = readFileSync(
  resolve(process.cwd(), 'lib', 'puter.worker.js'),
  'utf8',
);
const handlers = new Map<string, WorkerHandler>();
const privateImage = new Blob(['confidential plan'], { type: 'image/png' });
const workerFs = {
  read: vi.fn(),
  write: vi.fn(),
};
const workerKv = {
  del: vi.fn(),
  get: vi.fn(),
  incr: vi.fn(),
  list: vi.fn(),
  set: vi.fn(),
};
const registerRoute = (method: string, path: string, handler: WorkerHandler) => {
  handlers.set(`${method} ${path}`, handler);
};

runInNewContext(workerSource, {
  crypto: { randomUUID: () => '123e4567-e89b-12d3-a456-426614174000' },
  Date,
  Error,
  JSON,
  Response,
  Set,
  URL,
  console,
  me: { puter: { fs: workerFs, kv: workerKv } },
  router: {
    get: (path: string, handler: WorkerHandler) => registerRoute('GET', path, handler),
    post: (path: string, handler: WorkerHandler) => registerRoute('POST', path, handler),
  },
});

const privateAssetHandler = handlers.get('GET /api/projects/private-asset')!;
const privateAssetUploadHandler = handlers.get('POST /api/projects/private-asset')!;
const projectHandler = handlers.get('GET /api/projects/get')!;
const saveHandler = handlers.get('POST /api/projects/save')!;
const generationHandler = handlers.get('POST /api/projects/generation/authorize')!;
const shareHandler = handlers.get('POST /api/projects/share')!;
const unshareHandler = handlers.get('POST /api/projects/unshare')!;

const createUserPuter = (uuid: string) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ uuid }) },
  fs: { delete: vi.fn() },
  kv: { del: vi.fn(), get: vi.fn(), set: vi.fn() },
});

describe('Worker private project image access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerFs.read.mockResolvedValue(privateImage);
    workerKv.get.mockResolvedValue(null);
    workerKv.incr.mockResolvedValue(1);
  });

  it('requires authentication for private image retrieval', async () => {
    const response = await privateAssetHandler({
      request: new Request('https://worker.example/api/projects/private-asset?id=plan-1&label=source'),
    });

    expect(response.status).toBe(401);
    expect(workerFs.read).not.toHaveBeenCalled();
  });

  it('uses the stored image extension when the filesystem returns a generic MIME type', async () => {
    const project = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      isPublic: false,
    };
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue(project);
    workerFs.read.mockResolvedValue(new Blob(['floor plan'], { type: 'application/octet-stream' }));

    const response = await privateAssetHandler({
      request: new Request('https://worker.example/api/projects/private-asset?id=plan-1&label=source'),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts supported image MIME types when uploading private images', async () => {
    const owner = createUserPuter('owner-1');
    const formData = new FormData();
    formData.set('id', 'plan-1');
    formData.set('label', 'source');
    formData.set(
      'file',
      new File(['floor plan'], 'source.png', { type: 'image/png' }),
    );
    const request = new Request('https://worker.example/api/projects/private-asset', {
      method: 'POST',
    });
    vi.spyOn(request, 'formData').mockResolvedValue(formData);

    const response = await privateAssetUploadHandler({
      request,
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asset: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });
    expect(workerFs.write).toHaveBeenCalledOnce();
  });

  it('rejects public image URLs when saving a private project', async () => {
    const owner = createUserPuter('owner-1');
    const response = await saveHandler({
      request: new Request('https://worker.example/api/projects/save', {
        method: 'POST',
        body: JSON.stringify({
          project: {
            id: 'plan-1',
            sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
          },
          visibility: 'private',
        }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(400);
    expect(owner.kv.set).not.toHaveBeenCalled();
  });

  it('allows only the owning Puter user to retrieve a private project image', async () => {
    const project = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      isPublic: false,
    };
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue(project);

    const response = await privateAssetHandler({
      request: new Request('https://worker.example/api/projects/private-asset?id=plan-1&label=source'),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toBe('confidential plan');
    expect(workerFs.read).toHaveBeenCalledWith(
      'archvision_private_assets/owner-1/123e4567-e89b-12d3-a456-426614174000.png',
    );

    const otherUser = createUserPuter('owner-2');
    otherUser.kv.get.mockResolvedValue(project);
    const denied = await privateAssetHandler({
      request: new Request('https://worker.example/api/projects/private-asset?id=plan-1&label=source'),
      user: { puter: otherUser },
    });

    expect(denied.status).toBe(404);
    expect(workerFs.read).toHaveBeenCalledTimes(1);
  });

  it('continues to serve public project metadata without authentication', async () => {
    const project = {
      id: 'shared-1',
      sourceImage: 'https://images.puter.site/projects/shared-1/source.png',
      isPublic: true,
    };
    workerKv.get.mockResolvedValue(project);

    const response = await projectHandler({
      request: new Request('https://worker.example/api/projects/get?id=shared-1'),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ project });
    expect(workerKv.get).toHaveBeenCalledWith('archvision_public_project_shared-1');
  });

  it('publishes explicit hosted copies while retaining the owner-only private project', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockImplementation(async (key: string) =>
      key === 'archvision_project_owner-1_plan-1'
        ? {
            id: 'plan-1',
            ownerId: 'owner-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
            isPublic: false,
          }
        : null,
    );
    const response = await shareHandler({
      request: new Request('https://worker.example/api/projects/share', {
        method: 'POST',
        body: JSON.stringify({
          id: 'plan-1',
          publicAssets: {
            sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
          },
          publicAssetPaths: ['projects/plan-1/source.png'],
        }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(workerKv.set).toHaveBeenCalledWith(
      'archvision_public_project_plan-1',
      expect.objectContaining({
        sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
        publicAssetPaths: ['projects/plan-1/source.png'],
        isPublic: true,
      }),
    );
    expect(owner.kv.del).not.toHaveBeenCalled();
  });

  it('revokes hosted image files when the owner unshares a project', async () => {
    const publicProject = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
      publicAssetPaths: ['projects/plan-1/source.png'],
      isPublic: true,
    };
    const privateProject = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      isPublic: false,
    };
    workerKv.get.mockResolvedValue(publicProject);
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue(privateProject);

    const response = await unshareHandler({
      request: new Request('https://worker.example/api/projects/unshare', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(owner.fs.delete).toHaveBeenCalledWith('projects/plan-1/source.png');
    expect(workerKv.del).toHaveBeenCalledWith('archvision_public_project_plan-1');
    await expect(response.json()).resolves.toEqual({ project: privateProject });
  });

  it('rejects an unsafe public asset path without deleting files', async () => {
    workerKv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      publicAssetPaths: ['projects/plan-1/../../private.png'],
    });
    const owner = createUserPuter('owner-1');

    const response = await unshareHandler({
      request: new Request('https://worker.example/api/projects/unshare', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(500);
    expect(owner.fs.delete).not.toHaveBeenCalled();
    expect(workerKv.del).not.toHaveBeenCalled();
  });

  it('authorizes the owner and atomically charges the daily generation quota', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockImplementation(async (key: string) =>
      key === 'archvision_project_owner-1_plan-1'
        ? {
            id: 'plan-1',
            ownerId: 'owner-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
            renderedImage: null,
          }
        : null,
    );

    const response = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorized: true,
      limit: 20,
      remaining: 19,
    });
    expect(workerKv.incr).toHaveBeenCalledWith(
      expect.stringMatching(/^archvision_ai_generation:owner-1:\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('rejects non-owners before consuming generation quota', async () => {
    const otherUser = createUserPuter('owner-2');
    otherUser.kv.get.mockResolvedValue(null);
    workerKv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      isPublic: true,
    });

    const response = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: otherUser },
    });

    expect(response.status).toBe(403);
    expect(workerKv.incr).not.toHaveBeenCalled();
  });

  it('rejects projects without an owner before consuming generation quota', async () => {
    const user = createUserPuter('owner-1');
    user.kv.get.mockResolvedValue({
      id: 'legacy-plan',
      sourceImage: 'https://images.puter.site/legacy-plan/source.png',
    });

    const response = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'legacy-plan' }),
      }),
      user: { puter: user },
    });

    expect(response.status).toBe(403);
    expect(workerKv.incr).not.toHaveBeenCalled();
  });

  it('rejects additional generation attempts after the daily limit', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });
    workerKv.incr.mockResolvedValue(21);

    const response = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Daily AI generation limit reached. Try again after 00:00 UTC.',
      limit: 20,
    });
    expect(workerKv.incr).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^archvision_ai_generation:owner-1:\d{4}-\d{2}-\d{2}$/),
      -1,
    );
  });
});
