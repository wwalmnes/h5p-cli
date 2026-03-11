import logic from '../../logic';

export interface IInstallAdapter {
  getWithDependencies(action: string, library: string, mode?: string, latest?: boolean, toSkip?: string[]): Promise<string[]>;
}

export class InstallAdapter implements IInstallAdapter {
  getWithDependencies(action: string, library: string, mode?: string, latest?: boolean, toSkip?: string[]): Promise<string[]> {
    return logic.getWithDependencies(action, library, mode, latest, toSkip);
  }
}
