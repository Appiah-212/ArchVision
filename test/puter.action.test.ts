import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  exec,
  getUser,
  getOrCreateHostingConfig,
  uploadFileToHosting,
  uploadImageToHosting,
  deleteHostedAsset,
} = vi.hoisted(() => ({
  exec: vi.fn(),
  getUser: vi.fn(),
  getOrCreateHostingConfig: vi.fn(),
  uploadFileToHosting: vi.fn(),
  uploadImageToHosting: vi.fn(),
  deleteHostedAsset: vi.fn(),
}));

vi.mock('@heyputer/puter.js', () => ({
  default: {
    workers: { exec },
    auth: { getUser },
  },
}));

vi.mock('../lib/puter.hosting', () => ({
  deleteHostedAsset,
  getOrCreateHostingConfig,
  uploadFileToHosting,
  uploadImageToHosting,
}));

import {
  authorizeFloorPlanAnalysis,
  authorizeProjectGeneration,
  createProject,
  getProjectById,
  markProjectGenerationFailed,
  saveRenderConfiguration,
  saveFloorPlanAnalysis,
  shareProject,
} from '../lib/puter.action';
import type { FloorPlanAnalysis } from '../lib/floor-plan-analysis';
import {
  createDefaultRenderConfiguration,
  type RenderConfiguration,
} from '../lib/render-configuration';

