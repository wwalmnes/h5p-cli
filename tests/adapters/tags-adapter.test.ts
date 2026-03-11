import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { tags: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { TagsAdapter } from '../../src/adapters/tags-adapter';

describe('TagsAdapter', () => {
  let adapter: TagsAdapter;

  beforeEach(() => {
    adapter = new TagsAdapter();
    vi.clearAllMocks();
  });

  it('delegates tags to logic', () => {
    const tags = ['v1.0', 'v1.1'];
    (logic.tags as ReturnType<typeof vi.fn>).mockReturnValue(tags);
    const result = adapter.tags('h5p', 'h5p-blanks', 'master');
    expect(logic.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks', 'master');
    expect(result).toBe(tags);
  });
});
