import logic from '../../logic.ts';

export interface IListAdapter {
  getRegistry(ignoreFile?: boolean): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }>;
}

export class ListAdapter implements IListAdapter {
  getRegistry(ignoreFile?: boolean): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }> {
    return logic.getRegistry(ignoreFile);
  }
}
