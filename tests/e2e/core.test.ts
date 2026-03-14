import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createEmptyProject, type Fixture } from '../helpers/fixture';

// Stub only actual external I/O — git and network calls
vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn(),
    machineToShort: vi.fn(),
  },
}));

describe('core — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(async () => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    fs.mkdirSync(path.join(fixture.dir, 'libraries'), { recursive: true });

    // Make stubbed clone actually create the directory, like a real git clone would
    const logic = await import('../../logic');
    vi.mocked(logic.default.clone).mockImplementation(
      (_org: string, _library: string, _branch: string, target: string) => {
        fs.mkdirSync(path.join(fixture.dir, 'libraries', target), { recursive: true });
      }
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('installs every core library into the libraries folder', async () => {
    const EXPECTED_CORE_LIBRARIES = ['h5p-editor-php-library', 'h5p-php-library'];

    // Dynamically import so vi.mock hoisting is in effect for all transitive imports
    const { coreCommand } = await import('../../src/commands/core');

    const cmd = coreCommand();
    await cmd.parseAsync(['node', 'h5p']);

    const missingLibs = EXPECTED_CORE_LIBRARIES.filter(
      lib => !fs.existsSync(path.join(fixture.dir, 'libraries', lib))
    );
    expect(missingLibs).toEqual([]);
  });
});
