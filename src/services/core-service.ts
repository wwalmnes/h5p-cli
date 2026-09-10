import type { ICoreAdapter } from '../adapters/core-adapter.ts';
import type { CoreLibrary } from '../config.ts';
import type { Logger } from '../lib/repo-types.ts';
import { uiLogger } from '../lib/ui-logger.ts';

export class CoreService {
  private adapter: ICoreAdapter;
  private coreToClone: string[];
  private coreToSetup: CoreLibrary[];
  private logger: Logger;

  constructor(
    adapter: ICoreAdapter,
    coreToClone: string[],
    coreToSetup: CoreLibrary[],
    logger: Logger = uiLogger
  ) {
    this.adapter = adapter;
    this.coreToClone = coreToClone;
    this.coreToSetup = coreToSetup;
    this.logger = logger;
  }

  /* Everything h5p core installs, in one pool.

  This used to be two sequential phases - clone the PHP core, then resolve and
  install h5p-math-display's dependency graph - so the library could not start
  cloning until both PHP repositories had finished. That is where the time went:
  the phases are roughly 5s and 8.5s, and the second one is dominated by
  MathDisplay's own npm install and webpack build, not by anything the resolver
  was doing. Fetching all three at once bounds the command by its slowest single
  item instead of the sum.

  Nothing here has dependencies to resolve. The PHP core is not an H5P library,
  and MathDisplay declares none and ships no semantics.json - so this no longer
  touches SetupService, the registry or the metadata transport at all. */
  async core(concurrency?: number): Promise<void> {
    await this.adapter.installCore([
      ...this.coreToClone.map((repo) => ({ org: 'h5p', repo, target: repo })),
      ...this.coreToSetup.map(({ repo, machineName }) => ({ org: 'h5p', repo, machineName })),
    ], true, concurrency);
    this.logger.log('> done setting up core libraries');
  }
}
