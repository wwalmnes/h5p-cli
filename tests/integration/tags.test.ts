import { describe, it, expect, vi } from 'vitest';
import { TagsService } from '../../src/services/tags-service';
import type { ITagsAdapter } from '../../src/adapters/tags-adapter';

describe('TagsService integration', () => {
  it('logs the fetching message and the result from adapter.tags', () => {
    const logger = { log: vi.fn() };
    const tagsResult = { '1.14': '2023-01-01', '1.15': '2023-06-01' };
    const adapter: ITagsAdapter = {
      tags: vi.fn().mockReturnValue(tagsResult),
    };
    const svc = new TagsService(adapter, logger);

    svc.tags('h5p', 'h5p-blanks', 'master');

    expect(logger.log).toHaveBeenCalledWith('> fetching h5p library tags');
    expect(logger.log).toHaveBeenCalledWith(tagsResult);
  });
});
