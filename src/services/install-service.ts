import { IInstallAdapter } from '../adapters/install-adapter';

export class InstallService {
  constructor(
    private adapter: IInstallAdapter,
    private librariesFolder: string,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async install(library: string, mode?: 'view' | 'edit'): Promise<void> {
    this.logger.log(`> downloading ${library} library and dependencies into "${this.librariesFolder}" folder`);
    await this.adapter.getWithDependencies('download', library, mode);
    this.logger.log(`> done installing ${library}`);
  }
}
