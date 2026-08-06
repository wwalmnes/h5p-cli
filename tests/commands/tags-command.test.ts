import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tagsCommand } from '../../src/commands/tags.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { tags: vi.fn() },
}));

describe('tagsCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
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

  it('calls adapter.tags with org, library, mainBranch', async () => {
    const mockAdapter = { tags: vi.fn() } as any;
    const cmd = tagsCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);
    expect(mockAdapter.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks', 'master');
  });

  it('logs error on exception', async () => {
    const mockAdapter = { tags: vi.fn().mockImplementation(() => { throw new Error('tags failed'); }) } as any;
    const cmd = tagsCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);
    expect(stderr).toContain('> error: tags failed');
  });
});
