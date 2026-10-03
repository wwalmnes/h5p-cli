import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { _exec } from '../h5p/exec.ts';
import { pluginHome } from './plugin-home.ts';
import { resolvePluginEntry, sharePeerDependencies } from './plugin-loader.ts';
import { ui } from '../ui/ui.ts';

export type PluginEntry = {
  name: string;
  path: string;
};

export type PluginsConfig = {
  plugins: PluginEntry[];
};

const configPath = (): string => path.join(pluginHome(), 'h5p.plugins.json');
const pluginsDir = (): string => path.join(pluginHome(), 'plugins');

function readConfig(): PluginsConfig {
  if (!fs.existsSync(configPath())) return { plugins: [] };
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
  } catch {
    return { plugins: [] };
  }
}

function writeConfig(config: PluginsConfig): void {
  fs.mkdirSync(pluginHome(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

function isGitUrl(input: string): boolean {
  return input.startsWith('https://') || input.startsWith('git@');
}

function repoNameFromUrl(url: string): string {
  // handles both https://.../repo.git and git@github.com:user/repo.git
  const last = url.split(/[/:]/).pop() ?? 'plugin';
  return last.replace(/\.git$/, '');
}

/* A cloned plugin has no node_modules, and outside the CLI's folder it cannot borrow
the CLI's. Peers are the host's to provide, and the loader resolves h5p-cli and
commander to the CLI's own copies (see sharePeerDependencies). --legacy-peer-deps,
not --omit=peer: omit leaves the peer packages out but still installs their
dependency trees, which for h5p-cli is the whole CLI's. */
async function installDependencies(absPath: string): Promise<void> {
  const pkgPath = path.join(absPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!Object.keys(pkg.dependencies ?? {}).length) return;
  await _exec('npm install --omit=dev --legacy-peer-deps --no-audit --no-fund', absPath);
}

async function loadPluginName(absPath: string): Promise<string | undefined> {
  try {
    const entry = resolvePluginEntry(absPath);
    if (!entry) return undefined;
    // the plugin's own imports of h5p-cli/commander must resolve here as at load time
    sharePeerDependencies();
    const mod = await import(pathToFileURL(entry).href);
    return (mod.default ?? mod)?.name;
  } catch {
    return undefined;
  }
}

export async function installPlugin(source: string): Promise<void> {
  let absPath: string;

  if (isGitUrl(source)) {
    const repoName = repoNameFromUrl(source);
    absPath = path.join(pluginsDir(), repoName);

    if (fs.existsSync(absPath)) {
      ui.info(`"${repoName}" already exists at ${absPath}`);
    } else {
      fs.mkdirSync(pluginsDir(), { recursive: true });
      ui.info(`cloning ${source}`);
      execSync(`git clone ${source} ${absPath}`, { stdio: 'inherit' });
      ui.info(`installing dependencies for ${repoName}`);
      await installDependencies(absPath);
    }
  } else {
    absPath = path.resolve(source);
    if (!fs.existsSync(absPath)) {
      ui.info(`path not found: ${absPath}`);
      return;
    }
  }

  const pluginName = await loadPluginName(absPath);
  if (!pluginName) {
    ui.info(`plugin at "${absPath}" does not export a name`);
    return;
  }

  const config = readConfig();
  if (config.plugins.some(p => p.path === absPath)) {
    ui.info(`"${pluginName}" already listed in h5p.plugins.json`);
    return;
  }
  config.plugins.push({ name: pluginName, path: absPath });
  writeConfig(config);
  ui.info(`added "${pluginName}" to h5p.plugins.json`);
}

export function uninstallPlugin(name: string): void {
  const config = readConfig();
  const matching = config.plugins.filter(p => p.name === name);

  if (matching.length === 0) {
    ui.info(`no plugin named "${name}" found`);
    return;
  }

  for (const entry of matching) {
    config.plugins = config.plugins.filter(p => p.path !== entry.path);

    if (entry.path.startsWith(pluginsDir() + path.sep)) {
      fs.rmSync(entry.path, { recursive: true, force: true });
      ui.info(`deleted ${entry.path}`);
    }

    ui.info(`removed "${name}" from h5p.plugins.json`);
  }

  writeConfig(config);
}

export function listPlugins(): PluginEntry[] {
  return readConfig().plugins;
}
