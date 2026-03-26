import { AdapterOverrides } from './plugin-types';

const overrides: Record<string, new () => unknown> = {};

export const adapterRegistry = {
  register(pluginAdapters: AdapterOverrides): void {
    Object.assign(overrides, pluginAdapters);
  },

  resolve<T>(key: string): T | undefined {
    const Ctor = overrides[key];
    return Ctor ? new (Ctor as any)() as T : undefined;
  },

  /** For testing only — resets all registered overrides */
  _reset(): void {
    for (const key of Object.keys(overrides)) {
      delete overrides[key];
    }
  },
};
