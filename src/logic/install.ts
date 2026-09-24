import fs from 'fs';
import path from 'path';
import config from '../../configLoader.ts';
import { fromTemplate } from '../lib/h5p-utils.ts';
import type { RootRef, CoreRepo } from '../lib/h5p-utils.ts';
import type { DependencyMap } from '../lib/compute-dependencies.ts';
import { ui } from '../lib/ui.ts';
import { runPool, resolveConcurrency } from '../lib/pool.ts';
import { _exec, _killRunning } from './exec.ts';
import { download } from './repo.ts';
import { getRegistry, parseLibraryFolders } from './registry.ts';
import { computeDependencies } from './dependencies.ts';

type VerifySetupResult = {
  registry: boolean;
  libraries: Record<string, { optional: boolean; present: boolean }>;
  ok: boolean;
};

const _isMissingGitRef = (error: unknown): boolean =>
  error instanceof Error && /Remote branch .+ not found|couldn't find remote ref/i.test(error.message);

const _isMissingArchive = (error: unknown): boolean =>
  (error as { status?: number })?.status === 404;

// A ref the remote does not have, whichever transport reported it.
const _isMissingRef = (error: unknown): boolean =>
  _isMissingGitRef(error) || _isMissingArchive(error);

/* Folders this process created and has not finished installing into.
fs.existsSync(folder) is the whole already-installed test in _install, so a
half-written folder poisons every later run - it is reported as installed and
never built. Only folders _install created itself are tracked: one that was
already on disk belongs to the user, or to another library, and is never
removed. Paths are resolved on the way in, because config.folders.* are
cwd-relative and the sweep below runs at exit, arbitrarily later. */
export const _incomplete = new Set<string>();

