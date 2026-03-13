import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CoreService } from '../../src/services/core-service';
import type { ICoreAdapter } from '../../src/adapters/core-adapter';
import { setupFolders } from '../../src/lib/setup-folders';
import { createEmptyProject, createSeededProject, type Fixture } from '../helpers/fixture';

const CORE_TO_CLONE = ['h5p-editor-php-library', 'h5p-php-library'];
const CORE_TO_SETUP = ['h5p-math-display'];
const LIBRARIES_FOLDER = 'libraries';

function makeSetupService() {
  return { setup: vi.fn().mockResolvedValue(undefined) } as any;
}

/** Adapter that uses real fs.existsSync but simulates clone by creating the directory. */
function makeRealFsAdapter(baseDir: string): ICoreAdapter & { clone: ReturnType<typeof vi.fn> } {
  const cloneFn = vi.fn((org: string, library: string, branch: string, target: string) => {
    fs.mkdirSync(path.join(baseDir, LIBRARIES_FOLDER, target), { recursive: true });
  });
  return {
    existsSync: (p: string) => fs.existsSync(path.join(baseDir, p)),
    clone: cloneFn,
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

  it('clones each item in coreToClone and creates the library directory', async () => {
    const adapter = makeRealFsAdapter(fixture.dir);
    const svc = new CoreService(adapter, makeSetupService(), CORE_TO_CLONE, [], LIBRARIES_FOLDER);
    await svc.core();

    for (const lib of CORE_TO_CLONE) {
      expect(fs.existsSync(path.join(fixture.dir, LIBRARIES_FOLDER, lib))).toBe(true);
    }
    expect(adapter.clone).toHaveBeenCalledTimes(CORE_TO_CLONE.length);
  });

  it('calls setupService.setup for each item in coreToSetup', async () => {
    const adapter = makeRealFsAdapter(fixture.dir);
    const setupSvc = makeSetupService();
    const svc = new CoreService(adapter, setupSvc, [], CORE_TO_SETUP, LIBRARIES_FOLDER);
    await svc.core();

    for (const lib of CORE_TO_SETUP) {
      expect(setupSvc.setup).toHaveBeenCalledWith(lib);
    }
  });

  it('all four project folders exist when setupFolders + core run together', async () => {
    setupFolders();
    const adapter = makeRealFsAdapter(fixture.dir);
    const svc = new CoreService(adapter, makeSetupService(), CORE_TO_CLONE, [], LIBRARIES_FOLDER);
    await svc.core();

    for (const dir of ['content', 'libraries', 'temp', 'uploads']) {
      expect(fs.existsSync(path.join(fixture.dir, dir))).toBe(true);
    }
    for (const lib of CORE_TO_CLONE) {
      expect(fs.existsSync(path.join(fixture.dir, LIBRARIES_FOLDER, lib))).toBe(true);
    }
  });
});

describe('CoreService integration — seeded project', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createSeededProject(CORE_TO_CLONE);
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  it('does NOT call clone when library dirs already exist', async () => {
    const adapter = makeRealFsAdapter(fixture.dir);
    const svc = new CoreService(adapter, makeSetupService(), CORE_TO_CLONE, [], LIBRARIES_FOLDER);
    await svc.core();

    expect(adapter.clone).not.toHaveBeenCalled();
  });
});
