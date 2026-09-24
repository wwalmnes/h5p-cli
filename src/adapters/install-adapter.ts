import { getWithDependencies } from '../logic/install.ts';

export interface IInstallAdapter {
  getWithDependencies(action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip?: string[]): Promise<string[]>;
}

export class InstallAdapter implements IInstallAdapter {
  getWithDependencies(action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip?: string[]): Promise<string[]> {
    return getWithDependencies(action, library, mode, latest ?? false, toSkip);
  }
}
