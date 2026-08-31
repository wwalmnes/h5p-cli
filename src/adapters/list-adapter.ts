import logic from '../../logic.ts';
import type { Registry } from '../lib/library-types.ts';

export interface IListAdapter {
  getRegistry(ignoreFile?: boolean): Promise<Registry>;
}

export class ListAdapter implements IListAdapter {
  getRegistry(ignoreFile?: boolean): Promise<Registry> {
    return logic.getRegistry(ignoreFile);
  }
}
