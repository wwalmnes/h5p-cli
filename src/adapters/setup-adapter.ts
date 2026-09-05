import logic from '../../logic.ts';
import { machineToShort } from '../lib/h5p-utils.ts';
import type { DependencyMap } from '../lib/compute-dependencies.ts';

export interface ISetupAdapter {
  machineToShort(machineName: string): string;
  computeDependencies(library: string, mode: 'view' | 'edit', version?: string): Promise<Record<string, any>>;
  getWithDependencies(action: 'clone' | 'download', library: string, mode: 'view' | 'edit', latest: boolean, toSkip: string[], concurrency?: number): Promise<string[]>;
  installDependencies(action: 'clone' | 'download', list: DependencyMap, latest: boolean, toSkip: string[], concurrency?: number): Promise<string[]>;
}

export class SetupAdapter implements ISetupAdapter {
  machineToShort(machineName: string): string {
    return machineToShort(machineName);
  }

  computeDependencies(library: string, mode: 'view' | 'edit', version?: string): Promise<Record<string, any>> {
    return logic.computeDependencies(library, mode, version);
  }

  getWithDependencies(action: 'clone' | 'download', library: string, mode: 'view' | 'edit', latest: boolean, toSkip: string[], concurrency?: number): Promise<string[]> {
    return logic.getWithDependencies(action, library, mode, latest, toSkip, concurrency);
  }

  installDependencies(action: 'clone' | 'download', list: DependencyMap, latest: boolean, toSkip: string[], concurrency?: number): Promise<string[]> {
    return logic.installDependencies(action, list, latest, toSkip, concurrency);
  }
}
