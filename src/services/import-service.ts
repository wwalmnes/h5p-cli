import { IImportAdapter } from '../adapters/import-adapter';

export class ImportService {
  constructor(
    private adapter: IImportAdapter,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  import(folder: string, archive?: string): void {
    const output = this.adapter.import(folder, archive);
    this.logger.log(`content/${output}`);
  }
}
