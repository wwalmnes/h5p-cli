import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { setupFolders } from '../../src/lib/setup-folders';
import { createEmptyProject, type Fixture } from '../helpers/fixture';

const INITIAL_DIRECTORIES = ['content', 'libraries', 'temp', 'uploads'];

describe('setupFolders integration', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  it('creates content, libraries, temp, uploads directories', () => {
    setupFolders();
    for (const dir of INITIAL_DIRECTORIES) {
      expect(fs.existsSync(path.join(fixture.dir, dir))).toBe(true);
    }
  });

  it('is idempotent (calling twice does not throw)', () => {
    setupFolders();
    expect(() => setupFolders()).not.toThrow();
    for (const dir of INITIAL_DIRECTORIES) {
      expect(fs.existsSync(path.join(fixture.dir, dir))).toBe(true);
    }
  });
});
