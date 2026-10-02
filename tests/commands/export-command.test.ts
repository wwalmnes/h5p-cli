import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../src/commands/export.ts';
import { exportContent } from '../../src/logic/content.ts';

vi.mock('../../src/logic/content.ts', () => ({ exportContent: vi.fn() }));

describe('exportCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('exports the library into the given folder and prints the file', async () => {
    vi.mocked(exportContent).mockResolvedValue('/out/h5p-blanks.h5p');
    await exportCommand().parseAsync(['node', 'h5p', 'h5p-blanks', '/out']);
    expect(exportContent).toHaveBeenCalledWith('h5p-blanks', '/out');
    expect(stdout).toContain('/out/h5p-blanks.h5p');
  });

  it('leaves the folder to the default when none is given', async () => {
    vi.mocked(exportContent).mockResolvedValue('h5p-blanks.h5p');
    await exportCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(exportContent).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    vi.mocked(exportContent).mockRejectedValue(new Error('export failed'));
    await exportCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: export failed');
  });
});
