import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { requireWorkspaceRoot, requireLibrariesCwd } from '../../src/lib/workspace.ts';
import { createEmptyProject, createSeededProject, type Fixture } from '../helpers/fixture.ts';

/** Make `dir` look like a git checkout to `findReposSync`. */
function fakeCheckout(dir: string): void {
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.git', 'config'), '');
}

describe('working directory guards', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  describe('requireWorkspaceRoot', () => {
    it('passes when a libraries folder is present', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      process.chdir(fixture.dir);

      expect(() => requireWorkspaceRoot()).not.toThrow();
    });

    it('throws when there is no libraries folder', () => {
      fixture = createEmptyProject();
      process.chdir(fixture.dir);

      expect(() => requireWorkspaceRoot()).toThrow(/No "libraries" folder here/);
    });

    it('suggests "cd .." when run from inside the libraries folder', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      process.chdir(path.join(fixture.dir, 'libraries'));

      expect(() => requireWorkspaceRoot()).toThrow(/try "cd \.\." first/);
    });

    it('suggests "cd ../.." when run from inside a library', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      const libDir = path.join(fixture.dir, 'libraries', 'H5P.Accordion-1.0');
      fs.writeFileSync(path.join(libDir, 'library.json'), '{}');
      process.chdir(libDir);

      expect(() => requireWorkspaceRoot()).toThrow(/try "cd \.\.\/\.\." first/);
    });
  });

  describe('requireLibrariesCwd', () => {
    it('passes when cwd holds at least one git checkout', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      fakeCheckout(path.join(fixture.dir, 'libraries', 'H5P.Accordion-1.0'));
      process.chdir(path.join(fixture.dir, 'libraries'));

      expect(() => requireLibrariesCwd('git status')).not.toThrow();
    });

    it('names the command group in the error', () => {
      fixture = createEmptyProject();
      process.chdir(fixture.dir);

      expect(() => requireLibrariesCwd('git status')).toThrow(/"h5p git status" commands run from inside/);
    });

    it('suggests "cd libraries" when run from the workspace root', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      process.chdir(fixture.dir);

      expect(() => requireLibrariesCwd('utils validate')).toThrow(/try "cd libraries" first/);
    });

    it('suggests "cd .." when run from inside a library', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      const libDir = path.join(fixture.dir, 'libraries', 'H5P.Accordion-1.0');
      fs.writeFileSync(path.join(libDir, 'library.json'), '{}');
      process.chdir(libDir);

      expect(() => requireLibrariesCwd('utils validate')).toThrow(/try "cd \.\." first/);
    });

    it('does not count a plain folder as a checkout', () => {
      fixture = createSeededProject(['H5P.Accordion-1.0']);
      process.chdir(path.join(fixture.dir, 'libraries'));

      expect(() => requireLibrariesCwd('git status')).toThrow(/No git repositories found/);
    });
  });
});
