import { describe, it, expect, vi } from 'vitest';
import { VerifyService } from '../../src/services/verify-service';
import type { IVerifyAdapter } from '../../src/adapters/verify-adapter';

describe('VerifyService integration', () => {
  it('logs the result returned by adapter.verifySetup', async () => {
    const logger = { log: vi.fn() };
    const verifyResult = { ok: true, issues: [] };
    const adapter: IVerifyAdapter = {
      verifySetup: vi.fn().mockResolvedValue(verifyResult),
    };
    const svc = new VerifyService(adapter, logger);

    await svc.verify('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith(verifyResult);
  });
});
