import logic from '../../logic';

export interface IListAdapter {
  getRegistry(ignoreFile?: number): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }>;
}

export class ListAdapter implements IListAdapter {
  getRegistry(ignoreFile?: number): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }> {
    return logic.getRegistry(ignoreFile);
  }
}
