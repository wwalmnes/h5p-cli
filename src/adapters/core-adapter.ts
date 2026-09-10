import logic from '../../logic.ts';
import type { CoreRepo } from '../lib/h5p-utils.ts';

export type ICoreAdapter = {
  installCore(items: CoreRepo[], latest?: boolean, concurrency?: number): Promise<string[]>;
};

export class CoreAdapter implements ICoreAdapter {
  installCore(items: CoreRepo[], latest?: boolean, concurrency?: number): Promise<string[]> {
    return logic.installCore(items, latest, concurrency);
  }
}
