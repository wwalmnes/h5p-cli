import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

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
  ensureGitignored(): void;
  loadPluginName(absPath: string): Promise<string | undefined>;
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

  ensureGitignored(): void {
    const gitignorePath = path.join(this.root, '.gitignore');
    const entries = ['plugins/', 'h5p.plugins.json'];
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    let changed = false;
    for (const entry of entries) {
      if (!content.split('\n').some(line => line.trim() === entry)) {
        content += (content.endsWith('\n') ? '' : '\n') + entry + '\n';
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(gitignorePath, content);
  }

  async loadPluginName(absPath: string): Promise<string | undefined> {
    try {
      const mod = await import(pathToFileURL(absPath).href);
      return (mod.default ?? mod)?.name;
    } catch {
      return undefined;
    }
  }
}
