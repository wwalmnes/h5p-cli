import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

describe('logic.import', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    fs.mkdirSync('temp', { recursive: true });
    fs.mkdirSync('content', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  function makeArchive(name: string): string {
    const archivePath = path.join(fixture.dir, `${name}.h5p`);
    const zip = new admZip();
    zip.addFile('content/content.json', Buffer.from('{"text":"hello"}'));
    zip.addFile('h5p.json', Buffer.from('{"title":"Test"}'));
    zip.writeZip(archivePath);
    return archivePath;
  }

  it('creates content/<folder>/content.json after import', () => {
    const archive = makeArchive('test');
    logic.import('test-content', archive);
    expect(fs.existsSync('content/test-content/content.json')).toBe(true);
  });

  it('moves h5p.json into the content folder', () => {
    const archive = makeArchive('test');
    logic.import('test-content', archive);
    expect(fs.existsSync('content/test-content/h5p.json')).toBe(true);
  });

  it('removes the temp extraction directory', () => {
    const archive = makeArchive('test');
    logic.import('test-content', archive);
    expect(fs.existsSync('temp/test-content')).toBe(false);
  });

  it('returns the folder name', () => {
    const archive = makeArchive('test');
    const result = logic.import('test-content', archive);
    expect(result).toBe('test-content');
  });
});
