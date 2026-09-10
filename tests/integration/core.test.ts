import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CoreService } from '../../src/services/core-service.ts';
import type { ICoreAdapter } from '../../src/adapters/core-adapter.ts';
import type { CoreRepo } from '../../src/lib/h5p-utils.ts';
import { setupFolders } from '../../src/lib/setup-folders.ts';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

const CORE_TO_CLONE = ['h5p-editor-php-library', 'h5p-php-library'];
const CORE_TO_SETUP = [{ repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' }];
const LIBRARIES_FOLDER = 'libraries';

/* Stands in for logic.installCore, creating the folders a real fetch would.
The staging clone, the folder naming and the skip/refresh decision live in
logic.ts and are pinned in tests/logic/install-core.test.ts against real fs. */
function makeRealFsAdapter(baseDir: string): ICoreAdapter & { installCore: ReturnType<typeof vi.fn> } {
  return {
    installCore: vi.fn(async (items: CoreRepo[]) => items.map((item) => {
      const folder = item.target ?? `${item.machineName}-1.0`;
      fs.mkdirSync(path.join(baseDir, LIBRARIES_FOLDER, folder), { recursive: true });
      return folder;
    })),
  };
}

describe('CoreService integration — fresh project', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    fs.mkdirSync(path.join(fixture.dir, LIBRARIES_FOLDER), { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  it('installs the plain repos and the library in one pooled call', async () => {
    const adapter = makeRealFsAdapter(fixture.dir);
    const svc = new CoreService(adapter, CORE_TO_CLONE, CORE_TO_SETUP);
    await svc.core();

    for (const folder of [...CORE_TO_CLONE, 'H5P.MathDisplay-1.0']) {
      expect(fs.existsSync(path.join(fixture.dir, LIBRARIES_FOLDER, folder))).toBe(true);
    }
    expect(adapter.installCore).toHaveBeenCalledTimes(1);
  });

  it('all four project folders exist when setupFolders + core run together', async () => {
    setupFolders();
    const adapter = makeRealFsAdapter(fixture.dir);
    const svc = new CoreService(adapter, CORE_TO_CLONE, CORE_TO_SETUP);
    await svc.core();

    for (const dir of ['content', 'libraries', 'temp', 'uploads']) {
      expect(fs.existsSync(path.join(fixture.dir, dir))).toBe(true);
    }
  });
});
