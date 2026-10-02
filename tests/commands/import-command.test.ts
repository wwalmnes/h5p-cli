import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importCommand } from '../../src/commands/import.ts';
import { importContent } from '../../src/logic/content.ts';

vi.mock('../../src/logic/content.ts', () => ({ importContent: vi.fn() }));

describe('importCommand', () => {
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

  it('imports the archive into the folder and prints where it went', async () => {
    vi.mocked(importContent).mockReturnValue('myfolder');
    await importCommand().parseAsync(['node', 'h5p', 'myfolder', 'archive.h5p']);
    expect(importContent).toHaveBeenCalledWith('myfolder', 'archive.h5p');
    expect(stdout).toContain('content/myfolder');
  });

  it('leaves the archive to the default when none is given', async () => {
    vi.mocked(importContent).mockReturnValue('myfolder');
    await importCommand().parseAsync(['node', 'h5p', 'myfolder']);
    expect(importContent).toHaveBeenCalledWith('myfolder', undefined);
  });

  it('logs error on exception', async () => {
    vi.mocked(importContent).mockImplementation(() => { throw new Error('import failed'); });
    await importCommand().parseAsync(['node', 'h5p', 'myfolder']);
    expect(stderr).toContain('> error: import failed');
  });
});
