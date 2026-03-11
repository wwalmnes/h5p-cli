import { ICoreAdapter } from '../adapters/core-adapter';
import { SetupService } from './setup-service';

export class CoreService {
  constructor(
    private adapter: ICoreAdapter,
    private setupService: SetupService,
    private coreToClone: string[],
    private coreToSetup: string[],
    private librariesFolder: string,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async core(): Promise<void> {
    for (const item of this.coreToClone) {
      const folder = `${this.librariesFolder}/${item}`;
      if (this.adapter.existsSync(folder)) {
        this.logger.log(`>> ~ skipping ${item}; it already exists.`);
        continue;
      }
      this.logger.log(`>> + installing ${item}`);
      this.adapter.clone('h5p', item, 'master', item);
    }
    for (const item of this.coreToSetup) {
      await this.setupService.setup(item);
    }
    this.logger.log('> done setting up core libraries');
  }
}
