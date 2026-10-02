import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tagsCommand } from '../../src/commands/tags.ts';
import { tags } from '../../src/logic/repo.ts';

vi.mock('../../src/logic/repo.ts', () => ({ tags: vi.fn() }));

describe('tagsCommand', () => {
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

  it('asks for the tags of org/library', async () => {
    vi.mocked(tags).mockReturnValue([]);
    await tagsCommand().parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(tags).toHaveBeenCalledWith('h5p', 'h5p-blanks');
  });

  it('logs error on exception', async () => {
    vi.mocked(tags).mockImplementation(() => { throw new Error('tags failed'); });
    await tagsCommand().parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: tags failed');
  });

  it('writes each tag to stdout on its own line', async () => {
    vi.mocked(tags).mockReturnValue(['1.0.0', '1.1.0', '2.0.0']);
    await tagsCommand().parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(stdout).toBe('1.0.0\n1.1.0\n2.0.0\n');
  });
});
