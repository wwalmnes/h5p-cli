import { ISetupAdapter } from '../adapters/setup-adapter';
import { RegisterService } from './register-service';

export class SetupService {
  constructor(
    private setupAdapter: ISetupAdapter,
    private registerService: RegisterService,
    private librariesFolder: string,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async setup(library: string, version?: string, download?: string): Promise<void> {
    const isUrl = ['http', 'git@'].includes(library.slice(0, 4));
    const missingOptionals: Record<string, any> = {};

    if (isUrl) {
      const entry = await this.registerService.register(library);
      library = this.setupAdapter.machineToShort(Object.keys(entry)[0]);
    }

    let toSkip: string[] = [];
    const action = parseInt(download ?? '0') ? 'download' : 'clone';
    const latest = version ? false : true;

    let result = await this.setupAdapter.computeDependencies(library, 'view', version);
    for (const item in result) {
      if (!result[item].id) {
        this.handleMissingOptionals(missingOptionals, result, item);
      } else {
        toSkip = await this.setupAdapter.getWithDependencies(action, item, 'edit', latest, toSkip);
      }
    }

    result = await this.setupAdapter.computeDependencies(library, 'edit', version);
    for (const item in result) {
      if (!result[item].id) {
        this.handleMissingOptionals(missingOptionals, result, item);
      }
    }

    toSkip = [];
    this.logger.log(`> ${action} ${library} library "view" dependencies into "${this.librariesFolder}" folder`);
    toSkip = await this.setupAdapter.getWithDependencies(action, library, 'view', latest, toSkip);
    this.logger.log(`> ${action} ${library} library "edit" dependencies into "${this.librariesFolder}" folder`);
    toSkip = await this.setupAdapter.getWithDependencies(action, library, 'edit', latest, toSkip);

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
