import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { clone: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('fs', () => ({
  default: { existsSync: vi.fn() },
  existsSync: vi.fn(),
}));

import logic from '../../logic';
import * as fsModule from 'fs';
import { CoreAdapter } from '../../src/adapters/core-adapter';

describe('CoreAdapter', () => {
  let adapter: CoreAdapter;

  beforeEach(() => {
    adapter = new CoreAdapter();
    vi.clearAllMocks();
  });

  it('delegates clone to logic', () => {
    adapter.clone('h5p', 'h5p-core', 'master', 'h5p-core');
    expect(logic.clone).toHaveBeenCalledWith('h5p', 'h5p-core', 'master', 'h5p-core');
  });

  it('delegates existsSync to fs', () => {
    (fsModule.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = adapter.existsSync('/some/path');
    expect(fsModule.existsSync).toHaveBeenCalledWith('/some/path');
    expect(result).toBe(true);
  });

  it('returns false from existsSync when path does not exist', () => {
    (fsModule.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(adapter.existsSync('/nonexistent')).toBe(false);
  });
});
