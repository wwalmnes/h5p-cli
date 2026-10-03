import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCommand } from '../../src/commands/verify.ts';
import { verifySetup } from '../../src/install/install.ts';

vi.mock('../../src/install/install.ts', () => ({ verifySetup: vi.fn() }));

describe('verifyCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('logs error on rejection', async () => {
    vi.mocked(verifySetup).mockRejectedValue(new Error('fail'));
    await verifyCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: fail');
  });

  it('writes the verification result for the library to stdout as JSON', async () => {
    const result = { ok: true, libraries: { 'H5P.Blanks': { present: true } } };
    vi.mocked(verifySetup).mockResolvedValue(result as any);
    await verifyCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(verifySetup).toHaveBeenCalledWith('h5p-blanks');
    expect(JSON.parse(stdout)).toEqual(result);
  });
});
