import path from 'path';
import type { IPluginAdapter, PluginEntry } from '../adapters/plugin-adapter.ts';

function isGitUrl(input: string): boolean {
  return input.startsWith('https://') || input.startsWith('git@');
}

function repoNameFromUrl(url: string): string {
  // handles both https://.../repo.git and git@github.com:user/repo.git
  const last = url.split(/[/:]/).pop() ?? 'plugin';
  return last.replace(/\.git$/, '');
}

export class PluginService {
  private adapter: IPluginAdapter;
  private pluginsDir: string;
  private logger: { log: (...args: any[]) => void };

  constructor(adapter: IPluginAdapter, pluginsDir: string, logger: { log: (...args: any[]) => void } = console) {
    this.adapter = adapter;
    this.pluginsDir = pluginsDir;
    this.logger = logger;
  }

  async install(source: string): Promise<void> {
    let absPath: string;

    if (isGitUrl(source)) {
      const repoName = repoNameFromUrl(source);
      absPath = path.join(this.pluginsDir, repoName);

      if (this.adapter.pathExists(absPath)) {
        this.logger.log(`> "${repoName}" already exists at ${absPath}`);
      } else {
        this.adapter.mkdirRecursive(this.pluginsDir);
        this.logger.log(`> cloning ${source}`);
        this.adapter.cloneRepo(source, absPath);
      }
    } else {
      absPath = path.resolve(source);
      if (!this.adapter.pathExists(absPath)) {
        this.logger.log(`> path not found: ${absPath}`);
        return;
      }
    }

    const pluginName = await this.adapter.loadPluginName(absPath);
    if (!pluginName) {
      this.logger.log(`> plugin at "${absPath}" does not export a name`);
      return;
    }

    this.adapter.ensureGitignored();

    const config = this.adapter.readConfig();
    if (config.plugins.some(p => p.path === absPath)) {
      this.logger.log(`> "${pluginName}" already listed in h5p.plugins.json`);
      return;
    }
    config.plugins.push({ name: pluginName, path: absPath });
    this.adapter.writeConfig(config);
    this.logger.log(`> added "${pluginName}" to h5p.plugins.json`);
  }

  uninstall(name: string): void {
    const config = this.adapter.readConfig();
    const matching = config.plugins.filter(p => p.name === name);

    if (matching.length === 0) {
      this.logger.log(`> no plugin named "${name}" found`);
      return;
    }

    for (const entry of matching) {
      config.plugins = config.plugins.filter(p => p.path !== entry.path);

      if (entry.path.startsWith(this.pluginsDir + path.sep)) {
        this.adapter.rmRecursive(entry.path);
        this.logger.log(`> deleted ${entry.path}`);
      }

      this.logger.log(`> removed "${name}" from h5p.plugins.json`);
    }

    this.adapter.writeConfig(config);
  }

  list(): PluginEntry[] {
    return this.adapter.readConfig().plugins;
  }
}
