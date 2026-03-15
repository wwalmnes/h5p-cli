import { describe, it, expect, vi } from 'vitest';
import { ExportService } from '../../src/services/export-service';
import type { IExportAdapter } from '../../src/adapters/export-adapter';

describe('ExportService integration', () => {
  it('logs the filename returned by adapter.export', async () => {
    const logger = { log: vi.fn() };
    const adapter: IExportAdapter = {
      export: vi.fn().mockResolvedValue('my-lib.h5p'),
    };
    const svc = new ExportService(adapter, logger);

    await svc.export('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('my-lib.h5p');
  });
});
