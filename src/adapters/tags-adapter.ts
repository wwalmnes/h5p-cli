import { tags } from '../logic/repo.ts';

export interface ITagsAdapter {
  tags(org: string, library: string): any;
}

export class TagsAdapter implements ITagsAdapter {
  tags(org: string, library: string): any {
    return tags(org, library);
  }
}
