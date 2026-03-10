import * as fs from 'fs';

export function setupFolders(): void {
  const list = ['content', 'temp', 'libraries', 'uploads'];
  for (const item of list) {
    if (!fs.existsSync(item)) {
      fs.mkdirSync(item);
    }
  }
}
