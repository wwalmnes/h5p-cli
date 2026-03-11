import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { computeDependencies: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { DepsAdapter } from '../../src/adapters/deps-adapter';

describe('DepsAdapter', () => {
  let adapter: DepsAdapter;

  beforeEach(() => {
    adapter = new DepsAdapter();
    vi.clearAllMocks();
  });

  it('delegates computeDependencies to logic', async () => {
    const deps = { 'h5p-core': { id: 1 } };
    (logic.computeDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(deps);
    const result = await adapter.computeDependencies('h5p-blanks', 'view', '1.14', '/folder');
    expect(logic.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'view', '1.14', '/folder');
    expect(result).toBe(deps);
  });

  it('propagates rejection', async () => {
    (logic.computeDependencies as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    await expect(adapter.computeDependencies('h5p-blanks')).rejects.toThrow('fail');
  });
});
