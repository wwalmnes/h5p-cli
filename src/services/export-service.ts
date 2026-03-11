import { IExportAdapter } from '../adapters/export-adapter';

export class ExportService {
  constructor(
    private adapter: IExportAdapter,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async export(library: string, folder?: string): Promise<void> {
    const file = await this.adapter.export(library, folder);
    this.logger.log(file);
  }
}
