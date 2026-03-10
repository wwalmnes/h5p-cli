import fs from 'fs';
const userConfigFile = `${process.cwd()}/config.js`;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config: any = fs.existsSync(userConfigFile) ? require(userConfigFile) : require('./config.js');
export default config;
