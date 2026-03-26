import { Command } from 'commander';

// string keys: open to built-in overrides ('export', 'import', …)
// and custom plugin-defined adapters ('s3-storage', etc.)
export type AdapterOverrides = Record<string, new () => unknown>;

export interface H5PPlugin {
  name: string;
  commands?(): Command[];
  adapters?(): AdapterOverrides;
}
