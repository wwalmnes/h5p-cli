import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

describe('logic.getRegistry', () => {
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

  it('reads from local file when ignoreFile is false', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({
      'H5P.Blanks': { id: 'H5P.Blanks', shortName: 'h5p-blanks', org: 'h5p', repoName: 'h5p-blanks' },
    }));
    const registry = await logic.getRegistry(false);
    expect(registry.regular['h5p-blanks']).toBeDefined();
  });

  it('keys regular by shortName and reversed by id', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({
      'H5P.Blanks': { id: 'H5P.Blanks', shortName: 'h5p-blanks', org: 'h5p', repoName: 'h5p-blanks' },
    }));
    const registry = await logic.getRegistry(false);
    expect(registry.regular['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(registry.reversed['H5P.Blanks'].shortName).toBe('h5p-blanks');
  });

  it('derives repoName from repo.url when absent', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({
      'H5P.Test': {
        id: 'H5P.Test',
        shortName: 'h5p-test',
        org: 'h5p',
        repo: { type: 'github', url: 'https://github.com/h5p/h5p-test' },
      },
    }));
    const registry = await logic.getRegistry(false);
    expect(registry.regular['h5p-test'].repoName).toBe('h5p-test');
  });

  it('derives org from repo.url when absent', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({
      'H5P.Test': {
        id: 'H5P.Test',
        shortName: 'h5p-test',
        repoName: 'h5p-test',
        repo: { type: 'github', url: 'https://github.com/h5p/h5p-test' },
      },
    }));
    const registry = await logic.getRegistry(false);
    expect(registry.regular['h5p-test'].org).toBe('h5p');
  });

  it('falls back to repoName as shortName when shortName is absent', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({
      'H5P.Test': { id: 'H5P.Test', repoName: 'h5p-test', org: 'h5p' },
    }));
    const registry = await logic.getRegistry(false);
    expect(registry.regular['h5p-test']).toBeDefined();
    expect(registry.regular['h5p-test'].shortName).toBe('h5p-test');
  });
});
