import logic from '../../logic.ts';

export interface IInstallAdapter {
  getWithDependencies(action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip?: string[]): Promise<string[]>;
}

export class InstallAdapter implements IInstallAdapter {
  getWithDependencies(action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip?: string[]): Promise<string[]> {
    return logic.getWithDependencies(action, library, mode, latest ?? false, toSkip);
  }
}
