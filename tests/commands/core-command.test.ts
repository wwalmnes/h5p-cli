import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coreCommand } from '../../src/commands/core.ts';
import { installCore } from '../../src/logic/install.ts';

vi.mock('../../configLoader', () => ({
  default: {
    folders: { libraries: 'libraries', temp: 'temp' },
    core: {
      clone: ['h5p-editor-php-library', 'h5p-php-library'],
      setup: [{ repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' }],
    },
  },
}));
vi.mock('../../src/logic/install.ts', () => ({ installCore: vi.fn() }));
vi.mock('../../src/lib/setup-folders.ts', () => ({ setupFolders: vi.fn() }));

describe('coreCommand', () => {
  let stderr: string;

  beforeEach(() => {
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(installCore).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  /* One call, so one pool. The clone half and the library half used to be two
  sequential phases, which is what made the command take their sum. A library
  entry carries no target: its folder is <machineName>-<major>.<minor>, and the
  version is only knowable once the repo is cloned. latest = true is what reaches
  _update rather than a bare skip for repos that are already installed. */
  it('installs every core repo in a single refreshing call', async () => {
    await coreCommand().parseAsync(['node', 'h5p']);

    expect(installCore).toHaveBeenCalledTimes(1);
    expect(installCore).toHaveBeenCalledWith([
      { org: 'h5p', repo: 'h5p-editor-php-library', target: 'h5p-editor-php-library' },
      { org: 'h5p', repo: 'h5p-php-library', target: 'h5p-php-library' },
      { org: 'h5p', repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' },
    ], true, undefined);
    expect(stderr).toContain('done setting up core libraries');
  });

  it('passes --concurrency through as a number', async () => {
    await coreCommand().parseAsync(['node', 'h5p', '-c', '8']);
    expect(vi.mocked(installCore).mock.calls[0][2]).toBe(8);
  });

  it('rejects a non-positive --concurrency', async () => {
    await coreCommand().parseAsync(['node', 'h5p', '-c', '0']);
    expect(installCore).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('reports a failure without claiming success', async () => {
    vi.mocked(installCore).mockRejectedValue(new Error('core failed'));
    await coreCommand().parseAsync(['node', 'h5p']);
    expect(stderr).toContain('> error: core failed');
    expect(stderr).not.toContain('done setting up core libraries');
  });
});
