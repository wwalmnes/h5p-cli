import logic from '../../logic.ts';
import { machineToShort } from '../lib/h5p-utils.ts';

export interface ISetupAdapter {
  machineToShort(machineName: string): string;
  computeDependencies(library: string, mode: 'view' | 'edit', version?: string): Promise<Record<string, any>>;
  getWithDependencies(action: 'clone' | 'download', library: string, mode: 'view' | 'edit', latest: boolean, toSkip: string[]): Promise<string[]>;
}

export class SetupAdapter implements ISetupAdapter {
  machineToShort(machineName: string): string {
    return machineToShort(machineName);
  }

  computeDependencies(library: string, mode: 'view' | 'edit', version?: string): Promise<Record<string, any>> {
    return logic.computeDependencies(library, mode, version);
  }

  getWithDependencies(action: 'clone' | 'download', library: string, mode: 'view' | 'edit', latest: boolean, toSkip: string[]): Promise<string[]> {
    return logic.getWithDependencies(action, library, mode, latest, toSkip);
  }
}