const _discard = (folder: string): void => {
  _incomplete.delete(folder);
  try {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  catch (error) {
    // never mask the install failure that brought us here
    ui.warn(`could not remove ${folder}: ${(error as Error).message}`);
  }
};

export const _discardIncomplete = (): void => {
  for (const folder of [..._incomplete]) {
    _discard(folder);
  }
};

/* Registered after exec.ts's own exit hook (this module imports it), so running
children are killed before the folders they are writing into are removed. An
interrupt reaches this through exec.ts's SIGINT/SIGTERM handlers. */
process.on('exit', _discardIncomplete);

const _cloneCommand = (
  org: string,
  repo: string,
  branch: string,
  target: string,
): string =>
  `git clone ${fromTemplate(config.urls.library.clone, { org, repo })} ${target} --branch ${branch}`;

// Build a library in place, if it ships a build script.
const _build = async (folder: string, label: string): Promise<void> => {
  const packageFile = `${folder}/package.json`;
  if (!fs.existsSync(packageFile)) {
    return;
  }
  const info = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
  if (!info?.scripts?.build) {
    return;
  }
  /* npm ci first, because npm install rewrites package-lock.json. That single
  tracked file was enough to make a built library permanently unrefreshable:
  _update above refuses to pull anything with uncommitted changes, so every
  library with a build script became dirty on install and was then skipped by
  every later update. ci installs from the lockfile and never writes it. It
  needs a lockfile that matches package.json, so fall back where there is none
  or it has drifted - those libraries keep the old behaviour rather than
  failing. */
  const flags = '--ignore-scripts --no-audit --no-fund --progress=false';
  try {
    ui.debug(`npm ci ${flags}`);
    await _exec(`npm ci ${flags}`, folder);
  }
  catch {
    ui.debug(`npm install ${flags}`);
    await _exec(`npm install ${flags}`, folder);
  }
  ui.progress(label, 85);
  ui.debug('npm run build');
  await _exec('npm run build', folder);
  ui.progress(label, 100);
  // @todo: consider if we really want to delete node_modules. I think in most cases/workflows, we generally
  // want to keep it.
  fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
};

/* Refresh a library that is already on disk. Skip if it has uncommitted changes.
`org`/`repoName` are passed rather than a LibraryEntry: these are the only two
fields this path and _install below ever read, and h5p core installs repos that
have no registry entry to hand one from. */
const _update = async (repoName: string, label: string, listVersion: string, folder: string, build = true): Promise<void> => {
  // A folder may have been installed with download and not git. Skip update.
  // @todo: Should we convert it to git? Not what user expects. What if there are changes in the folder?
  if (!fs.existsSync(`${folder}/.git`)) {
    ui.warn(`skipping update for ${repoName}: ${folder} is not a git checkout`);
    return;
  }
  const dirty = (await _exec('git status --porcelain', folder)).trim();
  if (dirty) {
    ui.warn(`skipping update for ${repoName}: uncommitted changes in ${folder}`);
    return;
  }
  const branch = (await _exec('git rev-parse --abbrev-ref HEAD', folder)).trim();
  if (branch !== 'master') {
    ui.warn(`skipping update for ${repoName}: checked out on ${branch}, not master`);
    return;
  }
  ui.step(`~ updating to ${repoName} ${listVersion}`);
  const before = (await _exec('git rev-parse HEAD', folder)).trim();
  await _exec('git pull origin', folder);
  if ((await _exec('git rev-parse HEAD', folder)).trim() === before) {
    return;
  }
  if (!build) {
    return;
  }
  // new commits landed, so whatever was built from the old ones is now stale
  ui.progress(label, 60, { label: `${repoName} ${listVersion}` });
  try {
    await _build(folder, label);
  } finally {
    ui.progressDone(label);
  }
};

type InstallOptions = {
  latest?: boolean;
  isRootRef?: boolean;
  /* Off for `h5p core`. h5p-editor-php-library's build rewrites tracked files -
  webpack regenerates styles/css/application.css and npm install rewrites
  package-lock.json - so building on install leaves the checkout permanently
  dirty, and _update's dirty check then refuses to ever refresh it again. The
  repository ships its built CSS committed, which is what the CLI has always
  served, so there is nothing to gain by regenerating it. */
  build?: boolean;
};

const _install = async (
  action: 'clone' | 'download',
  org: string,
  repoName: string,
  label: string,
  listVersion: string,
  version: string,
  folder: string,
  { latest, isRootRef, build = true }: InstallOptions = {},
): Promise<void> => {
  const shown = latest ? listVersion : version;
  if (fs.existsSync(folder)) {
    if (latest && !process.env.H5P_NO_UPDATES) {
      await _update(repoName, label, listVersion, folder, build);
    }
    else {
      ui.step(`~ skipping updates for ${repoName} ${shown}`);
    }
    return;
  }
  ui.step(`+ installing ${repoName} ${shown}`);
  ui.progress(label, 0, { label: `${repoName} ${shown}` });
  const claim = path.resolve(folder);
  _incomplete.add(claim);
  try {
    // download cannot produce a git checkout, and the whole point of a root ref
    // is having the repo to work in — clone it even when download is requested
    const fetchAt = (ref: string): Promise<unknown> =>
      action === 'download' && !isRootRef
        ? download(org, repoName, ref, folder)
        : _exec(_cloneCommand(org, repoName, ref, label), config.folders.libraries);
    try {
      await fetchAt(version);
    }
    catch (error) {
      /* The root ref must exist. Deps may name a patch that was never tagged -
      H5P largely stopped tagging releases, so most of them do. Both transports
      hit this: a missing tag is a failed clone over git and a 404 on the
      archive URL over http. */
      if (isRootRef || version === 'master' || !_isMissingRef(error)) {
        throw error;
      }
      ui.warn(`${repoName} ${version} not found, falling back to master`);
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
      }
      await fetchAt('master');
    }
    ui.progress(label, 60);
    if (build) {
      await _build(folder, label);
    }
    _incomplete.delete(claim);
  }
  catch (error) {
    ui.warn(`removing incomplete ${folder}`);
    _discard(claim);
    throw error;
  }
  finally {
    // runs on the early returns above too, so no row is ever stranded
    ui.progressDone(label);
  }
};

