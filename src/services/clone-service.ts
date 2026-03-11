import { IInstallAdapter } from '../adapters/install-adapter';

export class CloneService {
  constructor(
    private adapter: IInstallAdapter,
    private librariesFolder: string,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async clone(library: string, mode?: string): Promise<void> {
    this.logger.log(`> cloning ${library} library and dependencies into "${this.librariesFolder}" folder`);
    await this.adapter.getWithDependencies('clone', library, mode);
    this.logger.log(`> done installing ${library}`);
  }
}
