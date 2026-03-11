import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { getRegistry: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { ListAdapter } from '../../src/adapters/list-adapter';

describe('ListAdapter', () => {
  let adapter: ListAdapter;

  beforeEach(() => {
    adapter = new ListAdapter();
    vi.clearAllMocks();
  });

  it('delegates getRegistry to logic', async () => {
    const reg = { regular: {}, reversed: {} };
    (logic.getRegistry as ReturnType<typeof vi.fn>).mockResolvedValue(reg);
    const result = await adapter.getRegistry(0);
    expect(logic.getRegistry).toHaveBeenCalledWith(0);
    expect(result).toBe(reg);
  });

  it('propagates rejection', async () => {
    (logic.getRegistry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('net error'));
    await expect(adapter.getRegistry()).rejects.toThrow('net error');
  });
});
