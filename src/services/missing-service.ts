import type { IMissingAdapter } from '../adapters/missing-adapter.ts';
import type { Logger } from '../lib/repo-types.ts';
import { uiLogger } from '../lib/ui-logger.ts';

export class MissingService {
  private adapter: IMissingAdapter;
  private logger: Logger;

  constructor(adapter: IMissingAdapter, logger: Logger = uiLogger) {
    this.adapter = adapter;
    this.logger = logger;
  }

  async missing(library: string): Promise<void> {
    const libraryDirs = await this.adapter.parseLibraryFolders();
    const registry = await this.adapter.getRegistry();
    const folder = libraryDirs[registry.regular[library]?.id];
    const result = await this.adapter.computeDependencies(library, 'edit', null, folder);

    // entries without an id are the ones the registry does not know about
    const missing: Record<string, boolean> = {};
    for (const item in result) {
      if (result[item].id) {
        continue;
      }
      missing[item] = result[item].optional ?? false;
    }

    if (!Object.keys(missing).length) {
      this.logger.log(`> ${library} has no unregistered dependencies`);
      return;
    }

    this.logger.log(`> unregistered dependencies for ${library}`);
    for (const item in missing) {
      this.logger.log(`${item} (${missing[item] ? 'optional' : 'required'})`);
    }
  }
}
