import fs from 'fs';
import defaultConfig from './config';

const userConfigFile = `${process.cwd()}/config.js`;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config: any = fs.existsSync(userConfigFile) ? require(userConfigFile) : defaultConfig;
export default config;
