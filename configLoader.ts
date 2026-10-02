import fs from 'fs';
import { createRequire } from 'module';
import defaultConfig from './src/config.ts';

const require = createRequire(import.meta.url);
const userConfigFile = `${process.cwd()}/config.js`;
const config: any = fs.existsSync(userConfigFile) ? require(userConfigFile) : defaultConfig;
// every git clone and ls-remote builds its URL from urls.library.clone when it runs
if (process.env.H5P_SSH_CLONE) {
  config.urls.library.clone = config.urls.library.sshClone;
}
export default config;
