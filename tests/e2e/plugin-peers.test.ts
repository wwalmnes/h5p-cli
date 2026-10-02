import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/* A plugin installed outside the CLI's folder - which is every plugin, now that they
live under the plugin home - has no node_modules of its own to find h5p-cli or
commander in. The loader's resolve hook must hand it the CLI's own copies, and the
same `ui` instance, so the global --quiet reaches the plugin's output too. Run in a
real process: module hooks act on Node's own loader, not on vitest's. */

const H5P = path.resolve(import.meta.dirname, '..', '..', 'h5p.js');

let root: string;
let plugin: string;

const run = (...args: string[]) => spawnSync(process.execPath, [H5P, ...args], {
  cwd: root,
  encoding: 'utf-8',
  env: { ...process.env, H5P_CLI_HOME: path.join(root, 'home'), H5P_QUIET: '', H5P_VERBOSE: '' },
});

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'h5p-plugin-peers-'));
  plugin = path.join(root, 'peer-plugin');
  fs.mkdirSync(plugin);
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ name: 'peer-plugin', type: 'module', main: 'index.ts' }));
  // TypeScript on purpose: outside node_modules, Node strips the types itself
  fs.writeFileSync(path.join(plugin, 'index.ts'), [
    "import { Command } from 'commander';",
    "import { ui } from 'h5p-cli/ui';",
    "const name: string = 'peer-plugin';",
    "export default { name, commands: () => [new Command('peer-check').action(() => {",
    "  ui.info('info from plugin');",
    "  ui.data('data from plugin');",
    "})] };",
  ].join('\n'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

// in order: the later tests run the plugin this one installs
describe('plugin peer dependencies', () => {
  /* Install imports the plugin to read its name, before any h5p.plugins.json exists
  to make the loader share the peers, so that import needs them shared as well. */
  it('installs the plugin into an empty plugin home', () => {
    const result = run('plugin', 'install', plugin);

    expect(result.stderr).toContain('added "peer-plugin"');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'home', 'h5p.plugins.json'), 'utf-8'));
    expect(config.plugins).toEqual([{ name: 'peer-plugin', path: plugin }]);
  });

  it('resolves h5p-cli and commander for a plugin that has no node_modules', () => {
    const result = run('peer-check');

    expect(result.stderr).not.toContain('Failed to load plugin');
    expect(result.stdout).toContain('data from plugin');
    expect(result.stderr).toContain('info from plugin');
    expect(result.status).toBe(0);
  });

  it('shares the CLI\'s ui, so --quiet silences the plugin too', () => {
    const result = run('--quiet', 'peer-check');

    expect(result.stdout).toContain('data from plugin');
    expect(result.stderr).not.toContain('info from plugin');
  });
});
