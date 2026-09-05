import type { ISetupAdapter } from '../adapters/setup-adapter.ts';
import { RegisterService } from './register-service.ts';
import type { Logger } from '../lib/repo-types.ts';
import { uiLogger } from '../lib/ui-logger.ts';

export class SetupService {
  private setupAdapter: ISetupAdapter;
  private registerService: RegisterService;
  private librariesFolder: string;
  private logger: Logger;

  constructor(
    setupAdapter: ISetupAdapter,
    registerService: RegisterService,
    librariesFolder: string,
    logger: Logger = uiLogger
  ) {
    this.setupAdapter = setupAdapter;
    this.registerService = registerService;
    this.librariesFolder = librariesFolder;
    this.logger = logger;
  }

  /* Resolve once, install once.

  This used to run one full resolution for the view graph, then another per
  dependency in it, then a third for the edit graph purely to collect warnings,
  then reset `toSkip` and do the view and edit graphs over again — about N+4
  traversals of the same graph, roughly 61 of them for h5p-interactive-book.

  One 'edit' resolution replaces all of it. `mode` is applied at every node, not
  only at the root, so an edit resolution follows preloadedDependencies, the
  libraries named in semantics.json, *and* editorDependencies the whole way
  down. View edges are a subset of edit edges from the same root, so the edit
  graph already contains everything the view pass found and everything the
  per-dependency edit passes were reaching one traversal at a time. */
  async setup(library: string, version?: string, download?: string, concurrency?: number): Promise<void> {
    const isUrl = ['http', 'git@'].includes(library.slice(0, 4));
    const missingOptionals: Record<string, any> = {};

    if (isUrl) {
      const entry = await this.registerService.register(library);
      library = this.setupAdapter.machineToShort(Object.keys(entry)[0]);
    }

    const action = parseInt(download ?? '0') ? 'download' : 'clone';
    const latest = version ? false : true;

    const result = await this.setupAdapter.computeDependencies(library, 'edit', version);
    for (const item in result) {
      if (!result[item].id) {
        this.handleMissingOptionals(missingOptionals, result, item);
      }
    }

    this.logger.log(`> ${action} ${library} library dependencies into "${this.librariesFolder}" folder`);
    await this.setupAdapter.installDependencies(action, result, latest, [], concurrency);

    if (Object.keys(missingOptionals).length) {
      this.logger.log('!!! missing optional libraries');
      for (const item in missingOptionals) {
        this.logger.log(`${item} (${missingOptionals[item].optional ? 'optional' : 'required'}) required by ${missingOptionals[item].parent}`);
      }
    }
    this.logger.log(`> done setting up ${library}`);
  }

  private handleMissingOptionals(missingOptionals: Record<string, any>, result: Record<string, any>, item: string): void {
    if (result[item].optional) {
      if (!missingOptionals[item]) {
        missingOptionals[item] = result[item];
      }
    } else {
      throw new Error(`unregistered ${item} library required by ${result[item].parent}`);
    }
  }
}