/* Install an H5P library whose folder name we do not know yet.

`h5p core` fetches these without resolving anything, so nothing has told us that
h5p-math-display lives at H5P.MathDisplay-1.0 - the major.minor half of that name
is in the repository's own library.json. Reading it means cloning first, so the
clone is staged under temp/ and moved into place once the name is known.

The already-installed check is a single readdirSync against the machineName
prefix: no file reads, and deliberately not parseLibraryFolders, which calls
getRegistry and would put the network round trip we just removed straight back.
The prefix carries the separator, so H5P.Math- cannot match H5P.MathDisplay-1.0. */
const _installedLibraryFolder = (machineName: string): string | undefined => {
  if (!fs.existsSync(config.folders.libraries)) {
    return undefined;
  }
  return fs.readdirSync(config.folders.libraries).find((entry) => entry.startsWith(`${machineName}-`));
};

const _installLibraryRepo = async (
  org: string,
  repo: string,
  machineName: string,
  latest?: boolean,
): Promise<string> => {
  const installed = _installedLibraryFolder(machineName);
  if (installed) {
    const folder = `${config.folders.libraries}/${installed}`;
    if (latest && !process.env.H5P_NO_UPDATES) {
      await _update(repo, installed, 'master', folder);
    }
    else {
      ui.step(`~ skipping updates for ${repo} master`);
    }
    return installed;
  }
  ui.step(`+ installing ${repo} master`);
  ui.progress(repo, 0, { label: `${repo} master` });
  const staging = `${config.folders.temp}/${repo}_core`;
  const stagingClaim = path.resolve(staging);
  fs.rmSync(stagingClaim, { recursive: true, force: true });
  _incomplete.add(stagingClaim);
  let claim = stagingClaim;
  let label = repo;
  try {
    await _exec(_cloneCommand(org, repo, 'master', `${repo}_core`), config.folders.temp);
    const meta = JSON.parse(fs.readFileSync(`${staging}/library.json`, 'utf-8'));
    label = `${meta.machineName}-${meta.majorVersion}.${meta.minorVersion}`;
    const destination = path.resolve(`${config.folders.libraries}/${label}`);
    /* The claim moves with the folder rather than being released and re-taken:
    an interrupt between the two would leave whichever one is unclaimed behind. */
    _incomplete.add(destination);
    fs.renameSync(stagingClaim, destination);
    _incomplete.delete(stagingClaim);
    claim = destination;
    ui.progress(repo, 60, { label: `${label} master` });
    await _build(destination, repo);
    _incomplete.delete(destination);
  }
  catch (error) {
    ui.warn(`removing incomplete ${label}`);
    _discard(stagingClaim);
    if (claim !== stagingClaim) {
      _discard(claim);
    }
    throw error;
  }
  finally {
    ui.progressDone(repo);
  }
  return label;
};

/**
 * Fetches the repositories `h5p core` installs, all in one pool.
 *
 * None of them has a dependency graph worth resolving: the PHP core is not an H5P
 * library at all, and h5p-math-display declares no preloadedDependencies, no
 * editorDependencies and ships no semantics.json.
 *
 * @param items repositories to fetch; see CoreRepo for the two kinds
 * @param latest if true an existing checkout is refreshed rather than skipped
 * @param concurrency how many repositories to fetch at once
 * @returns the folder names now under the libraries folder, in the order requested
 */
export const installCore = async (items: CoreRepo[], latest?: boolean, concurrency?: number): Promise<string[]> => {
  const folders: string[] = new Array(items.length);
  const tasks = items.map((item, index) => async () => {
    if (item.machineName) {
      folders[index] = await _installLibraryRepo(item.org, item.repo, item.machineName, latest);
      return;
    }
    const target = item.target!;
    folders[index] = target;
    await _install(
      'clone',
      item.org,
      item.repo,
      target,
      'master',
      'master',
      `${config.folders.libraries}/${target}`,
      { latest, build: false },
    );
  });
  try {
    await runPool(tasks, resolveConcurrency(concurrency));
  }
  catch (error) {
    // siblings are still cloning or building; stop them so the CLI can exit
    _killRunning();
    throw error;
  }
  return folders;
};

