import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCommand } from '../../src/commands/verify.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { verifySetup: vi.fn() },
}));

describe('verifyCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    const mockAdapter = { verifySetup: vi.fn().mockResolvedValue(undefined) } as any;
    expect(verifyCommand(mockAdapter).name()).toBe('verify');
  });

  it('calls adapter.verifySetup with library', async () => {
    const mockAdapter = { verifySetup: vi.fn().mockResolvedValue('ok') } as any;
    const cmd = verifyCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.verifySetup).toHaveBeenCalledWith('h5p-blanks');
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { verifySetup: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const cmd = verifyCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: fail');
  });
});
