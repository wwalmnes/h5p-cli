import logic from '../../logic.ts';

export interface IDepsAdapter {
  computeDependencies(library: string, mode?: 'view' | 'edit', version?: string, folder?: string): Promise<Record<string, any>>;
}

export class DepsAdapter implements IDepsAdapter {
  computeDependencies(library: string, mode?: 'view' | 'edit', version?: string, folder?: string): Promise<Record<string, any>> {
    return logic.computeDependencies(library, mode, version, folder);
  }
}
