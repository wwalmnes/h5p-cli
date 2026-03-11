import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: {
    machineToShort: vi.fn(),
    computeDependencies: vi.fn(),
    getWithDependencies: vi.fn(),
  },
}));

vi.mock('../../configLoader', () => ({
  default: {
    registry: 'libraryRegistry.json',
    folders: { libraries: 'libraries', temp: 'temp' },
  },
}));

import logic from '../../logic';
import { SetupAdapter } from '../../src/adapters/setup-adapter';

describe('SetupAdapter', () => {
  let adapter: SetupAdapter;

  beforeEach(() => {
    adapter = new SetupAdapter();
    vi.clearAllMocks();
  });

  it('delegates machineToShort to logic', () => {
    (logic.machineToShort as ReturnType<typeof vi.fn>).mockReturnValue('h5p-blanks');
    const result = adapter.machineToShort('H5P.Blanks-1.14');
    expect(logic.machineToShort).toHaveBeenCalledWith('H5P.Blanks-1.14');
    expect(result).toBe('h5p-blanks');
  });

  it('delegates computeDependencies to logic', async () => {
    const deps = { 'h5p-blanks': { id: 1 } };
    (logic.computeDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(deps);
    const result = await adapter.computeDependencies('h5p-blanks', 'view', '1.14');
    expect(logic.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'view', '1.14');
    expect(result).toBe(deps);
  });

  it('delegates getWithDependencies to logic', async () => {
    const installed = ['h5p-blanks', 'h5p-core'];
    (logic.getWithDependencies as ReturnType<typeof vi.fn>).mockResolvedValue(installed);
    const result = await adapter.getWithDependencies('clone', 'h5p-blanks', 'view', true, []);
    expect(logic.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', 'view', true, []);
    expect(result).toBe(installed);
  });

  it('propagates rejection from computeDependencies', async () => {
    (logic.computeDependencies as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    await expect(adapter.computeDependencies('h5p-blanks', 'edit')).rejects.toThrow('network error');
  });

  it('propagates rejection from getWithDependencies', async () => {
    (logic.getWithDependencies as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('clone failed'));
    await expect(adapter.getWithDependencies('clone', 'h5p-blanks', 'view', true, [])).rejects.toThrow('clone failed');
  });
});
