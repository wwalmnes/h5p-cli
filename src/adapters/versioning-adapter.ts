import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const GIT_SSH = path.resolve(__dirname, '..', 'utils', 'bin', 'h5p-ssh');

export interface IVersioningAdapter {
  readLibraryJson(repo: string): Promise<any>;
  writeLibraryJson(repo: string, data: any): Promise<void>;
  readSemanticsJson(repo: string): Promise<any>;
  writeSemanticsJson(repo: string, data: any): Promise<void>;
  isHeadDetached(repo: string): Promise<boolean>;
  gitDiff(repo: string, range: string): Promise<{ stdout: string; stderr: string }>;
  gitTagList(repo: string): Promise<string[]>;
  gitFirstCommit(repo: string): Promise<string>;
  gitDiffStat(repo: string, range: string): Promise<{ stdout: string; stderr: string }>;
  gitDiffStatBranches(repo: string): Promise<{ stdout: string; stderr: string }>;
  gitDescribeTag(repo: string): Promise<{ stdout: string; stderr: string }>;
  gitLogOneline(repo: string, range: string): Promise<{ stdout: string; stderr: string }>;
}

export class VersioningAdapter implements IVersioningAdapter {
  private spawnGit(dir: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, GIT_SSH };
      const proc = spawn('git', args, { cwd: `${process.cwd()}/${dir}`, env });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });
      proc.on('error', reject);
      proc.on('close', () => resolve({ stdout, stderr }));
    });
  }

  async readLibraryJson(repo: string): Promise<any> {
    try {
      return JSON.parse(fs.readFileSync(`${repo}/library.json`).toString());
    } catch (err: any) {
      const msg = err.toString();
      throw new Error(msg.includes('no such file') || msg.includes('not a directory') ? 'not a library' : msg);
    }
  }

  async writeLibraryJson(repo: string, data: any): Promise<void> {
    fs.writeFileSync(`${repo}/library.json`, JSON.stringify(data, null, 2));
  }

  async readSemanticsJson(repo: string): Promise<any> {
    try {
      return JSON.parse(fs.readFileSync(`${repo}/semantics.json`).toString());
    } catch (err: any) {
      const msg = err.toString();
      throw new Error(msg.includes('no such file') || msg.includes('not a directory') ? 'not a library' : msg);
    }
  }

  async writeSemanticsJson(repo: string, data: any): Promise<void> {
    fs.writeFileSync(`${repo}/semantics.json`, JSON.stringify(data, null, 2));
  }

  async isHeadDetached(repo: string): Promise<boolean> {
    const content = fs.readFileSync(`${repo}/.git/HEAD`).toString();
    return content.substr(0, 3) !== 'ref';
  }

  async gitDiff(repo: string, range: string): Promise<{ stdout: string; stderr: string }> {
    return this.spawnGit(repo, ['diff', range]);
  }

  async gitTagList(repo: string): Promise<string[]> {
    const { stdout } = await this.spawnGit(repo, ['tag', '-l', '--sort=version:refname']);
    return stdout.split('\n').filter(Boolean);
  }

  async gitFirstCommit(repo: string): Promise<string> {
    const { stdout } = await this.spawnGit(repo, ['rev-list', '--max-parents=0', 'HEAD']);
    return stdout.split('\n')[0];
  }

  async gitDiffStat(repo: string, range: string): Promise<{ stdout: string; stderr: string }> {
    return this.spawnGit(repo, ['diff', '--stat', `${range}..HEAD`]);
  }

  async gitDiffStatBranches(repo: string): Promise<{ stdout: string; stderr: string }> {
    return this.spawnGit(repo, ['diff', '--stat', 'master..release']);
  }

  async gitDescribeTag(repo: string): Promise<{ stdout: string; stderr: string }> {
    return this.spawnGit(repo, ['describe', '--abbrev=0', '--tags']);
  }

  async gitLogOneline(repo: string, range: string): Promise<{ stdout: string; stderr: string }> {
    return this.spawnGit(repo, ['log', '--oneline', `${range}..HEAD`]);
  }
}
