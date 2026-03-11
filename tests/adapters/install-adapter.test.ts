import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { getWithDependencies: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { InstallAdapter } from '../../src/adapters/install-adapter';

describe('InstallAdapter', () => {
  let adapter: InstallAdapter;

  beforeEach(() => {
    adapter = new InstallAdapter();
    vi.clearAllMocks();
  });

  it('delegates getWithDependencies to logic for clone', async () => {
    (logic.getWithDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(['h5p-blanks']);
    const result = await adapter.getWithDependencies('clone', 'h5p-blanks', 'view', true, []);
    expect(logic.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', 'view', true, []);
    expect(result).toEqual(['h5p-blanks']);
  });

  it('delegates getWithDependencies to logic for download', async () => {
    (logic.getWithDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(['h5p-blanks']);
    await adapter.getWithDependencies('download', 'h5p-blanks', 'edit');
    expect(logic.getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', 'edit', undefined, undefined);
  });

  it('propagates rejection', async () => {
    (logic.getWithDependencies as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('clone failed'));
    await expect(adapter.getWithDependencies('clone', 'h5p-blanks')).rejects.toThrow('clone failed');
  });
});
