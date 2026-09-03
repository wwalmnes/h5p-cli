import fs from 'fs';
import { ui } from '../../lib/ui.ts';
import { splitLibrariesAndLanguages } from '../../lib/resolve-libraries.ts';
import { getLibraryData } from '../utility/repository.ts';
import { execSync } from 'child_process';
import readline from 'readline';

export type BumpOptions = {
  yes?: boolean;
};

async function bump(library: string, options: BumpOptions = {}) {
  const autoYes = options.yes ?? false;

  const lib = detectLibrary(library);

  if (!runH5pBump(lib)) {
    return;
  }

  // Like the other utils sweeps, this runs from inside `libraries/`, so the library is a
  // direct subfolder of cwd. Every git call below is scoped with `cwd` rather than by
  // chdir'ing the process.
  const version = getVersion(lib);
  if (!version) return;

  if (!stageChanges(lib, autoYes)) return;
  if (!commitChanges(lib, version)) return;

  if (autoYes) {
    tagAndPush(lib, version, true, true);
  }
  else {
    promptTagAndPush(lib, version);
  }
}

function detectLibrary(requested: string): string {
  // Only names matching a folder in cwd count, so an unmatched name means the
  // library is not here, most often because cwd is not the libraries folder.
  const names = requested ? [requested] : [];
  const { libraries } = splitLibrariesAndLanguages(names, fs.readdirSync('.'));

  if (!libraries.length) {
    const message = requested
      ? `No library named ${requested} in this folder.`
      : 'No library given.';
    throw new Error(
      `${message} Run this from inside the libraries folder and name the library to bump, ` +
      'e.g. h5p utils bump h5p-accordion.'
    );
  }

  ui.info(`Bumping patch version of: ${libraries[0]}`);
  return libraries[0];
}

function runH5pBump(lib: string): boolean {
  let bumpOutput = '';
  try {
    bumpOutput = execSync(`h5p utils increase-patch-version ${lib}`, { encoding: 'utf8' });
    ui.info(bumpOutput.trim());
  }
  catch {
    ui.error('Failed to bump version using h5p utils.');
    return false;
  }
  if (bumpOutput.includes('SKIPPED')) {
    ui.warn('Nothing to bump — skipping further steps.');
    return false;
  }
  return true;
}

function isValidSemver(...args: any[]): boolean {
  return args.every(n => typeof n === 'number');
}

function getVersion(lib: string): string | null {
  const libData = getLibraryData(lib);
  const { majorVersion, minorVersion, patchVersion } = libData;
  if (!isValidSemver(majorVersion, minorVersion, patchVersion)) {
    ui.error('Failed to read version from library.json.');
    return null;
  }
  const version = `${majorVersion}.${minorVersion}.${patchVersion}`;
  ui.success(`New version: ${version}`);
  return version;
}

function stageChanges(lib: string, autoYes: boolean): boolean {
  try {
    execSync(`git restore --staged library.json`, { stdio: 'inherit', cwd: lib });
    if (autoYes) {
      ui.warn('Staging version bump automatically…');
      execSync(`git add library.json`, { stdio: 'inherit', cwd: lib });
    }
    else {
      ui.warn('Staging version bump interactively…');
      execSync(`git add -p library.json`, { stdio: 'inherit', cwd: lib });
    }
  }
  catch {
    ui.error('Git staging failed.');
    return false;
  }

  const gitStatus = execSync(`git status --porcelain library.json`, { encoding: 'utf8', cwd: lib }).trim();
  if (!gitStatus) {
    ui.warn('No changes detected in library.json — nothing to commit.');
    return false;
  }

  return true;
}

function commitChanges(lib: string, version: string): boolean {
  try {
    execSync(`git commit -m "Bump to ${version}"`, { stdio: 'inherit', cwd: lib });
    ui.success(`Committed version bump to ${version}.`);
  }
  catch {
    ui.error('Git commit failed.');
    return false;
  }
  return true;
}

function tagAndPush(lib: string, version: string, doTag: boolean, doPush: boolean): void {
  let tagHandled = true;

  if (doTag) {
    try {
      execSync(`git tag -a ${version} -m "${version}"`, { stdio: 'inherit', cwd: lib });
      ui.success(`Tag ${version} created.`);
    }
    catch {
      ui.error('Git tag creation failed.');
      tagHandled = false;
    }
  }
  else {
    ui.warn('Tag creation skipped.');
  }

  if (doPush && tagHandled) {
    try {
      ui.info('Pushing commits…');
      execSync(`git push`, { stdio: 'inherit', cwd: lib });
      if (doTag) {
        ui.info(`Pushing tag ${version}…`);
        execSync(`git push origin ${version}`, { stdio: 'inherit', cwd: lib });
      }
      ui.success('Changes pushed successfully.');
    }
    catch {
      ui.error('Git push failed.');
    }
  }
  else if (doPush) {
    ui.error('Skipping push due to tag failure.');
  }
  else {
    ui.warn('Push aborted.');
  }
}

function promptTagAndPush(lib: string, version: string): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`Do you want to create a git tag for version ${version}? (y/n): `, tagAnswer => {
    const doTag = tagAnswer.trim().toLowerCase() === 'y';

    rl.question(`Do you want to push the changes? (y/n): `, pushAnswer => {
      const doPush = pushAnswer.trim().toLowerCase() === 'y';
      tagAndPush(lib, version, doTag, doPush);
      rl.close();
    });
  });
}

export default bump;
