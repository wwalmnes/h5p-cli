import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const GIT_SSH = path.resolve(import.meta.dirname, '..', 'utils', 'bin', 'h5p-ssh');

export interface GitOpResult {
  name: string;
  skipped?: boolean;
  failed?: boolean;
  msg?: string;
  branch?: string;
  commit?: string;
  changes?: string[];
  error?: string;
}

export interface IGitAdapter {
  commit(repo: string, message: string): Promise<GitOpResult>;
  pull(repo: string): Promise<GitOpResult>;
  push(repo: string, args?: string[]): Promise<GitOpResult>;
  checkout(repo: string, options: string | string[]): Promise<GitOpResult>;
  deleteBranch(repo: string, branch: string): Promise<GitOpResult>;
  merge(repo: string, branch: string): Promise<GitOpResult>;
  diff(repo: string): Promise<string>;
  tag(repo: string, tagName: string): Promise<GitOpResult>;
  tagVersion(repo: string): Promise<GitOpResult>;
}

function sshError(error: string): string {
  if (error.includes('Host key verification failed.')) {
    return 'Host key verification failed.\nTry running ssh -T with the remote host.\n';
  }
  if (error.includes('Permission denied')) {
    return 'Permission denied.\nMake sure ssh-agent is running.\n';
  }
  return error;
}

export class GitAdapter implements IGitAdapter {
  private spawnGit(dir: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, GIT_SSH };
      const proc = spawn('git', args, { cwd: `${process.cwd()}/${dir}`, env });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });
      proc.on('error', reject);
      proc.on('close', () => resolve({ stdout, stderr: sshError(stderr) }));
    });
  }

  async commit(repo: string, message: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    const opts = { cwd: `${process.cwd()}/${repo}`, env: { ...process.env, GIT_SSH } };

    const addExitCode = await new Promise<number>(resolve => {
      const proc = spawn('git', ['add', '--all'], opts);
      proc.on('error', () => resolve(1));
      proc.on('exit', code => resolve(code ?? 1));
    });

    if (addExitCode !== 0) {
      result.error = `git add failed with exit code ${addExitCode}`;
      return result;
    }

    await new Promise<void>(resolve => {
      const proc = spawn('git', ['commit', '-m', message], opts);
      proc.on('error', err => { result.error = String(err); resolve(); });
      let buffer = '';
      proc.stdout.on('data', data => { buffer += data.toString(); });
      proc.stdout.on('end', () => {
        const lines = buffer.split('\n');
        lines.pop();
        const header = lines.shift()?.replace(/\[|\]/g, '').split(' ', 3);
        if (header && header[0] !== '#') {
          result.branch = header[0];
          result.commit = header[1];
          result.changes = lines;
        }
        resolve();
      });
    });

    return result;
  }

  async pull(repo: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    let output = '';

    await new Promise<void>(resolve => {
      const env = { ...process.env, GIT_SSH };
      const proc = spawn('git', ['pull'], { cwd: `${process.cwd()}/${repo}`, env });
      proc.stderr.on('data', data => { result.failed = true; output += data.toString(); });
      proc.stdout.on('data', data => { output += data.toString(); });
      proc.on('close', () => {
        if (output.includes('From ')) result.failed = false;
        result.msg = output;
        resolve();
      });
    });

    return result;
  }

  async push(repo: string, pushArgs: string[] = []): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    const { stderr } = await this.spawnGit(repo, ['push', ...pushArgs]);

    const prefix = stderr.substr(0, 2);
    if (prefix === 'Ev') {
      result.skipped = true;
    } else if (prefix === 'To') {
      const line = stderr.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
      if (line.startsWith('!')) {
        result.failed = true;
        result.msg = line + '\n';
      } else if (line.startsWith('* ')) {
        result.msg = line.substring(2);
      }
    } else if (stderr) {
      result.failed = true;
      result.msg = stderr;
    }

    return result;
  }

  async checkout(repo: string, options: string | string[]): Promise<GitOpResult> {
    const args = ['checkout', ...(Array.isArray(options) ? options : [options])];
    const result: GitOpResult = { name: repo };
    const { stdout, stderr } = await this.spawnGit(repo, args);

    const notWhitelisted = stderr.substr(0, 7) !== 'Already'
      && stderr.substr(0, 8) !== 'Switched' && stderr.substr(0, 8) !== 'Previous';

    if (stderr !== '' && notWhitelisted) {
      if (stderr.substr(7, 8) === 'pathspec' || stderr.startsWith('fatal: A branch named')) {
        result.skipped = true;
      } else {
        result.failed = true;
        result.msg = stderr.substr(7, stderr.length - 8);
      }
    } else {
      for (const line of stdout.split('\n')) {
        const matches = line.match(/^Your branch is (.+)$/);
        if (matches && !matches[1].startsWith('up-to-date')) {
          result.msg = matches[1];
        }
      }
    }

    return result;
  }

  async deleteBranch(repo: string, branch: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    const { stderr } = await this.spawnGit(repo, ['branch', '-D', branch]);

    if (stderr) {
      if (stderr.includes('not found.')) {
        result.skipped = true;
      } else {
        result.failed = true;
        result.msg = stderr;
      }
    }

    return result;
  }

  async merge(repo: string, branch: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    const { stdout, stderr } = await this.spawnGit(repo, ['merge', branch, '--no-ff']);

    if (stderr !== '') {
      if (stderr.includes('not something we can merge')) {
        result.skipped = true;
      } else if (stderr.includes('you have unmerged files')) {
        result.failed = true;
        result.msg = 'unmerged files';
      } else {
        result.failed = true;
        result.msg = stderr;
      }
    } else {
      for (const line of stdout.split('\n')) {
        if (line.startsWith('CONFLICT')) {
          result.failed = true;
          result.msg = 'conflict';
          break;
        }
      }
    }

    return result;
  }

  async diff(repo: string): Promise<string> {
    const { stdout } = await this.spawnGit(repo, ['diff']);
    return stdout
      .replace(/\n(---|\+\+\+) (a|b)\/(.+)/g, `\n$1 $2/${repo}/$3`)
      .replace(/(^|\n)(diff --git a\/)(.+ b\/)(.+)/g, `$1$2${repo}/$3${repo}/$4`);
  }

  async tag(repo: string, tagName: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    const { stderr } = await this.spawnGit(repo, ['tag', tagName]);

    if (stderr !== '') {
      if (stderr.includes('already exists')) {
        result.skipped = true;
      } else {
        result.failed = true;
        result.msg = stderr;
      }
    } else {
      result.msg = tagName;
    }

    return result;
  }

  async tagVersion(repo: string): Promise<GitOpResult> {
    const result: GitOpResult = { name: repo };
    let library: any;
    try {
      library = JSON.parse(fs.readFileSync(`${repo}/library.json`).toString());
    } catch (err: any) {
      result.failed = true;
      result.msg = err.message?.includes('no such file') ? 'not a library' : String(err.message);
      return result;
    }

    const version = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
    const { stderr } = await this.spawnGit(repo, ['tag', version]);

    if (stderr !== '') {
      if (stderr.includes('already exists')) {
        result.skipped = true;
      } else {
        result.failed = true;
        result.msg = stderr;
      }
    } else {
      result.msg = version;
    }

    return result;
  }
}
