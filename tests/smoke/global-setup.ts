import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const H5P_CLI = path.resolve('./h5p.js');
const SMOKE_DIR = path.join(os.tmpdir(), 'h5p-cli-smoke');

export default async function globalSetup() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });

  const coreLib = path.join(SMOKE_DIR, 'libraries', 'h5p-editor-php-library');
  if (!fs.existsSync(coreLib)) {
    console.log('[smoke] Running h5p core in', SMOKE_DIR, '(one-time setup)...');
    execSync(`node "${H5P_CLI}" core`, { cwd: SMOKE_DIR, stdio: 'inherit' });
  }
}
