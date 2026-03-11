import { ITagsAdapter } from '../adapters/tags-adapter';

export class TagsService {
  constructor(
    private adapter: ITagsAdapter,
    private logger: { log: (...args: any[]) => void } = console
  ) {}

  tags(org: string, library: string, mainBranch: string): void {
    this.logger.log('> fetching h5p library tags');
    const result = this.adapter.tags(org, library, mainBranch);
    this.logger.log(result);
  }
}
