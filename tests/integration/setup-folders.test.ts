import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../src/config/loader.ts';
import { setupFolders } from '../../src/cli/setup-folders.ts';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

const INITIAL_DIRECTORIES = ['content', 'libraries', 'temp', 'uploads'];

describe('setupFolders integration', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let originalFolders: typeof config.folders;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    originalFolders = { ...config.folders };
    process.chdir(fixture.dir);
  });

  afterEach(() => {
    config.folders = originalFolders;
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  it('creates content, libraries, temp, uploads directories', () => {
    setupFolders();
    expect(fs.readdirSync(fixture.dir).sort()).toEqual(INITIAL_DIRECTORIES);
  });

  it('is idempotent (calling twice does not throw)', () => {
    setupFolders();
    expect(() => setupFolders()).not.toThrow();
    expect(fs.readdirSync(fixture.dir).sort()).toEqual(INITIAL_DIRECTORIES);
  });

  it('creates the libraries and temp folders a config.js names instead', () => {
    // config.js is merged into this same object when the loader is first imported.
    config.folders = { ...config.folders, libraries: 'libs', temp: 'scratch' };

    setupFolders();

    expect(fs.readdirSync(fixture.dir).sort()).toEqual(['content', 'libs', 'scratch', 'uploads']);
  });
});
