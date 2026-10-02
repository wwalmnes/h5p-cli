import { describe, it, expect, vi, afterEach } from 'vitest';

/* configLoader reads H5P_SSH_CLONE once, when it is first imported, so each case
re-imports it - and src/config.ts, whose default object the swap mutates. */
const loadConfig = async () => {
  vi.resetModules();
  return (await import('../../configLoader.ts')).default;
};

afterEach(() => {
  vi.unstubAllEnvs();
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
});
