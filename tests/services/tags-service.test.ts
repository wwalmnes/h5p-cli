import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagsService } from '../../src/services/tags-service';
import type { ITagsAdapter } from '../../src/adapters/tags-adapter';

describe('TagsService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs fetching message and tags result', () => {
    const tags = ['v1.0', 'v1.1'];
    const adapter: ITagsAdapter = { tags: vi.fn().mockReturnValue(tags) };
    const svc = new TagsService(adapter, logger);
    svc.tags('h5p', 'h5p-blanks', 'master');
    expect(adapter.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks', 'master');
    expect(logger.log).toHaveBeenCalledWith('> fetching h5p library tags');
    expect(logger.log).toHaveBeenCalledWith(tags);
  });
});
