import type { IMissingAdapter } from '../adapters/missing-adapter.ts';

export class MissingService {
  private adapter: IMissingAdapter;
  private logger: { log: (...args: any[]) => void };

  constructor(adapter: IMissingAdapter, logger: { log: (...args: any[]) => void } = console) {
    this.adapter = adapter;
    this.logger = logger;
  }

  async missing(library: string): Promise<void> {
    const libraryDirs = await this.adapter.parseLibraryFolders();
    const registry = await this.adapter.getRegistry();
    const missing: Record<string, boolean> = {};

    const parseMissing = (result: any, item: string) => {
      if (!registry.regular[item] && (typeof missing[item] === 'undefined' || missing[item])) {
        missing[item] = result[item].optional;
      }
    };

    let result = await this.adapter.computeDependencies(library, 'view', null, libraryDirs[registry.regular[library].id]);
    for (const item in result) {
      parseMissing(result, item);
      if (registry.regular[item]) {
        const list = await this.adapter.computeDependencies(item, 'edit', null, libraryDirs[registry.regular[item].id]);
        for (const elem in list) {
          parseMissing(list, elem);
        }
      }
    }

    result = await this.adapter.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
    for (const item in result) {
      parseMissing(result, item);
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