const approvedAnalysis: FloorPlanAnalysis = {
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

describe('public project retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retrieves a public project anonymously without invoking authenticated worker execution', async () => {
    const project = {
      id: 'shared-project',
      sourceImage: 'https://example.com/source.png',
      isPublic: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getProjectById({ id: project.id });

    expect(result).toEqual(project);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(exec).not.toHaveBeenCalled();
  });

  it('retrieves a private project through authenticated worker execution without an anonymous 404', async () => {
    const project = {
      id: 'private-project',
      sourceImage: 'https://example.com/source.png',
      isPublic: false,
    };
    getUser.mockResolvedValue({ uuid: 'owner-1' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    exec.mockResolvedValue(
      new Response(JSON.stringify({ project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getProjectById({ id: project.id });

    expect(result).toMatchObject(project);
    expect(result).toMatchObject({
      activeRenderVersionId: null,
      renderVersions: [],
      renderVersionImages: {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledOnce();
  });

  it('keeps a private source image available when the private render asset is missing', async () => {
    getUser.mockResolvedValue({ uuid: 'owner-1' });
    const sourceAsset = 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png';
    const renderedAsset = 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png';
    exec.mockImplementation(async (url: string) => {
      if (url.includes('/api/projects/get?')) {
        return new Response(JSON.stringify({
          project: {
            id: 'private-project',
            ownerId: 'owner-1',
            isPublic: false,
            sourceImage: sourceAsset,
            renderedImage: renderedAsset,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('label=source')) {
        return new Response(new Blob(['source'], { type: 'image/png' }), { status: 200 });
      }
      if (url.includes('label=rendered')) {
        return new Response(JSON.stringify({
          error: 'Failed to retrieve private image',
          message: 'Object not found',
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected Worker request: ${url}`);
    });

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await getProjectById({ id: 'private-project' });

    expect(result?.sourceImage).toMatch(/^blob:/);
    expect(result?.renderedImage).toBeNull();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('using its source image'),
      expect.any(Error),
    );
  });

    it('reloads every retained private render version and resolves each image through its version ID', async () => {
      getUser.mockResolvedValue({ uuid: 'owner-1' });
      const versions = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          projectId: 'private-project',
          versionNumber: 1,
          imageAssetReference: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png',
          generationMode: 'baseline',
          modelIdentifier: 'gemini-3.1-flash-image-preview',
          promptTemplateVersion: 'archvision-baseline-v1',
          configurationSnapshot: null,
          approvedAnalysisRevision: null,
          createdAt: '2026-10-19T12:00:00.000Z',
          generationStatus: 'complete',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          projectId: 'private-project',
          versionNumber: 2,
          imageAssetReference: 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174002.png',
          generationMode: 'baseline',
          modelIdentifier: 'gemini-3.1-flash-image-preview',
          promptTemplateVersion: 'archvision-baseline-v1',
          configurationSnapshot: null,
          approvedAnalysisRevision: null,
          createdAt: '2026-10-20T12:00:00.000Z',
          generationStatus: 'complete',
        },
      ];
      exec.mockImplementation(async (url: string) => {
        if (url.includes('/api/projects/get?')) {
          return new Response(JSON.stringify({
            project: {
              id: 'private-project',
              ownerId: 'owner-1',
              sourceImage: 'https://example.com/source.png',
              renderedImage: versions[1].imageAssetReference,
              renderVersions: versions,
              activeRenderVersionId: versions[1].id,
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('/api/projects/private-asset?')) {
          return new Response(new Blob(['active'], { type: 'image/png' }), { status: 200 });
        }
        if (url.includes('/api/projects/render-versions/asset?')) {
          return new Response(new Blob([url.includes(versions[0].id) ? 'one' : 'two'], {
            type: 'image/png',
          }), { status: 200 });
        }
        throw new Error(`Unexpected Worker request: ${url}`);
      });

      const result = await getProjectById({ id: 'private-project' });

      expect(result?.renderVersions?.map(({ versionNumber }) => versionNumber)).toEqual([1, 2]);
      expect(result?.activeRenderVersionId).toBe(versions[1].id);
      expect(result?.renderVersionImages?.[versions[0].id]).toMatch(/^blob:/);
      expect(result?.renderVersionImages?.[versions[1].id]).toMatch(/^blob:/);
      expect(exec.mock.calls.filter(([url]) =>
        String(url).includes('/api/projects/render-versions/asset?'),
      )).toHaveLength(2);
    });

    it('shares only the explicitly active version using a version-specific hosted path', async () => {
      getUser.mockResolvedValue({ uuid: 'owner-1' });
      getOrCreateHostingConfig.mockResolvedValue({ subdomain: 'archvision' });
      const activeVersionId = '123e4567-e89b-12d3-a456-426614174002';
      const privateProject = {
        id: 'share-project',
        ownerId: 'owner-1',
        sourceImage: 'blob:source',
        renderedImage: 'blob:active-render',
        activeRenderVersionId: activeVersionId,
        renderVersions: [{
          id: activeVersionId,
          projectId: 'share-project',
          versionNumber: 2,
          imageAssetReference: 'blob:active-render',
          generationMode: 'baseline',
          modelIdentifier: 'gemini-3.1-flash-image-preview',
          promptTemplateVersion: 'archvision-baseline-v1',
          configurationSnapshot: null,
          approvedAnalysisRevision: null,
          createdAt: '2026-10-20T12:00:00.000Z',
          generationStatus: 'complete',
        }],
      };
      uploadImageToHosting.mockImplementation(async (params: {
        projectId: string;
        label: 'source' | 'rendered';
        assetSuffix?: string;
      }) => {
        const fileName = params.assetSuffix
          ? `rendered-${params.assetSuffix}.png`
          : `${params.label}.png`;
        return {
          url: `https://archvision.puter.site/projects/${params.projectId}/${fileName}`,
          path: `projects/${params.projectId}/${fileName}`,
        };
      });
      exec.mockImplementation(async (url: string, options?: RequestInit) => {
        if (url.includes('/api/projects/get?')) {
          return new Response(JSON.stringify({ project: privateProject }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/projects/share')) {
          const requestBody = JSON.parse(options?.body as string);
          return new Response(JSON.stringify({
            project: {
              ...privateProject,
              ...requestBody.publicAssets,
              isPublic: true,
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        throw new Error(`Unexpected Worker request: ${url}`);
      });

      await shareProject(privateProject.id);

      const uploadCalls = uploadImageToHosting.mock.calls.map(([params]) => params);
      expect(uploadCalls).toContainEqual(expect.objectContaining({
        label: 'rendered',
        assetSuffix: activeVersionId,
      }));
      const shareRequest = JSON.parse(exec.mock.calls.find(([url]) =>
        String(url).includes('/api/projects/share'),
      )?.[1]?.body as string);
      expect(shareRequest.renderVersionId).toBe(activeVersionId);
      expect(shareRequest.publicAssets.renderVersionId).toBe(activeVersionId);
      expect(shareRequest.publicAssetPaths).toContain(
        `projects/share-project/rendered-${activeVersionId}.png`,
      );
    });
  it('returns no project for an anonymous private-project 404 without retrying the worker', async () => {
    const projectId = 'private-project';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getProjectById({ id: projectId });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(exec).not.toHaveBeenCalled();
  });

  it('stores private project images through the Worker and resolves them through its authenticated route', async () => {
    const file = new File(['floor plan'], 'plan.png', { type: 'image/png' });
    const privateAsset = 'archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png';
    exec.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/api/projects/private-asset')) {
        expect(options?.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({ asset: privateAsset }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/projects/save')) {
        const body = JSON.parse(options?.body as string);
        expect(body.visibility).toBe('private');
        expect(body.project.sourceImage).toBe(privateAsset);
        return new Response(JSON.stringify({ project: body.project }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/projects/private-asset?id=')) {
        return new Response(new Blob(['private image'], { type: 'image/png' }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected Worker request: ${url}`);
    });

    const result = await createProject({
      item: {
        id: 'private-project',
        sourceImage: URL.createObjectURL(file),
        sourceFile: file,
        timestamp: Date.now(),
      },
    });

    expect(result?.sourceImage).toMatch(/^blob:/);
    expect(uploadFileToHosting).not.toHaveBeenCalled();
    expect(uploadImageToHosting).not.toHaveBeenCalled();
    expect(getOrCreateHostingConfig).not.toHaveBeenCalled();
  });

  it('sends generation authorization to the Worker and returns the quota', async () => {
    exec.mockResolvedValue(new Response(JSON.stringify({
      authorized: true,
      limit: 20,
      remaining: 19,
      generationMode: 'baseline',
      generationTimestamp: '2026-10-20T00:00:00.000Z',
      approvedAnalysisRevision: null,
      versionId: '123e4567-e89b-12d3-a456-426614174000',
      versionNumber: 2,
      traceabilityAnalysisRevision: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(authorizeProjectGeneration('plan-1')).resolves.toEqual({
      limit: 20,
      remaining: 19,
      generationMode: 'baseline',
      generationTimestamp: '2026-10-20T00:00:00.000Z',
      approvedAnalysisRevision: null,
      versionId: '123e4567-e89b-12d3-a456-426614174000',
      versionNumber: 2,
      traceabilityAnalysisRevision: null,
    });
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/generation/authorize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
    );
  });

  it('validates and returns the Worker-approved Enhanced input snapshot', async () => {
    const configuration = createDefaultRenderConfiguration('2026-10-20T00:00:00.000Z');
    exec.mockResolvedValue(new Response(JSON.stringify({
      authorized: true,
      limit: 20,
      remaining: 18,
      generationMode: 'enhanced',
      generationTimestamp: '2026-10-20T00:00:00.000Z',
      approvedAnalysisRevision: 3,
      versionId: '123e4567-e89b-12d3-a456-426614174000',
      versionNumber: 1,
      traceabilityAnalysisRevision: 3,
      traceabilityAnalysis: approvedAnalysis,
      traceabilityConfiguration: configuration,
      analysis: approvedAnalysis,
      configuration,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(authorizeProjectGeneration('plan-1', 'enhanced')).resolves.toMatchObject({
      generationMode: 'enhanced',
      approvedAnalysisRevision: 3,
      versionNumber: 1,
      analysis: approvedAnalysis,
      configuration,
      traceabilityAnalysis: approvedAnalysis,
      traceabilityConfiguration: configuration,
    });
    expect(JSON.parse(exec.mock.calls[0][1].body as string)).toEqual({
      id: 'plan-1',
      generationMode: 'enhanced',
    });
  });

  it('reports failures through the authorized Worker endpoint', async () => {
    exec.mockResolvedValue(new Response(JSON.stringify({ failed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(markProjectGenerationFailed(
      'plan-1',
      '2026-10-20T00:00:00.000Z',
    )).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/generation/fail'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'plan-1',
          generationTimestamp: '2026-10-20T00:00:00.000Z',
        }),
      }),
    );
  });

  it('surfaces the Worker quota error to the caller', async () => {
    exec.mockResolvedValue(new Response(JSON.stringify({
      error: 'Daily AI generation limit reached. Try again after 00:00 UTC.',
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(authorizeProjectGeneration('plan-1')).rejects.toThrow(
      'Daily AI generation limit reached. Try again after 00:00 UTC.',
    );
  });

  it('authorizes analysis and returns the current AI quota', async () => {
    exec.mockResolvedValue(new Response(JSON.stringify({
      authorized: true,
      limit: 20,
      remaining: 18,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(authorizeFloorPlanAnalysis('plan-1')).resolves.toEqual({
      limit: 20,
      remaining: 18,
    });
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/floor-plan-analysis/authorize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
      }),
    );
  });

  it('saves and validates an approved interpretation through the Worker', async () => {
    exec.mockResolvedValue(new Response(JSON.stringify({
      analysis: approvedAnalysis,
      approvedAnalysisRevision: 1,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(saveFloorPlanAnalysis('plan-1', approvedAnalysis)).resolves.toEqual(
      { analysis: approvedAnalysis, approvedAnalysisRevision: 1 },
    );
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/floor-plan-analysis/save'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', analysis: approvedAnalysis }),
      }),
    );
  });

  it('saves validated render settings through the project Worker without invoking AI', async () => {
    const configuration: RenderConfiguration = {
      ...createDefaultRenderConfiguration('2026-10-20T00:00:00.000Z'),
      architecturalStyle: 'Scandinavian',
      colorPalette: 'Natural',
      furnitureStyle: 'Scandinavian',
    };
    exec.mockResolvedValue(new Response(JSON.stringify({ configuration }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(saveRenderConfiguration('plan-1', configuration)).resolves.toEqual(
      configuration,
    );
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/render-configuration/save'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1', configuration }),
      }),
    );
  });

  it('rejects invalid client configuration before calling the Worker', async () => {
    const invalid = JSON.parse(JSON.stringify({
      ...createDefaultRenderConfiguration(),
      flooringMaterial: 'Carpet',
    }));

    await expect(saveRenderConfiguration('plan-1', invalid)).rejects.toThrow(
      'Design settings are invalid',
    );
    expect(exec).not.toHaveBeenCalled();
  });
});
