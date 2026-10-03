import fs from 'fs';
import { createRequire } from 'module';
import defaultConfig from './defaults.ts';

const require = createRequire(import.meta.url);
const userConfigFile = `${process.cwd()}/config.js`;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === '[object Object]';

// objects merge key by key; anything else (arrays, RegExps, strings) replaces the default
const merge = (target: Record<string, any>, source: Record<string, any>): void => {
  for (const key of Object.keys(source)) {
    if (isPlainObject(target[key]) && isPlainObject(source[key])) {
      merge(target[key], source[key]);
    }
    else {
      target[key] = source[key];
    }
  }
};

/* A workspace config.js exports only the settings it changes. They are merged into the
defaults in place, so code that reads src/config/defaults.ts directly sees them too. */
const loadUserConfig = (): Record<string, any> => {
  try {
    const loaded = require(userConfigFile);
    return loaded?.default ?? loaded;
  }
  catch (error) {
    throw new Error(
      `Could not load ${userConfigFile}: ${(error as Error).message}\n` +
      'config.js exports only the settings it changes, e.g. module.exports = { port: 8081 };',
      { cause: error }
    );
  }
};

const config: any = defaultConfig;
if (fs.existsSync(userConfigFile)) {
  const userConfig = loadUserConfig();
  merge(config, userConfig);
  if (userConfig.port && !userConfig.api) {
    config.api = `http://localhost:${config.port}`;
  }
}
// every git clone and ls-remote builds its URL from urls.library.clone when it runs
if (process.env.H5P_SSH_CLONE) {
  config.urls.library.clone = config.urls.library.sshClone;
}
export default config;
