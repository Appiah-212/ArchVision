import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, get, set } = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@heyputer/puter.js', () => ({
  default: {
    hosting: { create },
    kv: { get, set },
  },
}));

import { getOrCreateHostingConfig } from '../lib/puter.hosting';
import { HOSTING_CONFIG_KEY } from '../lib/utils';

describe('hosting configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves a newly created hosting configuration to KV', async () => {
    get.mockResolvedValue(null);
    create.mockResolvedValue({ subdomain: 'archvision-test' });
    set.mockResolvedValue(undefined);

    const config = await getOrCreateHostingConfig();

    expect(config).toEqual({ subdomain: 'archvision-test' });
    expect(create).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(HOSTING_CONFIG_KEY, config);
  });

  it('reuses an existing hosting configuration without creating another site', async () => {
    get.mockResolvedValue({ subdomain: 'archvision-existing' });

    const config = await getOrCreateHostingConfig();

    expect(config).toEqual({ subdomain: 'archvision-existing' });
    expect(create).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
