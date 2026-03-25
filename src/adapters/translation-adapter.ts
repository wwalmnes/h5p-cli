import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const GIT_SSH = path.resolve(__dirname, '..', 'utils', 'bin', 'h5p-ssh');

export interface ITranslationAdapter {
  readSemanticsJson(repo: string): Promise<any>;
  readLanguageFile(repo: string, langCode: string): Promise<{ content?: any; error?: string }>;
  writeLanguageFile(repo: string, langCode: string, data: any): Promise<void>;
  writeSemanticsJson(repo: string, data: any): Promise<void>;
  readLanguageDir(repo: string): Promise<string[]>;
  readSourceLanguageDir(sourceDir: string, repo: string): Promise<string[]>;
  convertToUtf8(filePath: string): Promise<string>;
  getLastCommitInfo(repo: string, file: string): Promise<{ commit: string; date: string } | null>;
  appendToZip(archive: archiver.Archiver, filePath: string): Promise<boolean>;
  createZipArchive(outputPath: string): { archive: archiver.Archiver; waitForClose: Promise<void> };
  readRawFile(filePath: string): Promise<Buffer>;
}

export class TranslationAdapter implements ITranslationAdapter {
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

  async readSemanticsJson(repo: string): Promise<any> {
    const raw = fs.readFileSync(`${repo}/semantics.json`).toString();
    return JSON.parse(raw);
  }

  async readLanguageFile(repo: string, langCode: string): Promise<{ content?: any; error?: string }> {
    const filePath = `${repo}/language/${langCode}.json`;
    try {
      const raw = await fs.promises.readFile(filePath);
      return { content: JSON.parse(raw.toString()) };
    } catch (err: any) {
      const msg = err.toString();
      return { error: msg.includes('no such file') || msg.includes('not a directory') ? 'not a library' : msg };
    }
  }

  async writeLanguageFile(repo: string, langCode: string, data: any): Promise<void> {
    const json = JSON.stringify(data, null, 2) + '\n';
    await fs.promises.writeFile(`${repo}/language/${langCode}.json`, json);
  }

  async writeSemanticsJson(repo: string, data: any): Promise<void> {
    const json = JSON.stringify(data, null, 2) + '\n';
    await fs.promises.writeFile(`${repo}/semantics.json`, json);
  }

  async readLanguageDir(repo: string): Promise<string[]> {
    try {
      return await fs.promises.readdir(`${repo}/language`);
    } catch {
      return [];
    }
  }

  async readSourceLanguageDir(sourceDir: string, repo: string): Promise<string[]> {
    try {
      return await fs.promises.readdir(`${sourceDir}/${repo}/language`);
    } catch (err: any) {
      throw err;
    }
  }

  async convertToUtf8(filePath: string): Promise<string> {
    const charsetResult = await new Promise<string>((resolve, reject) => {
      const proc = spawn('file', ['-i', filePath], { env: process.env });
      let out = '';
      proc.stdout.on('data', data => { out += data.toString(); });
      proc.on('error', reject);
      proc.on('close', () => resolve(out));
    });

    const match = charsetResult.match(/charset=([^\n\r ]+)/);
    if (!match || !match[1]) throw new Error('unable to detect charset');

    return new Promise<string>((resolve, reject) => {
      const proc = spawn('iconv', ['-f', match[1], '-t', 'utf-8', filePath], { env: process.env });
      let out = '';
      let err = '';
      proc.stdout.on('data', data => { out += data.toString(); });
      proc.stderr.on('data', data => { err += data.toString(); });
      proc.on('error', reject);
      proc.on('close', () => err ? reject(new Error(err)) : resolve(out));
    });
  }

  async getLastCommitInfo(repo: string, file: string): Promise<{ commit: string; date: string } | null> {
    const { stdout } = await this.spawnGit(repo, ['log', '-n 1', '--format=%h %at ', file]);
    if (!stdout) return null;
    const parts = stdout.trim().split(' ');
    return { commit: parts[0], date: parts[1] };
  }

  async appendToZip(archive: archiver.Archiver, filePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath);
      archive.append(content, { name: filePath });
      return true;
    } catch {
      return false;
    }
  }

  createZipArchive(outputPath: string): { archive: archiver.Archiver; waitForClose: Promise<void> } {
    const output = fs.createWriteStream(outputPath);
    const arc = archiver('zip');
    const waitForClose = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      arc.on('error', reject);
    });
    arc.pipe(output);
    return { archive: arc, waitForClose };
  }

  async readRawFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }
}
