import fs from 'fs';
import { createRequire } from 'module';
import defaultConfig from './src/config.ts';

const require = createRequire(import.meta.url);
const userConfigFile = `${process.cwd()}/config.js`;
const config: any = fs.existsSync(userConfigFile) ? require(userConfigFile) : defaultConfig;
export default config;
