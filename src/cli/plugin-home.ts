import os from 'os';
import path from 'path';

/* Where installed plugins live: h5p.plugins.json, and the plugins/ folder that git
installs are cloned into. Per user rather than inside the CLI's own folder, because a
global npm install replaces that folder wholesale on every update, and may be owned by
root. Outside node_modules, too, which is the one place Node refuses to strip types,
so a plugin cloned here can stay TypeScript. H5P_CLI_HOME moves it, e.g. for tests. */
export const pluginHome = (): string =>
  process.env.H5P_CLI_HOME || path.join(os.homedir(), '.h5p-cli');
