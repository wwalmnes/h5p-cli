import fs from 'fs';
import config from '../../configLoader.ts';
import { ui } from './ui.ts';
import { findReposSync } from './process-repos.ts';

/**
 * Working-directory conventions.
 *
 * Top-level `h5p` commands run from the **workspace root** — the folder holding
 * `libraries/`, `content/` and `temp/` — and resolve a library as
 * `${config.folders.libraries}/<name>`.
 *
 * `h5p git` and `h5p utils` subcommands are sweeps over a folder of checkouts, so they
 * run from **inside `libraries/`** and resolve a library as `<name>`.
 *
 * Both groups read the filesystem through bare relative paths, so getting this wrong used
 * to mean an empty result rather than an error. These guards turn that into a message.
 */

/** Throw unless cwd looks like the workspace root. */
export function requireWorkspaceRoot(): void {
  if (fs.existsSync(config.folders.libraries)) {
    return;
  }

  let hint = `Create it, or run "h5p core" from the folder you want to use as the workspace.`;
  if (fs.existsSync(`../${config.folders.libraries}`)) {
    hint = `It looks like you are inside "${config.folders.libraries}" — try "cd .." first.`;
  }
  else if (fs.existsSync('library.json')) {
    hint = `It looks like you are inside a library — try "cd ../.." first.`;
  }

  throw new Error(
    `No "${config.folders.libraries}" folder here.\n` +
    `Top-level h5p commands run from the workspace root, the folder that holds ` +
    `"${config.folders.libraries}", "content" and "${config.folders.temp}".\n${hint}`
  );
}

/** Throw unless cwd holds the library checkouts these sweeps operate on. */
export function requireLibrariesCwd(group: string): void {
  if (findReposSync().length) {
    return;
  }

  let hint = `Clone some libraries here first, e.g. with "h5p utils get <library>".`;
  if (fs.existsSync(config.folders.libraries)) {
    hint = `It looks like you are in the workspace root — try "cd ${config.folders.libraries}" first.`;
  }
  else if (fs.existsSync('library.json')) {
    hint = `It looks like you are inside a library — try "cd .." first.`;
  }

  throw new Error(
    `No git repositories found in the current folder.\n` +
    `"h5p ${group}" commands run from inside the "${config.folders.libraries}" folder, ` +
    `where each library is a direct subfolder.\n${hint}`
  );
}

/**
 * Run one of the guards above from a Commander `preAction` hook. Hooks run outside the
 * action handlers' try/catch, so a throw there would escape as an uncaught exception
 * instead of a `ui.error` line.
 */
export function enforce(guard: () => void): void {
  try {
    guard();
  } catch (error) {
    ui.error(error);
    process.exit(1);
  }
}
