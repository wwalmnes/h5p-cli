import { spawn, spawnSync } from 'child_process';
import { ui } from '../lib/ui.ts';
import { resolveExecTimeout } from '../lib/pool.ts';

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
are inherited by grandchildren, which is what reaches that nested clone. */
const _nonInteractiveEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: `${process.env.GIT_SSH_COMMAND ?? 'ssh'} -o BatchMode=yes`,
});

const _timedOut = (command: string, cwd: string | undefined, ms: number): Error =>
  new Error(`Command timed out after ${Math.round(ms / 1000)}s: ${command}${cwd ? `\n  in ${cwd}` : ''}`);

/* execSync inherits stderr, so git/npm write straight past ui — which both
leaks output under --quiet and shreds the live progress frame. spawnSync
captures both streams so everything reaches the terminal through emit().
*/
export const _execSync = (command: string, cwd?: string): string => {
  const budget = resolveExecTimeout();
  const result = spawnSync(command, {
    shell: true,
    cwd,
    encoding: 'utf-8',
    env: _nonInteractiveEnv(),
    timeout: budget,
  });
  if (result.error) {
    // node reports the timeout as ETIMEDOUT; say what actually happened
    throw (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
      ? _timedOut(command, cwd, budget)
      : result.error;
  }
  _debug(result.stdout ?? '');
  _debug(result.stderr ?? '');
  if (result.signal) {
    throw _timedOut(command, cwd, budget);
  }
  if (result.status !== 0) {
    throw _failed(command, result.stderr ?? '');
  }
  return result.stdout ?? '';
};

const _children = new Set<ReturnType<typeof spawn>>();

/* `shell: true` means the direct child is /bin/sh, and for a compound script
like `a && b && c` sh does not exec - it stays, and the npm/webpack/ssh
processes below it survive a kill aimed at sh alone. They keep the stdio pipes
they inherited open, so 'close' never fires and node cannot exit either.
Spawning detached puts each command in its own process group, and a negative
pid signals the whole group. */
const _killGroup = (child: ReturnType<typeof spawn>, signal: NodeJS.Signals = 'SIGTERM'): void => {
  if (child.pid === undefined) {
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
      detached: true,
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
