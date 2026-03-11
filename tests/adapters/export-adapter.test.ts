import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { export: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { ExportAdapter } from '../../src/adapters/export-adapter';

describe('ExportAdapter', () => {
  let adapter: ExportAdapter;

  beforeEach(() => {
    adapter = new ExportAdapter();
    vi.clearAllMocks();
  });

  it('delegates export to logic', async () => {
    (logic.export as ReturnType<typeof vi.fn>).mockResolvedValue('/out/h5p-blanks.h5p');
    const result = await adapter.export('h5p-blanks', '/out');
    expect(logic.export).toHaveBeenCalledWith('h5p-blanks', '/out');
    expect(result).toBe('/out/h5p-blanks.h5p');
  });

  it('propagates rejection', async () => {
    (logic.export as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('export failed'));
    await expect(adapter.export('h5p-blanks')).rejects.toThrow('export failed');
  });
});
