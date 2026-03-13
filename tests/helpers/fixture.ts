import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

tmp.setGracefulCleanup();

export interface Fixture {
  dir: string;
  cleanup: () => void;
}

/** Empty project — no subdirectories. */
export function createEmptyProject(): Fixture {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  return { dir: tmpDir.name, cleanup: tmpDir.removeCallback };
}

/** Project with `libraries/<name>` already present for each entry in `libraries`. */
export function createSeededProject(libraries: string[]): Fixture {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  fs.mkdirSync(path.join(tmpDir.name, 'libraries'), { recursive: true });
  for (const lib of libraries) {
    fs.mkdirSync(path.join(tmpDir.name, 'libraries', lib), { recursive: true });
  }
  return { dir: tmpDir.name, cleanup: tmpDir.removeCallback };
}
