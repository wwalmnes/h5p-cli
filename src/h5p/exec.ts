import { spawn, spawnSync } from 'child_process';
import { ui } from '../ui/ui.ts';
import { resolveExecTimeout } from './pool.ts';

/* execSync output is noise unless something went wrong; ui.debug keeps it
behind --verbose. Trimmed because emit() terminates every line itself. */
const _debug = (output: string): void => {
  const trimmed = output.trim();
  if (trimmed) ui.debug(trimmed);
};

const _failed = (command: string, stderr: string): Error => {
  const detail = stderr.trim();
  return new Error(`Command failed: ${command}${detail ? `\n${detail}` : ''}`);
};

/* Any prompt inside a subprocess is a permanent hang, not a question: ssh and
git write theirs to /dev/tty, which the live progress area repaints over twelve
times a second, so the user sees a frozen row and never the prompt.

GIT_TERMINAL_PROMPT=0 disables git's own username/password prompt without
touching credential helpers. BatchMode=yes makes ssh fail instead of asking
for a passphrase or a host-key confirmation, and leaves ssh-agent alone. Both
are inherited by grandchildren, which is what reaches that nested clone.

A GIT_SSH the user set without GIT_SSH_COMMAND is left alone */
export const _nonInteractiveEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (process.env.GIT_SSH_COMMAND || !process.env.GIT_SSH) {
    env.GIT_SSH_COMMAND = `${process.env.GIT_SSH_COMMAND || 'ssh'} -o BatchMode=yes`;
  }
  return env;
};

const _timedOut = (command: string, cwd: string | undefined, ms: number): Error =>
  new Error(`Command timed out after ${Math.round(ms / 1000)}s: ${command}${cwd ? `\n  in ${cwd}` : ''}`);

const _children = new Set<ReturnType<typeof spawn>>();

/* `shell: true` means the direct child is /bin/sh, and for a compound script
like `a && b && c` sh does not exec - it stays, and the npm/webpack/ssh
processes below it survive a kill aimed at sh alone. They keep the stdio pipes
they inherited open, so 'close' never fires and node cannot exit either.
Spawning detached puts each command in its own process group, and a negative
pid signals the whole group.

Windows has neither process groups nor negative pids, and a detached child
there gets a console window of its own. It is spawned attached instead, and
taskkill /T ends the tree below cmd.exe. /F because Windows has no SIGTERM to
ask with. Synchronous, as the exit hook below cannot wait. */
const _isWindows = process.platform === 'win32';

const _killGroup = (child: ReturnType<typeof spawn>, signal: NodeJS.Signals = 'SIGTERM'): void => {
  if (child.pid === undefined) {
    return;
  }
  if (_isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  }
  catch {
    // the group is already gone, which is the outcome we were after
  }
};

export const _killRunning = (): void => {
  for (const child of _children) {
    _killGroup(child);
  }
  _children.clear();
};

process.on('exit', _killRunning);

/* A signal with no listener terminates node outright - the exit hooks never
run, and an interrupted setup keeps every half-written folder it had open (see
install.ts). ui installs a SIGINT handler, but only when the live area is on, so
a piped run or a cancelled CI job has none. Exit through process.exit instead,
with the shell's own 128+signal code. Signal listeners do not hold the event
loop open, so this cannot delay a normal exit. */
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
  process.once(signal, () => process.exit(code));
}

export const _exec = (command: string, cwd?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    /* stdin is 'ignore' so a command that reads it - `patch` asking which file
    to patch, say - gets EOF and aborts, rather than blocking forever on a pipe
    nobody will ever write to. */
    const child = spawn(command, {
      shell: true,
      cwd,
      detached: !_isWindows,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: _nonInteractiveEnv(),
    });
    _children.add(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const budget = resolveExecTimeout();
    /* The backstop for a stall no amount of non-interactivity can prevent: a
    dead network, a build script that watches instead of exiting. Unreffed
    because the child's stdio pipes already hold the loop open. */
    const timer = setTimeout(() => {
      timedOut = true;
      _killGroup(child);
      // a process that ignores SIGTERM must not strand the CLI either
      setTimeout(() => _killGroup(child, 'SIGKILL'), 5000).unref();
    }, budget);
    timer.unref();
    const settle = (): void => {
      clearTimeout(timer);
      _children.delete(child);
    };
    child.stdout?.setEncoding('utf-8');
    child.stderr?.setEncoding('utf-8');
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      settle();
      reject(error);
    });
    child.on('close', (status) => {
      settle();
      _debug(stdout);
      _debug(stderr);
      if (timedOut) {
        reject(_timedOut(command, cwd, budget));
        return;
      }
      if (status !== 0) {
        reject(_failed(command, stderr));
        return;
      }
      resolve(stdout);
    });
  });
};