/**
 * Installs an already-resolved dependency map into the libraries folder
 * @param action if dependencies should be installed with git or download
 * @param list a DependencyMap, as returned by computeDependencies
 * @param latest if true master branch versions of libraries are used
 * @param toSkip optional array of libraries to skip; after a library is parsed by the function it's auto-added to the array so it's skipped for efficiency
 * @param concurrency how many workers to run the task of installing
 * @returns
 */
export const installDependencies = async (action: 'clone' | 'download', list: DependencyMap, latest?: boolean, toSkip: string[] = [], concurrency?: number, rootRef?: RootRef): Promise<string[]> => {
  const tasks: Array<() => Promise<void>> = [];
  for (let item in list) {
    if (toSkip.indexOf(item) != -1) {
      continue;
    }
    toSkip.push(item);
    if (!list[item].id) {
      if (list[item].optional) {
        ui.info(`skipping optional unregistered ${item} library`);
        continue;
      }
      else {
        throw new Error(`unregistered ${item} library`);
      }
    }
    const entry = list[item];
    const label = `${entry.id}-${entry.version!.major}.${entry.version!.minor}`;
    const listVersion = `${entry.version!.major}.${entry.version!.minor}.${entry.version!.patch}`;
    const useRootRef = Boolean(rootRef && item === rootRef.library);
    const version = useRootRef ? rootRef!.ref : (latest ? 'master' : listVersion);
    const folder = `${config.folders.libraries}/${label}`;
    tasks.push(() => _install(action, entry.org, entry.repoName, label, listVersion, version, folder, { latest, isRootRef: useRootRef }));
  }
  try {
    await runPool(tasks, resolveConcurrency(concurrency));
  }
  catch (error) {
    // siblings are still cloning or building; stop them so the CLI can exit
    _killRunning();
    throw error;
  }
  return toSkip;
};

/* resolves a library's dependencies and installs them; kept as the public
one-shot entry point, now a thin pairing of the two halves above
mode - 'view' or 'edit' to fetch non-editor or editor libraries */
export const getWithDependencies = async (action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip: string[] = [], concurrency?: number): Promise<string[]> => {
  const list = await computeDependencies(library, mode ?? 'view');
  return installDependencies(action, list, latest, toSkip, concurrency);
};

/* checks if dependencies are installed for a given library;
returns a report with boolean statuses; the overall status is reflected under the "ok" attribute;
resolved - an already-computed edit graph for this library, to avoid resolving
it twice; the dev server checks setup on a page whose handler has just built
the very same graph */
export const verifySetup = async (library: string, resolved?: DependencyMap): Promise<VerifySetupResult> => {
  const registry = await getRegistry();
  const libraryDirs = await parseLibraryFolders();
  const libFolder = libraryDirs[registry.regular[library]?.id];
  const output: VerifySetupResult = {
    registry: registry.regular[library] ? true : false,
    libraries: {},
    ok: true,
  };
  if (!output.registry) {
    output.ok = false;
  }
  const list = resolved ?? await computeDependencies(library, 'edit', null, libFolder);
  for (let item in list) {
    if (!list[item]?.id) {
      output.libraries[item] = {
        optional: list[item].optional ?? false,
        present: false,
      };
      if (!list[item].optional) {
        output.ok = false;
      }
      continue;
    }
    const label = `${list[item].id}-${list[item].version!.major}.${list[item].version!.minor}`;
    output.libraries[label] = {
      optional: list[item].optional ?? false,
      present: fs.existsSync(`${config.folders.libraries}/${libraryDirs[list[item].id]}`),
    };
    if (!list[item].optional && !output.libraries[label].present) {
      output.ok = false;
    }
  }
  return output;
};
