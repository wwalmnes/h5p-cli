import { installCore } from '../logic/install.ts';
import type { CoreRepo } from '../lib/h5p-utils.ts';

export type ICoreAdapter = {
  installCore(items: CoreRepo[], latest?: boolean, concurrency?: number): Promise<string[]>;
};

export class CoreAdapter implements ICoreAdapter {
  installCore(items: CoreRepo[], latest?: boolean, concurrency?: number): Promise<string[]> {
    return installCore(items, latest, concurrency);
  }
}
