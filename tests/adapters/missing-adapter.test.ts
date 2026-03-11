import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: {
    parseLibraryFolders: vi.fn(),
    getRegistry: vi.fn(),
    computeDependencies: vi.fn(),
  },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { MissingAdapter } from '../../src/adapters/missing-adapter';

describe('MissingAdapter', () => {
  let adapter: MissingAdapter;

  beforeEach(() => {
    adapter = new MissingAdapter();
    vi.clearAllMocks();
  });

  it('delegates parseLibraryFolders to logic', async () => {
    const dirs = { 1: '/libs/h5p-blanks' };
    (logic.parseLibraryFolders as ReturnType<typeof vi.fn>).mockResolvedValue(dirs);
    const result = await adapter.parseLibraryFolders();
    expect(logic.parseLibraryFolders).toHaveBeenCalled();
    expect(result).toBe(dirs);
  });

  it('delegates getRegistry to logic', async () => {
    const reg = { regular: {}, reversed: {} };
    (logic.getRegistry as ReturnType<typeof vi.fn>).mockResolvedValue(reg);
    const result = await adapter.getRegistry();
    expect(result).toBe(reg);
  });

  it('delegates computeDependencies to logic', async () => {
    const deps = { 'h5p-core': { id: 1 } };
    (logic.computeDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(deps);
    const result = await adapter.computeDependencies('h5p-blanks', 'view', null, '/folder');
    expect(logic.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'view', null, '/folder');
    expect(result).toBe(deps);
  });
});
