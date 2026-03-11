import { IListAdapter } from '../adapters/list-adapter';

export class ListService {
  constructor(
    private adapter: IListAdapter,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  async list(reversed?: number, ignoreFile?: number): Promise<void> {
    this.logger.log('> fetching h5p library registry');
    const result = await this.adapter.getRegistry(ignoreFile);
    for (const item in result.regular) {
      this.logger.log(`${reversed ? result.regular[item].id : item} (${result.regular[item].org})`);
    }
  }
}
