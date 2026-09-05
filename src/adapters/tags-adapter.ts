import logic from '../../logic.ts';

export interface ITagsAdapter {
  tags(org: string, library: string, mainBranch: string): any;
}

export class TagsAdapter implements ITagsAdapter {
  tags(org: string, library: string): any {
    return logic.tags(org, library);
  }
}
