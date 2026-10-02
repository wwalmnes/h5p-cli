import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { _exec } from '../logic/exec.ts';
import { sharePeerDependencies } from '../lib/plugin-loader.ts';

export interface PluginEntry {
  name: string;
  path: string;
}

export interface PluginsConfig {
  plugins: PluginEntry[];
}

export interface IPluginAdapter {
  readConfig(): PluginsConfig;
  writeConfig(config: PluginsConfig): void;
  cloneRepo(url: string, dest: string): void;
  pathExists(absPath: string): boolean;
  mkdirRecursive(dir: string): void;
  rmRecursive(absPath: string): void;
  installDependencies(absPath: string): Promise<void>;
  loadPluginName(absPath: string): Promise<string | undefined>;
}

function resolvePackageEntry(dir: string): string | undefined {
  const pkgPath = path.join(dir, 'package.json');
  let entry: string | undefined;
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const exp = pkg.exports?.['.'] ?? pkg.exports;
    if (typeof exp === 'string') entry = exp;
    else if (exp && typeof exp === 'object') entry = exp.import ?? exp.default ?? exp.node;
    entry = entry ?? pkg.main;
  }
  const candidates = entry ? [entry] : ['index.js', 'index.mjs', 'index.ts'];
  for (const c of candidates) {
    const full = path.join(dir, c);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

export class PluginAdapter implements IPluginAdapter {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  readConfig(): PluginsConfig {
    const filePath = path.join(this.root, 'h5p.plugins.json');
    if (!fs.existsSync(filePath)) return { plugins: [] };
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return { plugins: [] };
    }
  }

  writeConfig(config: PluginsConfig): void {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(path.join(this.root, 'h5p.plugins.json'), JSON.stringify(config, null, 2));
  }

  cloneRepo(url: string, dest: string): void {
    execSync(`git clone ${url} ${dest}`, { stdio: 'inherit' });
  }

  pathExists(absPath: string): boolean {
    return fs.existsSync(absPath);
  }

  mkdirRecursive(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }

  rmRecursive(absPath: string): void {
    fs.rmSync(absPath, { recursive: true, force: true });
  }

  /* A cloned plugin has no node_modules, and outside the CLI's folder it cannot borrow
  the CLI's. Peers are omitted: the loader resolves h5p-cli and commander to the CLI's
  own copies whatever is installed here (see sharePeerDependencies). */
  async installDependencies(absPath: string): Promise<void> {
    const pkgPath = path.join(absPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (!Object.keys(pkg.dependencies ?? {}).length) return;
    await _exec('npm install --omit=dev --omit=peer --no-audit --no-fund', absPath);
  }

  async loadPluginName(absPath: string): Promise<string | undefined> {
    try {
      const entry = fs.statSync(absPath).isDirectory() ? resolvePackageEntry(absPath) : absPath;
      if (!entry) return undefined;
      // the plugin's own imports of h5p-cli/commander must resolve here as at load time
      sharePeerDependencies();
      const mod = await import(pathToFileURL(entry).href);
      return (mod.default ?? mod)?.name;
    } catch {
      return undefined;
    }
  }
}
