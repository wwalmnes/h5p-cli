import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupCommand } from '../../src/commands/setup.ts';
import { setup } from '../../src/logic/setup.ts';

vi.mock('../../src/logic/setup.ts', () => ({ setup: vi.fn() }));

describe('setupCommand', () => {
  let stderr: string;

  beforeEach(() => {
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(setup).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('sets up the library', async () => {
    await setupCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(setup).toHaveBeenCalledWith('h5p-blanks', undefined, undefined, undefined);
  });

  it('forwards the ref and download args', async () => {
    await setupCommand().parseAsync(['node', 'h5p', 'h5p-blanks', '1.14', '1']);
    expect(setup).toHaveBeenCalledWith('h5p-blanks', '1.14', '1', undefined);
  });

  it('forwards a git ref positional', async () => {
    await setupCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'feat/my-pr']);
    expect(setup).toHaveBeenCalledWith('h5p-blanks', 'feat/my-pr', undefined, undefined);
  });

  it('forwards --concurrency as a number', async () => {
    await setupCommand().parseAsync(['node', 'h5p', 'h5p-blanks', '--concurrency', '8']);
    expect(setup).toHaveBeenCalledWith('h5p-blanks', undefined, undefined, 8);
  });

  it('logs error when setup rejects, no unhandled rejection', async () => {
    vi.mocked(setup).mockRejectedValue(new Error('setup failed'));
    await setupCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: setup failed');
  });
});
