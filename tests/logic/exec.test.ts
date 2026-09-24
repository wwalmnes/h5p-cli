import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { _exec as execCommand, _execSync as execCommandSync } from '../../src/logic/exec.ts';

// We want to test and verify that subprocesses don't wait for user input. If they wait, they are killed.
describe('subprocess contract', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    delete process.env.H5P_EXEC_TIMEOUT;
    vi.restoreAllMocks();
  });

  describe('execCommand', () => {
    it('captures stdout', async () => {
      expect(await execCommand('echo hello')).toBe('hello\n');
    });

    it('rejects with the command and its stderr on a non-zero exit', async () => {
      await expect(execCommand('echo boom >&2; exit 3')).rejects.toThrow(/Command failed.*boom/s);
    });

    /* The Shepherd hang in miniature: `patch` asking which file to patch reads
    stdin, and a piped stdin nobody writes to never answers. */
    it('gives a command that reads stdin EOF instead of blocking on it', async () => {
      expect(await execCommand('cat')).toBe('');
    });

    it('disables git\'s terminal prompt for children and grandchildren', async () => {
      expect((await execCommand('sh -c "echo $GIT_TERMINAL_PROMPT"')).trim()).toBe('0');
    });

    it('forces ssh into batch mode, keeping any command the user already set', async () => {
      process.env.GIT_SSH_COMMAND = 'ssh -i /keys/id';
      try {
        const out = await execCommand('echo $GIT_SSH_COMMAND');
        expect(out.trim()).toBe('ssh -i /keys/id -o BatchMode=yes');
      }
      finally {
        delete process.env.GIT_SSH_COMMAND;
      }
    });

    it('kills a stalled command at the budget and says so', async () => {
      process.env.H5P_EXEC_TIMEOUT = '1';
      const started = Date.now();
      await expect(execCommand('sleep 30')).rejects.toThrow(/timed out after 1s: sleep 30/);
      expect(Date.now() - started).toBeLessThan(10_000);
    });

    /* sh does not exec a compound command, so the sleep is a grandchild. If the
    kill only reached sh, close would wait on the pipe the sleep still holds and
    this would run to the sleep's full 30s. */
    it('reaches grandchildren, not just the shell', async () => {
      process.env.H5P_EXEC_TIMEOUT = '1';
      const started = Date.now();
      await expect(execCommand('sleep 30 && echo never')).rejects.toThrow(/timed out/);
      expect(Date.now() - started).toBeLessThan(10_000);
    });
  });

  describe('execCommandSync', () => {
    it('returns stdout', () => {
      expect(execCommandSync('echo hello')).toBe('hello\n');
    });

    it('runs in the given folder', () => {
      expect(execCommandSync('pwd', '/').trim()).toBe(execSync('cd / && pwd').toString().trim());
    });

    it('throws with the command and its stderr on a non-zero exit', () => {
      expect(() => execCommandSync('echo boom >&2; exit 3')).toThrow(/Command failed.*boom/s);
    });

    it('reports a timeout as a timeout', () => {
      process.env.H5P_EXEC_TIMEOUT = '1';
      expect(() => execCommandSync('sleep 30')).toThrow(/timed out after 1s/);
    });
  });
});
