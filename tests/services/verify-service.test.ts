import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyService } from '../../src/services/verify-service';
import type { IVerifyAdapter } from '../../src/adapters/verify-adapter';

describe('VerifyService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs the report from adapter', async () => {
    const report = { ok: true, issues: [] };
    const adapter: IVerifyAdapter = { verifySetup: vi.fn().mockResolvedValue(report) };
    const svc = new VerifyService(adapter, logger);
    await svc.verify('h5p-blanks');
    expect(adapter.verifySetup).toHaveBeenCalledWith('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith(report);
  });

  it('propagates rejection', async () => {
    const adapter: IVerifyAdapter = { verifySetup: vi.fn().mockRejectedValue(new Error('fail')) };
    const svc = new VerifyService(adapter, logger);
    await expect(svc.verify('h5p-blanks')).rejects.toThrow('fail');
  });
});
