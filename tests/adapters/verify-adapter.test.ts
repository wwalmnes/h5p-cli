import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: { verifySetup: vi.fn() },
}));
vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));

import logic from '../../logic';
import { VerifyAdapter } from '../../src/adapters/verify-adapter';

describe('VerifyAdapter', () => {
  let adapter: VerifyAdapter;

  beforeEach(() => {
    adapter = new VerifyAdapter();
    vi.clearAllMocks();
  });

  it('delegates verifySetup to logic', async () => {
    const report = { ok: true };
    (logic.verifySetup as ReturnType<typeof vi.fn>).mockResolvedValue(report);
    const result = await adapter.verifySetup('h5p-blanks');
    expect(logic.verifySetup).toHaveBeenCalledWith('h5p-blanks');
    expect(result).toBe(report);
  });

  it('propagates rejection', async () => {
    (logic.verifySetup as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('verify failed'));
    await expect(adapter.verifySetup('h5p-blanks')).rejects.toThrow('verify failed');
  });
});
