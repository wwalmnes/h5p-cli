import { describe, it, expect, vi } from 'vitest';
import { ImportService } from '../../src/services/import-service';
import type { IImportAdapter } from '../../src/adapters/import-adapter';

describe('ImportService integration', () => {
  it('logs "content/<output>" from adapter.import', () => {
    const logger = { log: vi.fn() };
    const adapter: IImportAdapter = {
      import: vi.fn().mockReturnValue('my-folder'),
    };
    const svc = new ImportService(adapter, logger);

    svc.import('my-folder');

    expect(logger.log).toHaveBeenCalledWith('content/my-folder');
  });
});
