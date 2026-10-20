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
  delete: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
};
const workerKv = {
  del: vi.fn(),
  expire: vi.fn(),
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

it('persists authorized generation metadata next to the render and prevents render overwrites', async () => {
  const owner = createUserPuter('owner-1');
  const generationTimestamp = '2026-10-20T00:00:00.000Z';
  const activeMetadata = {
    generationMode: 'baseline',
    modelIdentifier: 'gemini-3.1-flash-image-preview',
    promptTemplateVersion: 'archvision-baseline-v1',
    configurationSnapshot: null,
    approvedAnalysisRevision: null,
    generationTimestamp,
    generationStatus: 'generating',
  };
  const existingProject = {
    id: 'plan-1',
    ownerId: 'owner-1',
    isPublic: false,
    generationMode: 'baseline',
    sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    generationMetadata: activeMetadata,
  };
  owner.kv.get.mockResolvedValue(existingProject);

  const completed = {
    ...activeMetadata,
    generationStatus: 'complete',
    generationLatencyMs: 1234,
  };
  const saved = await saveHandler({
    request: new Request('https://worker.example/api/projects/save', {
      method: 'POST',
      body: JSON.stringify({
        project: {
          ...existingProject,
          renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
          generationMetadata: completed,
        },
        visibility: 'private',
      }),
    }),
    user: { puter: owner },
  });
  expect(saved.status).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({
    project: {
      renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
      generationMetadata: completed,
      sourceImage: existingProject.sourceImage,
    },
  });

  owner.kv.get.mockResolvedValue({
    ...existingProject,
    renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
    generationMetadata: completed,
  });
  const overwrite = await saveHandler({
    request: new Request('https://worker.example/api/projects/save', {
      method: 'POST',
      body: JSON.stringify({
        project: {
          ...existingProject,
          renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174002.png',
        },
        visibility: 'private',
      }),
    }),
    user: { puter: owner },
  });
  expect(overwrite.status).toBe(409);
});

it('requires Worker authorization before saving a newly generated render', async () => {
  const owner = createUserPuter('owner-1');
  owner.kv.get.mockResolvedValue({
    id: 'plan-1',
    ownerId: 'owner-1',
    sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
  });

  const response = await saveHandler({
    request: new Request('https://worker.example/api/projects/save', {
      method: 'POST',
      body: JSON.stringify({
        project: {
          id: 'plan-1',
          sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
          renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
        },
        visibility: 'private',
      }),
    }),
    user: { puter: owner },
  });

  expect(response.status).toBe(409);
  expect(owner.kv.set).not.toHaveBeenCalled();
});

const privateAssetHandler = handlers.get('GET /api/projects/private-asset')!;
const privateAssetUploadHandler = handlers.get('POST /api/projects/private-asset')!;
const projectHandler = handlers.get('GET /api/projects/get')!;
const saveHandler = handlers.get('POST /api/projects/save')!;
const generationHandler = handlers.get('POST /api/projects/generation/authorize')!;
const generationFailureHandler = handlers.get('POST /api/projects/generation/fail')!;
const renderVersionAssetHandler = handlers.get('POST /api/projects/render-versions/asset')!;
const renderVersionCleanupHandler = handlers.get('POST /api/projects/render-versions/asset/delete')!;
const renderVersionCommitHandler = handlers.get('POST /api/projects/render-versions/commit')!;
const renderVersionImageHandler = handlers.get('GET /api/projects/render-versions/asset')!;
const renderVersionActiveHandler = handlers.get('POST /api/projects/render-versions/active')!;
const renderVersionUpdateHandler = handlers.get('POST /api/projects/render-versions/update')!;
const analysisAuthorizationHandler = handlers.get('POST /api/projects/floor-plan-analysis/authorize')!;
const analysisSaveHandler = handlers.get('POST /api/projects/floor-plan-analysis/save')!;
const renderConfigurationSaveHandler = handlers.get('POST /api/projects/render-configuration/save')!;
const shareHandler = handlers.get('POST /api/projects/share')!;
const unshareHandler = handlers.get('POST /api/projects/unshare')!;

const approvedAnalysis = {
  schemaVersion: 1,
  model: 'gemini-2.5-flash',
  analyzedAt: '2026-10-19T12:00:00.000Z',
  summary: 'One enclosed room is visible.',
  rooms: [{
    id: 'room-1',
    label: 'Room 1',
    possibleFunction: null,
    confidence: 0.62,
    evidence: 'A rectangular enclosure is visible.',
  }],
  doors: [],
  windows: [],
  walls: [],
  relationships: [],
  uncertainties: ['The room function is not identifiable.'],
};
const renderConfiguration = {
  schemaVersion: 1,
  architecturalStyle: 'Scandinavian',
  flooringMaterial: 'Hardwood',
  wallFinish: 'Painted plaster',
  colorPalette: 'Natural',
  lighting: 'Natural daylight',
  furnitureStyle: 'Scandinavian',
  perspective: 'Isometric view',
  customInstructions: 'Prefer light timber and uncluttered furniture.',
  customValues: {},
  updatedAt: '2026-10-20T00:00:00.000Z',
};

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
    workerKv.expire.mockResolvedValue(true);
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

  it('surfaces project persistence failures instead of reporting a successful save', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue(null);
    owner.kv.set.mockRejectedValue(new Error('KV write unavailable'));
    const response = await saveHandler({
      request: new Request('https://worker.example/api/projects/save', {
        method: 'POST',
        body: JSON.stringify({
          project: {
            id: 'plan-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
          },
          visibility: 'private',
        }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to save project',
      message: 'KV write unavailable',
    });
  });

  it('preserves private metadata when a project save omits unrelated fields', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
      floorPlanAnalysis: approvedAnalysis,
      renderConfiguration,
      name: 'Existing project',
    });
    const response = await saveHandler({
      request: new Request('https://worker.example/api/projects/save', {
        method: 'POST',
        body: JSON.stringify({
          project: {
            id: 'plan-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
          },
          visibility: 'private',
        }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
        floorPlanAnalysis: approvedAnalysis,
        renderConfiguration,
        name: 'Existing project',
      }),
    );
  });

  it('does not let a general project save overwrite approved analysis or saved preferences', async () => {
    const owner = createUserPuter('owner-1');
    const existingProject = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      floorPlanAnalysis: approvedAnalysis,
      renderConfiguration,
      approvedAnalysisRevision: 2,
    };
    owner.kv.get.mockResolvedValue(existingProject);
    const alteredAnalysis = { ...approvedAnalysis, summary: 'Unapproved structural changes' };
    const alteredConfiguration = {
      ...renderConfiguration,
      architecturalStyle: 'Industrial',
    };

    const response = await saveHandler({
      request: new Request('https://worker.example/api/projects/save', {
        method: 'POST',
        body: JSON.stringify({
          project: {
            ...existingProject,
            floorPlanAnalysis: alteredAnalysis,
            renderConfiguration: alteredConfiguration,
          },
          visibility: 'private',
        }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        floorPlanAnalysis: approvedAnalysis,
        renderConfiguration,
        approvedAnalysisRevision: 2,
      }),
    );
  });

  it('authorizes Enhanced generation only from owner-approved analysis and saved preferences', async () => {
    const owner = createUserPuter('owner-1');
    const project = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      generationMode: 'enhanced',
      floorPlanAnalysis: approvedAnalysis,
      approvedAnalysisRevision: 4,
      renderConfiguration,
    };
    owner.kv.get.mockResolvedValue(project);

    const response = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      authorized: true,
      generationMode: 'enhanced',
      approvedAnalysisRevision: 4,
      analysis: approvedAnalysis,
      configuration: renderConfiguration,
    });
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        generationMetadata: expect.objectContaining({
          generationMode: 'enhanced',
          configurationSnapshot: renderConfiguration,
          approvedAnalysisRevision: 4,
          generationStatus: 'generating',
        }),
      }),
    );
  });

  it('rejects Enhanced generation when either approved analysis or valid saved settings are missing', async () => {
    const owner = createUserPuter('owner-1');
    const project = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      generationMode: 'enhanced',
    };
    owner.kv.get.mockResolvedValue(project);

    const missingAnalysis = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });
    expect(missingAnalysis.status).toBe(400);
    expect((await missingAnalysis.json()).error).toContain('requires approved floor-plan analysis');

    owner.kv.get.mockResolvedValue({
      ...project,
      floorPlanAnalysis: approvedAnalysis,
      approvedAnalysisRevision: 1,
      renderConfiguration: { ...renderConfiguration, furnitureStyle: 'Unsupported' },
    });
    const invalidConfiguration = await generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });
    expect(invalidConfiguration.status).toBe(400);
    expect((await invalidConfiguration.json()).error).toContain('requires valid saved design settings');
    expect(workerKv.incr).not.toHaveBeenCalled();
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
      floorPlanAnalysis: { summary: 'private structural notes' },
      renderConfiguration,
      approvedAnalysisRevision: 2,
      generationMetadata: { generationMode: 'enhanced', configurationSnapshot: renderConfiguration },
    };
    workerKv.get.mockResolvedValue(project);

    const response = await projectHandler({
      request: new Request('https://worker.example/api/projects/get?id=shared-1'),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      project: {
        id: project.id,
        sourceImage: project.sourceImage,
        isPublic: true,
      },
    });
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
            floorPlanAnalysis: { summary: 'Owner-only interpretation' },
            renderConfiguration,
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
      expect.not.objectContaining({
        floorPlanAnalysis: expect.anything(),
        renderConfiguration: expect.anything(),
      }),
    );
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

    const authorizationBody = await response.clone().json();
    expect(response.status, JSON.stringify(authorizationBody)).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authorized: true,
      limit: 20,
      remaining: 19,
      generationMode: 'baseline',
      generationTimestamp: expect.any(String),
      approvedAnalysisRevision: null,
      versionId: expect.stringMatching(/^[a-f0-9-]{36}$/i),
      versionNumber: 1,
      traceabilityAnalysisRevision: null,
    });
    expect(workerKv.incr).toHaveBeenCalledWith(
      expect.stringMatching(/^archvision_ai_generation:owner-1:\d{4}-\d{2}-\d{2}$/),
    );
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        generationMode: 'baseline',
        generationMetadata: expect.objectContaining({
          generationStatus: 'generating',
          configurationSnapshot: null,
          approvedAnalysisRevision: null,
        }),
      }),
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
    workerKv.incr.mockImplementation(async (key: string) =>
      key.startsWith('archvision_generation_lock:') ? 1 : 21,
    );

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
      3,
      expect.stringMatching(/^archvision_ai_generation:owner-1:\d{4}-\d{2}-\d{2}$/),
      -1,
    );
  });

  it('rejects a duplicate authorization before charging quota or making another AI request', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });
    let lockCount = 0;
    workerKv.incr.mockImplementation(async (key: string, amount = 1) => {
      if (key.startsWith('archvision_generation_lock:')) {
        lockCount += typeof amount === 'number' ? amount : 1;
        return lockCount;
      }
      return 1;
    });

    const makeRequest = () => generationHandler({
      request: new Request('https://worker.example/api/projects/generation/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: owner },
    });
    const first = await makeRequest();
    const duplicate = await makeRequest();

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(409);
    expect(workerKv.incr.mock.calls.filter(([key]) =>
      String(key).startsWith('archvision_ai_generation:'),
    )).toHaveLength(1);
  });

  it('records an authorized generation failure only for the active owner run', async () => {
    const owner = createUserPuter('owner-1');
    const timestamp = '2026-10-20T00:00:00.000Z';
    const activeProject = {
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      generationMetadata: {
        generationMode: 'baseline',
        modelIdentifier: 'gemini-3.1-flash-image-preview',
        promptTemplateVersion: 'archvision-baseline-v1',
        configurationSnapshot: null,
        approvedAnalysisRevision: null,
        generationTimestamp: timestamp,
        generationStatus: 'generating',
      },
    };
    owner.kv.get.mockResolvedValue(activeProject);

    const response = await generationFailureHandler({
      request: new Request('https://worker.example/api/projects/generation/fail', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', generationTimestamp: timestamp }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        generationMetadata: expect.objectContaining({ generationStatus: 'failed' }),
      }),
    );
  });

  it('authorizes floor-plan analysis for the owner and charges the shared AI quota', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });

    const response = await analysisAuthorizationHandler({
      request: new Request('https://worker.example/api/projects/floor-plan-analysis/authorize', {
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

  it('rejects non-owners before charging analysis quota', async () => {
    const otherUser = createUserPuter('owner-2');
    otherUser.kv.get.mockResolvedValue(null);
    workerKv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'https://images.puter.site/plan-1/source.png',
    });

    const response = await analysisAuthorizationHandler({
      request: new Request('https://worker.example/api/projects/floor-plan-analysis/authorize', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
      user: { puter: otherUser },
    });

    expect(response.status).toBe(403);
    expect(workerKv.incr).not.toHaveBeenCalled();
  });

  it('persists an approved interpretation only in the owner private project record', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      isPublic: false,
    });

    const response = await analysisSaveHandler({
      request: new Request('https://worker.example/api/projects/floor-plan-analysis/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', analysis: approvedAnalysis }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis: approvedAnalysis,
      approvedAnalysisRevision: 1,
    });
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        ownerId: 'owner-1',
        floorPlanAnalysis: approvedAnalysis,
        approvedAnalysisRevision: 1,
      }),
    );
    expect(workerKv.set).not.toHaveBeenCalled();
  });

  it('rejects malformed analysis and non-owner saves', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });
    const invalid = { ...approvedAnalysis, rooms: [{ ...approvedAnalysis.rooms[0], confidence: 5 }] };
    const invalidResponse = await analysisSaveHandler({
      request: new Request('https://worker.example/api/projects/floor-plan-analysis/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', analysis: invalid }),
      }),
      user: { puter: owner },
    });
    expect(invalidResponse.status).toBe(400);
    expect(owner.kv.set).not.toHaveBeenCalled();

    const otherUser = createUserPuter('owner-2');
    otherUser.kv.get.mockResolvedValue(null);
    workerKv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'https://images.puter.site/plan-1/source.png',
    });
    const denied = await analysisSaveHandler({
      request: new Request('https://worker.example/api/projects/floor-plan-analysis/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', analysis: approvedAnalysis }),
      }),
      user: { puter: otherUser },
    });
    expect(denied.status).toBe(403);
    expect(otherUser.kv.set).not.toHaveBeenCalled();
  });

  it('saves aesthetic settings without replacing structural analysis or image references', async () => {
    const owner = createUserPuter('owner-1');
    const existingProject = {
      id: 'plan-1',
      ownerId: 'owner-1',
      isPublic: false,
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      renderedImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
      floorPlanAnalysis: approvedAnalysis,
      name: 'House project',
      timestamp: 123,
    };
    let persistedProject = existingProject;
    owner.kv.get.mockImplementation(async (key: string) =>
      key === 'archvision_project_owner-1_plan-1' ? persistedProject : null,
    );
    owner.kv.set.mockImplementation(async (_key: string, value: typeof existingProject) => {
      persistedProject = value;
    });

    const response = await renderConfigurationSaveHandler({
      request: new Request('https://worker.example/api/projects/render-configuration/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', configuration: renderConfiguration }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ configuration: renderConfiguration });
    expect(owner.kv.set).toHaveBeenCalledWith(
      'archvision_project_owner-1_plan-1',
      expect.objectContaining({
        ...existingProject,
        renderConfiguration,
        floorPlanAnalysis: approvedAnalysis,
        ownerId: 'owner-1',
        isPublic: false,
      }),
    );
    expect(workerKv.set).not.toHaveBeenCalled();

    const reloaded = await projectHandler({
      request: new Request('https://worker.example/api/projects/get?id=plan-1'),
      user: { puter: owner },
    });
    await expect(reloaded.json()).resolves.toMatchObject({
      project: {
        floorPlanAnalysis: approvedAnalysis,
        renderConfiguration,
        sourceImage: existingProject.sourceImage,
        renderedImage: existingProject.renderedImage,
      },
    });
  });

  it('rejects non-owner and malformed render configuration writes', async () => {
    const otherUser = createUserPuter('owner-2');
    otherUser.kv.get.mockResolvedValue(null);
    workerKv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'https://images.puter.site/plan-1/source.png',
    });

    const denied = await renderConfigurationSaveHandler({
      request: new Request('https://worker.example/api/projects/render-configuration/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', configuration: renderConfiguration }),
      }),
      user: { puter: otherUser },
    });
    expect(denied.status).toBe(403);
    expect(otherUser.kv.set).not.toHaveBeenCalled();

    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
    });
    const invalid = await renderConfigurationSaveHandler({
      request: new Request('https://worker.example/api/projects/render-configuration/save', {
        method: 'POST',
        body: JSON.stringify({
          id: 'plan-1',
          configuration: { ...renderConfiguration, furnitureStyle: 'Victorian' },
        }),
      }),
      user: { puter: owner },
    });
    expect(invalid.status).toBe(400);
    expect(owner.kv.set).not.toHaveBeenCalled();
  });

  it('does not treat an ownerless global legacy record as proof of ownership', async () => {
    const user = createUserPuter('owner-2');
    user.kv.get.mockImplementation(async (key: string) =>
      key === 'archvision_project_plan-1'
        ? {
            id: 'plan-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
          }
        : null,
    );
    const response = await renderConfigurationSaveHandler({
      request: new Request('https://worker.example/api/projects/render-configuration/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', configuration: renderConfiguration }),
      }),
      user: { puter: user },
    });

    expect(response.status).toBe(404);
    expect(user.kv.set).not.toHaveBeenCalled();
  });

  it('keeps design settings private when creating the public shared copy', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockImplementation(async (key: string) =>
      key === 'archvision_project_owner-1_plan-1'
        ? {
            id: 'plan-1',
            ownerId: 'owner-1',
            sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
            isPublic: false,
            floorPlanAnalysis: approvedAnalysis,
            renderConfiguration,
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
      expect.not.objectContaining({
        floorPlanAnalysis: expect.anything(),
        renderConfiguration: expect.anything(),
      }),
    );
  });

  it('returns a storage error without a success-shaped response when KV save fails', async () => {
    const owner = createUserPuter('owner-1');
    owner.kv.get.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'owner-1',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      floorPlanAnalysis: approvedAnalysis,
    });
    owner.kv.set.mockRejectedValue(new Error('KV unavailable'));

    const response = await renderConfigurationSaveHandler({
      request: new Request('https://worker.example/api/projects/render-configuration/save', {
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', configuration: renderConfiguration }),
      }),
      user: { puter: owner },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to save design settings',
      message: 'KV unavailable',
    });
  });

  describe('Worker render version lifecycle', () => {
    const versionId = '123e4567-e89b-12d3-a456-426614174002';
    const priorVersionId = '123e4567-e89b-12d3-a456-426614174001';
    const generationTimestamp = '2026-10-20T12:00:00.000Z';
    const priorAsset = 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174003.png';
    const newAsset = `archvision_private_asset:${versionId}.png`;
    const priorVersion = {
      id: priorVersionId,
      projectId: 'plan-1',
      versionNumber: 1,
      imageAssetReference: priorAsset,
      generationMode: 'baseline',
      modelIdentifier: 'gemini-3.1-flash-image-preview',
      promptTemplateVersion: 'archvision-baseline-v1',
      configurationSnapshot: null,
      approvedAnalysisRevision: null,
      createdAt: '2026-10-19T12:00:00.000Z',
      generationStatus: 'complete',
    };
    const activeMetadata = {
      generationMode: 'enhanced',
      modelIdentifier: 'gemini-3.1-flash-image-preview',
      promptTemplateVersion: 'archvision-enhanced-v1',
      configurationSnapshot: renderConfiguration,
      approvedAnalysisRevision: 1,
      generationTimestamp,
      generationStatus: 'generating',
      versionId,
      versionNumber: 2,
    };
    const projectDuringGeneration = () => ({
      id: 'plan-1',
      ownerId: 'owner-1',
      isPublic: false,
      generationMode: 'baseline',
      sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
      renderedImage: priorAsset,
      renderedPath: priorAsset,
      renderVersions: [priorVersion],
      activeRenderVersionId: priorVersionId,
      floorPlanAnalysis: approvedAnalysis,
      approvedAnalysisRevision: 1,
      renderConfiguration,
      generationMetadata: activeMetadata,
      activeGenerationContext: {
        versionId,
        versionNumber: 2,
        generationMode: 'enhanced',
        generationTimestamp,
        traceabilityAnalysisRevision: 1,
        traceabilityAnalysis: approvedAnalysis,
        traceabilityConfiguration: renderConfiguration,
      },
    });

    beforeEach(() => {
      vi.clearAllMocks();
      workerFs.read.mockResolvedValue(privateImage);
      workerFs.write.mockResolvedValue(undefined);
      workerFs.delete.mockResolvedValue(undefined);
      workerKv.get.mockResolvedValue(null);
      workerKv.incr.mockResolvedValue(1);
      workerKv.expire.mockResolvedValue(true);
    });

    it('authorizes another selected mode on a project with a render and numbers it sequentially', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue({
        ...projectDuringGeneration(),
        generationMetadata: priorVersion,
        activeGenerationContext: undefined,
      });

      const response = await generationHandler({
        request: new Request('https://worker.example/api/projects/generation/authorize', {
          method: 'POST',
          body: JSON.stringify({ id: 'plan-1', generationMode: 'enhanced' }),
        }),
        user: { puter: owner },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        generationMode: 'enhanced',
        versionNumber: 2,
        approvedAnalysisRevision: 1,
        traceabilityAnalysisRevision: 1,
        traceabilityAnalysis: approvedAnalysis,
        traceabilityConfiguration: renderConfiguration,
      });
      expect(owner.kv.set).toHaveBeenCalledWith(
        'archvision_project_owner-1_plan-1',
        expect.objectContaining({
          renderedImage: priorAsset,
          renderVersions: [priorVersion],
          activeGenerationContext: expect.objectContaining({
            versionNumber: 2,
            generationMode: 'enhanced',
          }),
        }),
      );
    });

    it('stores a versioned private image only for the authorized owner run', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue(projectDuringGeneration());
      const formData = new FormData();
      formData.set('id', 'plan-1');
      formData.set('versionId', versionId);
      formData.set('generationTimestamp', generationTimestamp);
      formData.set('file', new File(['render'], 'render.png', { type: 'image/png' }));

      const uploadRequest = new Request('https://worker.example/api/projects/render-versions/asset', {
        method: 'POST',
      });
      vi.spyOn(uploadRequest, 'formData').mockResolvedValue(formData);
      const response = await renderVersionAssetHandler({
        request: uploadRequest,
        user: { puter: owner },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ asset: newAsset });
      expect(workerFs.write).toHaveBeenCalledWith(
        `archvision_private_assets/owner-1/${versionId}.png`,
        expect.anything(),
        { createMissingParents: true },
      );

      const otherUser = createUserPuter('owner-2');
      otherUser.kv.get.mockResolvedValue(projectDuringGeneration());
      const rejectedRequest = new Request('https://worker.example/api/projects/render-versions/asset', {
        method: 'POST',
      });
      vi.spyOn(rejectedRequest, 'formData').mockResolvedValue(formData);
      const rejected = await renderVersionAssetHandler({
        request: rejectedRequest,
        user: { puter: otherUser },
      });
      expect(rejected.status).toBe(403);
    });

    it('commits a distinct enhanced version while preserving the previous successful render', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue(projectDuringGeneration());
      const response = await renderVersionCommitHandler({
        request: new Request('https://worker.example/api/projects/render-versions/commit', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            versionId,
            generationTimestamp,
            imageAssetReference: newAsset,
            generationLatencyMs: 4567,
          }),
        }),
        user: { puter: owner },
      });

      expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
      const result = await response.json();
      expect(result.version).toMatchObject({
        id: versionId,
        projectId: 'plan-1',
        versionNumber: 2,
        imageAssetReference: newAsset,
        generationMode: 'enhanced',
        configurationSnapshot: renderConfiguration,
        approvedAnalysisRevision: 1,
        approvedAnalysisSnapshot: approvedAnalysis,
        generationLatencyMs: 4567,
        generationStatus: 'complete',
      });
      expect(result.project).toMatchObject({
        renderedImage: newAsset,
        renderedPath: newAsset,
        activeRenderVersionId: versionId,
        renderVersions: [priorVersion, result.version],
        generationMetadata: {
          generationStatus: 'complete',
          versionId,
          versionNumber: 2,
        },
      });
    });

    it('does not corrupt prior versions on failed KV commit and safely cleans uncommitted files', async () => {
      const owner = createUserPuter('owner-1');
      const activeProject = projectDuringGeneration();
      owner.kv.get.mockResolvedValue(activeProject);
      owner.kv.set.mockRejectedValueOnce(new Error('KV unavailable'));
      const response = await renderVersionCommitHandler({
        request: new Request('https://worker.example/api/projects/render-versions/commit', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            versionId,
            generationTimestamp,
            imageAssetReference: newAsset,
            generationLatencyMs: 1000,
          }),
        }),
        user: { puter: owner },
      });
      expect(response.status).toBe(500);
      expect(activeProject.renderedImage).toBe(priorAsset);

      const cleanup = await renderVersionCleanupHandler({
        request: new Request('https://worker.example/api/projects/render-versions/asset/delete', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            versionId,
            generationTimestamp,
            imageAssetReference: newAsset,
          }),
        }),
        user: { puter: owner },
      });
      expect(cleanup.status).toBe(200);
      expect(workerFs.delete).toHaveBeenCalledWith(
        `archvision_private_assets/owner-1/${versionId}.png`,
      );
    });

    it('removes a partial image after filesystem persistence fails', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue(projectDuringGeneration());
      workerFs.write.mockRejectedValueOnce(new Error('filesystem unavailable'));
      const formData = new FormData();
      formData.set('id', 'plan-1');
      formData.set('versionId', versionId);
      formData.set('generationTimestamp', generationTimestamp);
      formData.set('file', new File(['render'], 'render.png', { type: 'image/png' }));

      const uploadRequest = new Request('https://worker.example/api/projects/render-versions/asset', {
        method: 'POST',
      });
      vi.spyOn(uploadRequest, 'formData').mockResolvedValue(formData);
      const response = await renderVersionAssetHandler({
        request: uploadRequest,
        user: { puter: owner },
      });
      expect(response.status).toBe(500);
      expect(workerFs.delete).toHaveBeenCalledWith(
        `archvision_private_assets/owner-1/${versionId}.png`,
      );
    });

    it('retrieves private images by authorized project and version identifiers only', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue({
        ...projectDuringGeneration(),
        renderVersions: [
          priorVersion,
          {
            id: versionId,
            projectId: 'plan-1',
            versionNumber: 2,
            imageAssetReference: newAsset,
            generationMode: 'enhanced',
            modelIdentifier: 'gemini-3.1-flash-image-preview',
            promptTemplateVersion: 'archvision-enhanced-v1',
            configurationSnapshot: renderConfiguration,
            approvedAnalysisRevision: 1,
            approvedAnalysisSnapshot: approvedAnalysis,
            createdAt: generationTimestamp,
            generationLatencyMs: 1000,
            generationStatus: 'complete',
          },
        ],
      });
      const response = await renderVersionImageHandler({
        request: new Request(`https://worker.example/api/projects/render-versions/asset?id=plan-1&versionId=${versionId}`),
        user: { puter: owner },
      });
      expect(response.status).toBe(200);
      expect(workerFs.read).toHaveBeenCalledWith(
        `archvision_private_assets/owner-1/${versionId}.png`,
      );

      const manipulated = await renderVersionImageHandler({
        request: new Request('https://worker.example/api/projects/render-versions/asset?id=other-plan&versionId=123e4567-e89b-12d3-a456-426614174002'),
        user: { puter: owner },
      });
      expect(manipulated.status).toBe(404);
    });

    it('changes the active pointer and editable details without invoking generation', async () => {
      const owner = createUserPuter('owner-1');
      const project = {
        ...projectDuringGeneration(),
        renderVersions: [priorVersion],
        generationMetadata: undefined,
        activeGenerationContext: undefined,
      };
      owner.kv.get.mockResolvedValue(project);

      const activeResponse = await renderVersionActiveHandler({
        request: new Request('https://worker.example/api/projects/render-versions/active', {
          method: 'POST',
          body: JSON.stringify({ id: 'plan-1', versionId: priorVersionId }),
        }),
        user: { puter: owner },
      });
      expect(activeResponse.status).toBe(200);
      await expect(activeResponse.json()).resolves.toMatchObject({
        project: {
          activeRenderVersionId: priorVersionId,
          renderedImage: priorAsset,
        },
      });

      const updateResponse = await renderVersionUpdateHandler({
        request: new Request('https://worker.example/api/projects/render-versions/update', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            versionId: priorVersionId,
            name: 'First study',
            notes: 'Initial conceptual comparison.',
          }),
        }),
        user: { puter: owner },
      });
      expect(updateResponse.status).toBe(200);
      await expect(updateResponse.json()).resolves.toMatchObject({
        project: {
          renderVersions: [{
            ...priorVersion,
            name: 'First study',
            notes: 'Initial conceptual comparison.',
          }],
        },
      });
      expect(workerKv.incr).not.toHaveBeenCalled();
    });

    it('keeps render history and private research metadata out of public responses', async () => {
      workerKv.get.mockResolvedValue({
        id: 'plan-1',
        ownerId: 'owner-1',
        isPublic: true,
        sourceImage: 'https://archvision.puter.site/projects/plan-1/source.png',
        renderedImage: 'https://archvision.puter.site/projects/plan-1/rendered.png',
        renderVersions: [priorVersion],
        activeRenderVersionId: priorVersionId,
        generationMetadata: activeMetadata,
        floorPlanAnalysis: approvedAnalysis,
        renderConfiguration,
      });
      const response = await projectHandler({
        request: new Request('https://worker.example/api/projects/get?id=plan-1'),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.project).toMatchObject({
        renderedImage: 'https://archvision.puter.site/projects/plan-1/rendered.png',
      });
      expect(body.project).not.toHaveProperty('renderVersions');
      expect(body.project).not.toHaveProperty('activeRenderVersionId');
      expect(body.project).not.toHaveProperty('generationMetadata');
      expect(body.project).not.toHaveProperty('renderConfiguration');
    });

    it('publishes only the active version asset and excludes private history', async () => {
      const owner = createUserPuter('owner-1');
      const activeVersion = {
        ...priorVersion,
        id: versionId,
        versionNumber: 2,
        imageAssetReference: newAsset,
        generationMode: 'enhanced',
        promptTemplateVersion: 'archvision-enhanced-v1',
        configurationSnapshot: renderConfiguration,
        approvedAnalysisRevision: 1,
        approvedAnalysisSnapshot: approvedAnalysis,
      };
      owner.kv.get.mockResolvedValue({
        id: 'plan-1',
        ownerId: 'owner-1',
        isPublic: false,
        sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
        renderedImage: newAsset,
        renderedPath: newAsset,
        renderVersions: [priorVersion, activeVersion],
        activeRenderVersionId: versionId,
      });
      const publicRender = `https://images.puter.site/projects/plan-1/rendered-${versionId}.png`;
      const requestBody = {
        id: 'plan-1',
        renderVersionId: versionId,
        publicAssets: {
          sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
          renderedImage: publicRender,
          renderVersionId: versionId,
        },
        publicAssetPaths: [
          'projects/plan-1/source.png',
          `projects/plan-1/rendered-${versionId}.png`,
        ],
      };
      const response = await shareHandler({
        request: new Request('https://worker.example/api/projects/share', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }),
        user: { puter: owner },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.project).toMatchObject({ renderedImage: publicRender });
      expect(body.project).not.toHaveProperty('renderVersions');
      expect(body.project).not.toHaveProperty('activeRenderVersionId');

      workerKv.set.mockClear();
      const rejected = await shareHandler({
        request: new Request('https://worker.example/api/projects/share', {
          method: 'POST',
          body: JSON.stringify({ ...requestBody, renderVersionId: priorVersionId }),
        }),
        user: { puter: owner },
      });
      expect(rejected.status).toBe(409);
      expect(workerKv.set).not.toHaveBeenCalled();
    });

    it('rejects additional historical render paths from the public asset list', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue({
        id: 'plan-1',
        ownerId: 'owner-1',
        isPublic: false,
        sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
        renderedImage: priorAsset,
        renderVersions: [priorVersion],
        activeRenderVersionId: priorVersionId,
      });
      const publicRender =
        `https://images.puter.site/projects/plan-1/rendered-${priorVersionId}.png`;
      const response = await shareHandler({
        request: new Request('https://worker.example/api/projects/share', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            renderVersionId: priorVersionId,
            publicAssets: {
              sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
              renderedImage: publicRender,
              renderVersionId: priorVersionId,
            },
            publicAssetPaths: [
              'projects/plan-1/source.png',
              `projects/plan-1/rendered-${priorVersionId}.png`,
              'projects/plan-1/rendered-older-version.png',
            ],
          }),
        }),
        user: { puter: owner },
      });

      expect(response.status).toBe(400);
      expect(workerKv.set).not.toHaveBeenCalled();
    });

    it('revokes obsolete render assets when publishing a different active version', async () => {
      const owner = createUserPuter('owner-1');
      owner.kv.get.mockResolvedValue({
        id: 'plan-1',
        ownerId: 'owner-1',
        isPublic: false,
        sourceImage: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png',
        renderedImage: priorAsset,
        renderVersions: [priorVersion],
        activeRenderVersionId: priorVersionId,
      });
      workerKv.get.mockResolvedValue({
        id: 'plan-1',
        ownerId: 'owner-1',
        publicAssetPaths: [
          'projects/plan-1/source.png',
          'projects/plan-1/rendered-older-version.png',
        ],
      });
      const publicRender =
        `https://images.puter.site/projects/plan-1/rendered-${priorVersionId}.png`;
      const response = await shareHandler({
        request: new Request('https://worker.example/api/projects/share', {
          method: 'POST',
          body: JSON.stringify({
            id: 'plan-1',
            renderVersionId: priorVersionId,
            publicAssets: {
              sourceImage: 'https://images.puter.site/projects/plan-1/source.png',
              renderedImage: publicRender,
              renderVersionId: priorVersionId,
            },
            publicAssetPaths: [
              'projects/plan-1/source.png',
              `projects/plan-1/rendered-${priorVersionId}.png`,
            ],
          }),
        }),
        user: { puter: owner },
      });

      expect(response.status).toBe(200);
      expect(owner.fs.delete).toHaveBeenCalledWith(
        'projects/plan-1/rendered-older-version.png',
      );
      await expect(response.json()).resolves.toMatchObject({
        project: {
          publicAssetPaths: [
            'projects/plan-1/source.png',
            `projects/plan-1/rendered-${priorVersionId}.png`,
          ],
        },
      });
    });
  });
});
