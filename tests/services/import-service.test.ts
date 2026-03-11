import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/services/import-service';
import type { IImportAdapter } from '../../src/adapters/import-adapter';

describe('ImportService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs content/<output>', () => {
    const adapter: IImportAdapter = { import: vi.fn().mockReturnValue('h5p-blanks') };
    const svc = new ImportService(adapter, logger);
    svc.import('myfolder', 'archive.h5p');
    expect(adapter.import).toHaveBeenCalledWith('myfolder', 'archive.h5p');
    expect(logger.log).toHaveBeenCalledWith('content/h5p-blanks');
  });

  it('works without archive arg', () => {
    const adapter: IImportAdapter = { import: vi.fn().mockReturnValue('myfolder') };
    const svc = new ImportService(adapter, logger);
    svc.import('myfolder');
    expect(adapter.import).toHaveBeenCalledWith('myfolder', undefined);
    expect(logger.log).toHaveBeenCalledWith('content/myfolder');
  });

  it('propagates errors from adapter', () => {
    const adapter: IImportAdapter = { import: vi.fn().mockImplementation(() => { throw new Error('import failed'); }) };
    const svc = new ImportService(adapter, logger);
    expect(() => svc.import('myfolder')).toThrow('import failed');
  });
});
