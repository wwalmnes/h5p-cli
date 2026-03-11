import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tagsCommand } from '../../src/commands/tags';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { tags: vi.fn() },
}));

describe('tagsCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { tags: vi.fn() } as any;
    expect(tagsCommand(mockSvc).name()).toBe('tags');
  });

  it('calls service.tags with org, library, mainBranch', async () => {
    const mockSvc = { tags: vi.fn() } as any;
    const cmd = tagsCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);
    expect(mockSvc.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks', 'master');
  });

  it('logs error on exception', async () => {
    const mockSvc = { tags: vi.fn().mockImplementation(() => { throw new Error('tags failed'); }) } as any;
    const cmd = tagsCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
