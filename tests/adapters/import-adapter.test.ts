import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { import: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { ImportAdapter } from '../../src/adapters/import-adapter';

describe('ImportAdapter', () => {
  let adapter: ImportAdapter;

  beforeEach(() => {
    adapter = new ImportAdapter();
    vi.clearAllMocks();
  });

  it('delegates import to logic', () => {
    (logic.import as ReturnType<typeof vi.fn>).mockReturnValue('h5p-blanks');
    const result = adapter.import('myfolder', 'archive.h5p');
    expect(logic.import).toHaveBeenCalledWith('myfolder', 'archive.h5p');
    expect(result).toBe('h5p-blanks');
  });

  it('propagates errors', () => {
    (logic.import as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('import failed'); });
    expect(() => adapter.import('myfolder')).toThrow('import failed');
  });
});
