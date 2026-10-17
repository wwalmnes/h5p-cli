import * as fs from 'fs';
import config from '../config/loader.ts';

export function setupFolders(): void {
  const list = ['content', config.folders.temp, config.folders.libraries, 'uploads'];
  for (const item of list) {
    if (!fs.existsSync(item)) {
      fs.mkdirSync(item);
    }
  }
}
