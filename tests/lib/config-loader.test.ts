import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/* configLoader reads H5P_SSH_CLONE and the workspace config.js once, when it is first
imported, so each case re-imports it - and src/config.ts, whose default object it mutates. */
const loadConfig = async () => {
  vi.resetModules();
  return (await import('../../configLoader.ts')).default;
};

// a fresh folder per case: require caches config.js by path
const workspaceWith = (configJs: string): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5p-config-'));
  fs.writeFileSync(path.join(dir, 'config.js'), configJs);
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('configLoader', () => {
  it('clones over https by default', async () => {
    vi.stubEnv('H5P_SSH_CLONE', '');

    expect((await loadConfig()).urls.library.clone).toBe('https://github.com/{org}/{repo}.git');
  });

  it('clones over ssh when H5P_SSH_CLONE is set', async () => {
    vi.stubEnv('H5P_SSH_CLONE', '1');

    expect((await loadConfig()).urls.library.clone).toBe('git@github.com:{org}/{repo}.git');
  });

  it('merges a workspace config.js over the defaults', async () => {
    workspaceWith("module.exports = { port: 9090, folders: { libraries: 'libs' }, core: { clone: [] } };");

    const config = await loadConfig();

    expect(config.port).toBe(9090);
    expect(config.api).toBe('http://localhost:9090');
    expect(config.folders).toEqual({ assets: 'assets', libraries: 'libs', temp: 'temp' });
    expect(config.core.clone).toEqual([]);
    expect(config.core.setup).toHaveLength(1);
  });

  it('names config.js when it cannot be loaded', async () => {
    workspaceWith('const config = require(`${require.main.path}/config.js`);');

    await expect(loadConfig()).rejects.toThrow(/Could not load .*config\.js/);
  });
});
