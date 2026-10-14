import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  exec,
  getOrCreateHostingConfig,
  uploadFileToHosting,
  uploadImageToHosting,
  deleteHostedAsset,
} = vi.hoisted(() => ({
  exec: vi.fn(),
  getOrCreateHostingConfig: vi.fn(),
  uploadFileToHosting: vi.fn(),
  uploadImageToHosting: vi.fn(),
  deleteHostedAsset: vi.fn(),
}));

vi.mock('@heyputer/puter.js', () => ({
  default: {
    workers: { exec },
  },
}));

vi.mock('../lib/puter.hosting', () => ({
  deleteHostedAsset,
  getOrCreateHostingConfig,
  uploadFileToHosting,
  uploadImageToHosting,
}));

import { authorizeProjectGeneration, createProject, getProjectById } from '../lib/puter.action';

describe('public project retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('falls back to authenticated retrieval when the project is not public', async () => {
    const project = {
      id: 'private-project',
      sourceImage: 'https://example.com/source.png',
      isPublic: false,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    exec.mockResolvedValue(
      new Response(JSON.stringify({ project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getProjectById({ id: project.id });

    expect(result).toEqual(project);
    expect(exec).toHaveBeenCalledOnce();
  });

  it('falls back to authenticated retrieval if anonymous fetching fails', async () => {
    const project = {
      id: 'private-project',
      sourceImage: 'https://example.com/source.png',
      isPublic: false,
    };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    exec.mockResolvedValue(
      new Response(JSON.stringify({ project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getProjectById({ id: project.id });

    expect(result).toEqual(project);
    expect(exec).toHaveBeenCalledOnce();
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
      limit: 10,
      remaining: 9,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(authorizeProjectGeneration('plan-1')).resolves.toEqual({
      limit: 10,
      remaining: 9,
    });
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/generation/authorize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'plan-1' }),
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
});
