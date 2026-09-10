import logic from '../../logic.ts';
import type { Registry } from '../lib/library-types.ts';

export interface IMissingAdapter {
  parseLibraryFolders(): Promise<Record<string, any>>;
  getRegistry(): Promise<Registry>;
  computeDependencies(library: string, mode: 'view' | 'edit', version: string | null, folder?: string): Promise<Record<string, any>>;
}

export class MissingAdapter implements IMissingAdapter {
  parseLibraryFolders(): Promise<Record<string, any>> {
    return logic.parseLibraryFolders();
  }

  getRegistry(): Promise<Registry> {
    return logic.getRegistry();
  }

  computeDependencies(library: string, mode: 'view' | 'edit', version: string | null, folder?: string): Promise<Record<string, any>> {
    return logic.computeDependencies(library, mode, version, folder);
  }
}
