import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCommand } from '../../src/commands/verify.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { verifySetup: vi.fn() },
}));

describe('verifyCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
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

  it('writes the verification result to stdout as JSON', async () => {
    const result = { ok: true, libraries: { 'H5P.Blanks': { present: true } } };
    const mockAdapter = { verifySetup: vi.fn().mockResolvedValue(result) } as any;
    await verifyCommand(mockAdapter).parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(JSON.parse(stdout)).toEqual(result);
  });
});
