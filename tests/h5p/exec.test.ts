import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { EventEmitter } from 'events';
import { _exec as execCommand, _nonInteractiveEnv } from '../../src/h5p/exec.ts';

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

    it('runs in the given folder', async () => {
      expect((await execCommand('pwd', '/')).trim()).toBe(execSync('cd / && pwd').toString().trim());
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

  describe('_nonInteractiveEnv', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('runs plain ssh in batch mode when the user set nothing', () => {
      vi.stubEnv('GIT_SSH_COMMAND', '');
      vi.stubEnv('GIT_SSH', '');
      expect(_nonInteractiveEnv().GIT_SSH_COMMAND).toBe('ssh -o BatchMode=yes');
    });

    it('composes onto GIT_SSH_COMMAND when both are set, as git uses that one', () => {
      vi.stubEnv('GIT_SSH_COMMAND', 'ssh -i /keys/id');
      vi.stubEnv('GIT_SSH', '/usr/bin/other-ssh');
      expect(_nonInteractiveEnv().GIT_SSH_COMMAND).toBe('ssh -i /keys/id -o BatchMode=yes');
    });
  });

  /* Windows has no process groups, so _exec must not spawn detached there (that
  also opens a console window) and must end the tree with taskkill instead of a
  negative pid. exec.ts reads the platform when it loads, hence the fresh import. */
  describe('on Windows', () => {
    afterEach(() => {
      vi.doUnmock('child_process');
      vi.resetModules();
    });

    it('spawns attached and kills the tree with taskkill', async () => {
      vi.resetModules();
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      const child = Object.assign(new EventEmitter(), { pid: 4242, stdout: null, stderr: null });
      const spawn = vi.fn(() => child);
      const spawnSync = vi.fn(() => ({ status: 0 }));
      vi.doMock('child_process', () => ({ spawn, spawnSync }));
      const kill = vi.spyOn(process, 'kill');

      const { _exec, _killRunning } = await import('../../src/h5p/exec.ts');
      const running = _exec('npm run build', 'lib');
      _killRunning();
      child.emit('close', 1);
      await expect(running).rejects.toThrow(/Command failed: npm run build/);

      expect(spawn).toHaveBeenCalledWith('npm run build', expect.objectContaining({ detached: false, windowsHide: true }));
      expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T', '/F'], expect.anything());
      expect(kill).not.toHaveBeenCalled();
    });
  });
});
