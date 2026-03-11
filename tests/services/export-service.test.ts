import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../../src/services/export-service';
import type { IExportAdapter } from '../../src/adapters/export-adapter';

describe('ExportService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs the file path returned by adapter', async () => {
    const adapter: IExportAdapter = { export: vi.fn().mockResolvedValue('/out/h5p-blanks.h5p') };
    const svc = new ExportService(adapter, logger);
    await svc.export('h5p-blanks', '/out');
    expect(adapter.export).toHaveBeenCalledWith('h5p-blanks', '/out');
    expect(logger.log).toHaveBeenCalledWith('/out/h5p-blanks.h5p');
  });

  it('works without folder arg', async () => {
    const adapter: IExportAdapter = { export: vi.fn().mockResolvedValue('h5p-blanks.h5p') };
    const svc = new ExportService(adapter, logger);
    await svc.export('h5p-blanks');
    expect(adapter.export).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('propagates rejection', async () => {
    const adapter: IExportAdapter = { export: vi.fn().mockRejectedValue(new Error('export failed')) };
    const svc = new ExportService(adapter, logger);
    await expect(svc.export('h5p-blanks')).rejects.toThrow('export failed');
  });
});
