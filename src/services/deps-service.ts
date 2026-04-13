import type { IDepsAdapter } from '../adapters/deps-adapter.ts';

export class DepsService {
  private adapter: IDepsAdapter;
  private logger: { log: (...args: any[]) => void };

  constructor(adapter: IDepsAdapter, logger: { log: (...args: any[]) => void } = console) {
    this.adapter = adapter;
    this.logger = logger;
  }

  async deps(library: string, mode?: 'view' | 'edit', version?: string, folder?: string): Promise<void> {
    const result = await this.adapter.computeDependencies(library, mode, version, folder);
    for (const item in result) {
      if (result[item].id) {
        this.logger.log(item);
      } else {
        this.logger.log(`!!! unregistered ${result[item].optional ? 'optional' : 'required'} ${item} library`);
      }
    }
  }
}
