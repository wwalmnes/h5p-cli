import logic from '../../logic';

export interface IMissingAdapter {
  parseLibraryFolders(): Promise<Record<string, any>>;
  getRegistry(): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }>;
  computeDependencies(library: string, mode: string, version: null, folder?: string): Promise<Record<string, any>>;
}

export class MissingAdapter implements IMissingAdapter {
  parseLibraryFolders(): Promise<Record<string, any>> {
    return logic.parseLibraryFolders();
  }

  getRegistry(): Promise<{ regular: Record<string, any>; reversed: Record<string, any> }> {
    return logic.getRegistry();
  }

  computeDependencies(library: string, mode: string, version: null, folder?: string): Promise<Record<string, any>> {
    return logic.computeDependencies(library, mode, version, folder);
  }
}
