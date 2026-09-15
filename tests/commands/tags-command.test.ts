import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tagsCommand } from '../../src/commands/tags.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { tags: vi.fn() },
}));

describe('tagsCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    const mockAdapter = { tags: vi.fn() } as any;
    expect(tagsCommand(mockAdapter).name()).toBe('tags');
  });

  it('calls adapter.tags with org and library', async () => {
    const mockAdapter = { tags: vi.fn() } as any;
    const cmd = tagsCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks');
  });

  it('logs error on exception', async () => {
    const mockAdapter = { tags: vi.fn().mockImplementation(() => { throw new Error('tags failed'); }) } as any;
    const cmd = tagsCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: tags failed');
  });

  it('writes each tag to stdout on its own line', async () => {
    const mockAdapter = { tags: vi.fn().mockReturnValue(['1.0.0', '1.1.0', '2.0.0']) } as any;
    await tagsCommand(mockAdapter).parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks']);
    expect(stdout).toBe('1.0.0\n1.1.0\n2.0.0\n');
  });
});
