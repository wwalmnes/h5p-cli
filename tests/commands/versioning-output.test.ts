import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printVersionResults } from '../../src/commands/utils/versioning-output.ts';

describe('printVersionResults', () => {
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
  });

  it('puts the changes on stdout and the repo header on stderr', () => {
    printVersionResults([
      { name: 'h5p-accordion', msg: { version: '1.0.4', changes: ' library.json | 2 +-\n' } },
    ]);

    expect(stdout).toBe(' library.json | 2 +-\n');
    expect(stderr).toContain('h5p-accordion 1.0.4');
  });

  it('reports skipped and failed repos with their reason, off the data channel', () => {
    printVersionResults([
      { name: 'h5p-column', skipped: true, msg: 'detached HEAD' },
      { name: 'h5p-blanks', failed: true, msg: { error: 'fatal: bad revision', output: '' } },
    ]);

    expect(stdout).toBe('');
    expect(stderr).toContain('h5p-column SKIPPED detached HEAD');
    expect(stderr).toContain('h5p-blanks FAILED');
    expect(stderr).toContain('fatal: bad revision');
  });
});
