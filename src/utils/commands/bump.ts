import * as output from '../utility/output.ts';
import Input from '../utility/input.ts';
import { getLibraryData } from '../utility/repository.ts';
import { execSync } from 'child_process';
import readline from 'readline';

const c = output.color;

async function bump(...inputList: string[]) {
  const autoYes = inputList.includes('--yes') || inputList.includes('-y');
  inputList = inputList.filter(arg => arg !== '--yes' && arg !== '-y');

  const input = new Input(inputList);
  await input.init(true);

  const lib = detectLibrary(input, inputList);
  if (!lib) {
    return;
  }

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

function detectLibrary(input: Input, requested: string[]): string | null {
  const libraries = input.getLibraries();
  if (!libraries.length) {
    // `Input` only keeps names that match a folder in cwd, so an unmatched name means the
    // library is not here — most often because cwd is not the libraries folder.
    const message = requested.length
      ? `${c.red}No library named ${c.emphasize}${requested[0]}${c.default}${c.red} in this folder.${c.default}`
      : `${c.red}No library given.${c.default}`;
    output.printLn(
      `${message} Run this from inside the libraries folder and name the library to bump, ` +
      `e.g. ${c.emphasize}h5p utils bump h5p-accordion${c.default}.`
    );
    return null;
  }
  output.printLn(`${c.blue}Bumping patch version of: ${c.emphasize}${libraries[0]}${c.default}`);
  return libraries[0];
}

function runH5pBump(lib: string): boolean {
  let bumpOutput = '';
  try {
    bumpOutput = execSync(`h5p utils increase-patch-version ${lib}`, { encoding: 'utf8' });
    output.printLn(bumpOutput.trim());
  }
  catch {
    output.printLn(`${c.red}Failed to bump version using h5p utils.${c.default}`);
    return false;
  }
  if (bumpOutput.includes('SKIPPED')) {
    output.printLn(`${c.yellow}Nothing to bump — skipping further steps.${c.default}`);
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
    output.printLn(`${c.red}Failed to read version from library.json.${c.default}`);
    return null;
  }
  const version = `${majorVersion}.${minorVersion}.${patchVersion}`;
  output.printLn(`${c.green}New version: ${version}${c.default}`);
  return version;
}

function stageChanges(lib: string, autoYes: boolean): boolean {
  try {
    execSync(`git restore --staged library.json`, { stdio: 'inherit', cwd: lib });
    if (autoYes) {
      output.printLn(`${c.yellow}Staging version bump automatically…${c.default}`);
      execSync(`git add library.json`, { stdio: 'inherit', cwd: lib });
    }
    else {
      output.printLn(`${c.yellow}Staging version bump interactively…${c.default}`);
      execSync(`git add -p library.json`, { stdio: 'inherit', cwd: lib });
    }
  }
  catch {
    output.printLn(`${c.red}Git staging failed.${c.default}`);
    return false;
  }

  const gitStatus = execSync(`git status --porcelain library.json`, { encoding: 'utf8', cwd: lib }).trim();
  if (!gitStatus) {
    output.printLn(`${c.yellow}No changes detected in library.json — nothing to commit.${c.default}`);
    return false;
  }

  return true;
}

function commitChanges(lib: string, version: string): boolean {
  try {
    execSync(`git commit -m "Bump to ${version}"`, { stdio: 'inherit', cwd: lib });
    output.printLn(`${c.green}Committed version bump to ${version}.${c.default}`);
  }
  catch {
    output.printLn(`${c.red}Git commit failed.${c.default}`);
    return false;
  }
  return true;
}

function tagAndPush(lib: string, version: string, doTag: boolean, doPush: boolean): void {
  let tagHandled = true;

  if (doTag) {
    try {
      execSync(`git tag -a ${version} -m "${version}"`, { stdio: 'inherit', cwd: lib });
      output.printLn(`${c.green}Tag ${version} created.${c.default}`);
    }
    catch {
      output.printLn(`${c.red}Git tag creation failed.${c.default}`);
      tagHandled = false;
    }
  }
  else {
    output.printLn(`${c.yellow}Tag creation skipped.${c.default}`);
  }

  if (doPush && tagHandled) {
    try {
      output.printLn(`${c.blue}Pushing commits…${c.default}`);
      execSync(`git push`, { stdio: 'inherit', cwd: lib });
      if (doTag) {
        output.printLn(`${c.blue}Pushing tag ${version}…${c.default}`);
        execSync(`git push origin ${version}`, { stdio: 'inherit', cwd: lib });
      }
      output.printLn(`${c.green}Changes pushed successfully.${c.default}`);
    }
    catch {
      output.printLn(`${c.red}Git push failed.${c.default}`);
    }
  }
  else if (doPush) {
    output.printLn(`${c.red}Skipping push due to tag failure.${c.default}`);
  }
  else {
    output.printLn(`${c.yellow}Push aborted.${c.default}`);
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
