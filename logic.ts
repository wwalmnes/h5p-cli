import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import config from './configLoader.ts';
import { upgradeContent } from './logic-content-upgrade.ts';
import { fromTemplate, parseGitUrl, machineToShort, normalizeRegistry } from './src/lib/h5p-utils.ts';
import { computeDependencies as _computeDependencies } from './src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, LibraryEntry, LibraryDependency, Registry, DependencyMap } from './src/lib/compute-dependencies.ts';
import { ui } from './src/lib/ui.ts';
import { runPool, resolveConcurrency } from './src/lib/pool.ts';
import type { ParsedGitUrl } from './src/lib/h5p-utils.ts';

type VerifySetupResult = {
  registry: boolean;
  libraries: Record<string, { optional: boolean; present: boolean }>;
  ok: boolean;
};

/** Map from machineName (or folder key) to folder name string */
type LibraryFolderMap = Record<string, string>;

// get file from source and optionally parse it as JSON
const getFile = async (source: string, parseJson?: boolean): Promise<string | object> => {
  const local = source.indexOf('http') !== 0 ? true : false;
  let output;
  if (local) {
    if (!fs.existsSync(source)) {
      return '';
    }
    output = fs.readFileSync(source, 'utf-8');
  }
  else {
    output = (await superAgent.get(source).set('User-Agent', 'h5p-cli').ok((res: any) => [200, 404].includes(res.status))).text;
  }
  if (output == '404: Not Found') {
    return '';
  }
  if (parseJson) {
    output = JSON.parse(output);
  }
  return output;
};
// clone repo and retrieve file
const getRepoFile = (gitUrl: string, path: string, branch = 'master', parseJson?: boolean, cleanStart?: boolean, shallow?: boolean): string | object => {
  const { repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
  const target = `${config.folders.temp}/${repoName}_${branch}`;
  const filePath = `${target}/${path}`;
  if (cleanStart) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(target)) {
    const depth = shallow ? ' --depth 1 --single-branch' : '';
    execSync(`git clone ${gitUrl} ${target} --branch ${branch}${depth}`, { stdio : 'pipe' }).toString();
  }
  if (!fs.existsSync(filePath)) {
    return '';
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return parseJson ? JSON.parse(data) : data;
};
// generates list of files and their relative paths in a folder tree
const getFileList = (folder: string): string[] => {
  const output: string[] = [];
  let toDo = [folder];
  let list: string[] = [];
  const compute = () => {
    for (let item of list) {
      const dirs = fs.readdirSync(item);
      for (let entry of dirs) {
        const file = `${item}/${entry}`;
        if (fs.lstatSync(file).isDirectory()) {
          toDo.push(file);
        }
        else {
          output.push(file);
        }
      }
    }
  };
  while (toDo.length) {
    list = toDo;
    toDo = [];
    compute();
  }
  return output;
};
/* Fetch a URL without collapsing the status. getFile() maps 404 to '', which is
also the correct answer for a library that legitimately has no semantics.json —
the metadata transport below has to tell those two cases apart. */
type RemoteFile = { status: number; text: string };
const getRemoteFile = async (url: string): Promise<RemoteFile> => {
  try {
    const res = await superAgent.get(url).set('User-Agent', 'h5p-cli').ok(() => true);
    return { status: res.status, text: res.text ?? '' };
  }
  catch {
    // DNS failure, TLS failure, offline: indistinguishable from "not reachable"
    return { status: 0, text: '' };
  }
};

// Per-repo transport decision, remembered for the life of the process.
type Transport = 'raw' | 'clone';
/* Scoped to the workspace for the same reason as the metadata memo: a "this
repo is reachable" verdict from one workspace must not decide another's. */
const _transport = new Map<string, Transport>();
const _transportKey = (org: string, repoName: string): string =>
  `${path.resolve(config.folders.temp)}|${org}/${repoName}`;

const _metaUrl = (org: string, repoName: string, version: string, file: string): string =>
  fromTemplate(
    file === 'library.json' ? config.urls.library.list : config.urls.library.semantics,
    { org, dep: repoName, version },
  );


// Cache the parsed metadata, in memory and on disk.
const _metaMemo = new Map<string, any>();

const _metaKey = (org: string, repoName: string, version: string, file: string): string =>
  `${path.resolve(config.folders.temp)}|${org}/${repoName}@${version}:${file}`;
const _metaCacheDir = (): string => `${config.folders.temp}/.metadata`;
const _metaCacheFile = (org: string, repoName: string, version: string, file: string): string =>
  `${_metaCacheDir()}/${org}__${repoName}__${version}__${file}`;

const readMetaCache = (org: string, repoName: string, version: string, file: string): any => {
  const key = _metaKey(org, repoName, version, file);
  if (_metaMemo.has(key)) {
    return _metaMemo.get(key);
  }
  const cached = _metaCacheFile(org, repoName, version, file);
  if (!fs.existsSync(cached)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(cached, 'utf-8');
    const value = raw === '' ? '' : JSON.parse(raw);
    _metaMemo.set(key, value);
    return value;
  }
  catch {
    // a truncated or corrupt cache entry must never be fatal; just re-fetch
    return undefined;
  }
};

const writeMetaCache = (org: string, repoName: string, version: string, file: string, value: any): any => {
  _metaMemo.set(_metaKey(org, repoName, version, file), value);
  try {
    fs.mkdirSync(_metaCacheDir(), { recursive: true });
    fs.writeFileSync(_metaCacheFile(org, repoName, version, file), value === '' ? '' : JSON.stringify(value));
  }
  catch {
    // an unwritable temp/ degrades to the in-memory memo, it is not an error
  }
  return value;
};

const getMetadataFile = async (org: string, repoName: string, version: string, file: string): Promise<any> => {
  const memo = readMetaCache(org, repoName, version, file);
  if (memo !== undefined) {
    return memo;
  }
  const gitUrl = fromTemplate(config.urls.library.clone, { org, repo: repoName });
  /* An existing temp clone is the metadata cache: honor it before any network
  call, so a warm temp/ resolves entirely offline exactly as it does today. */
  const cloned = `${config.folders.temp}/${repoName}_${version}`;
  if (fs.existsSync(cloned)) {
    return writeMetaCache(org, repoName, version, file, getRepoFile(gitUrl, file, version, true, false, true));
  }
  const key = _transportKey(org, repoName);
  if (process.env.H5P_NO_RAW) {
    _transport.set(key, 'clone');
  }
  if (_transport.get(key) !== 'clone') {
    const res = await getRemoteFile(_metaUrl(org, repoName, version, file));
    if (res.status === 200) {
      _transport.set(key, 'raw');
      return writeMetaCache(org, repoName, version, file, res.text ? JSON.parse(res.text) : '');
    }
    if (res.status === 404 && _transport.get(key) === 'raw') {
      return writeMetaCache(org, repoName, version, file, '');
    }
    _transport.set(key, 'clone');
  }
  return writeMetaCache(org, repoName, version, file, getRepoFile(gitUrl, file, version, true, false, true));
};

class DefaultComputeDependenciesPort implements IComputeDependenciesPort {
  getRegistry() { return logic.getRegistry(); }
  parseLibraryFolders() { return logic.parseLibraryFolders(); }
  getLibraryJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/library.json`, true) as Promise<any>;
    return getMetadataFile(org, repoName, version, 'library.json');
  }
  getSemanticsJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/semantics.json`, true) as Promise<any>;
    return getMetadataFile(org, repoName, version, 'semantics.json');
  }
  getTags(org: string, repo: string) { return logic.tags(org, repo); }
}

/* execSync output is noise unless something went wrong; ui.debug keeps it
behind --verbose. Trimmed because emit() terminates every line itself. */
const _debug = (output: string): void => {
  const trimmed = output.trim();
  if (trimmed) ui.debug(trimmed);
};

const _failed = (command: string, stderr: string): Error => {
  const detail = stderr.trim();
  return new Error(`Command failed: ${command}${detail ? `\n${detail}` : ''}`);
};

/* execSync inherits stderr, so git/npm write straight past ui — which both
leaks output under --quiet and shreds the live progress frame. spawnSync
captures both streams so everything reaches the terminal through emit().
*/
const _execSync = (command: string, cwd?: string): string => {
  const result = spawnSync(command, { shell: true, cwd, encoding: 'utf-8' });
  if (result.error) {
    throw result.error;
  }
  _debug(result.stdout ?? '');
  _debug(result.stderr ?? '');
  if (result.status !== 0) {
    throw _failed(command, result.stderr ?? '');
  }
  return result.stdout ?? '';
};

const _children = new Set<ReturnType<typeof spawn>>();

const _killRunning = (): void => {
  for (const child of _children) {
    child.kill();
  }
  _children.clear();
};

const _exec = (command: string, cwd?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, cwd });
    _children.add(child);
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf-8');
    child.stderr?.setEncoding('utf-8');
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      _children.delete(child);
      reject(error);
    });
    child.on('close', (status) => {
      _children.delete(child);
      _debug(stdout);
      _debug(stderr);
      if (status !== 0) {
        reject(_failed(command, stderr));
        return;
      }
      resolve(stdout);
    });
  });
};

// A version is either a branch name or a release tag, and GitHub files those
// under different ref namespaces.
const _archiveRef = (version: string): string =>
  /^\d+\.\d+\.\d+$/.test(version) ? `refs/tags/${version}` : `refs/heads/${version}`;

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
  ui.debug('npm install --ignore-scripts --no-audit --no-fund --progress=false');
  await _exec('npm install --ignore-scripts --no-audit --no-fund --progress=false', folder);
  ui.progress(label, 85);
  ui.debug('npm run build');
  await _exec('npm run build', folder);
  ui.progress(label, 100);
  // @todo: consider if we really want to delete node_modules. I think in most cases/workflows, we generally
  // want to keep it.
  fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
};

// Refresh a library that is already on disk. Skip if it has uncommitted changes.
const _update = async (entry: LibraryEntry, label: string, listVersion: string, folder: string): Promise<void> => {
  const dirty = (await _exec('git status --porcelain', folder)).trim();
  if (dirty) {
    ui.warn(`skipping update for ${entry.repoName}: uncommitted changes in ${folder}`);
    return;
  }
  const branch = (await _exec('git rev-parse --abbrev-ref HEAD', folder)).trim();
  if (branch !== 'master') {
    ui.warn(`skipping update for ${entry.repoName}: checked out on ${branch}, not master`);
    return;
  }
  ui.step(`~ updating to ${entry.repoName} ${listVersion}`);
  const before = (await _exec('git rev-parse HEAD', folder)).trim();
  await _exec('git pull origin', folder);
  if ((await _exec('git rev-parse HEAD', folder)).trim() === before) {
    return;
  }
  // new commits landed, so whatever was built from the old ones is now stale
  ui.progress(label, 60, { label: `${entry.repoName} ${listVersion}` });
  try {
    await _build(folder, label);
  } finally {
    ui.progressDone(label);
  }
};

const _install = async (
  action: 'clone' | 'download',
  entry: LibraryEntry,
  label: string,
  listVersion: string,
  version: string,
  folder: string,
  latest?: boolean,
): Promise<void> => {
  if (fs.existsSync(folder)) {
    if (latest && !process.env.H5P_NO_UPDATES) {
      await _update(entry, label, listVersion, folder);
    }
    else {
      ui.step(`~ skipping updates for ${entry.repoName} ${listVersion}`);
    }
    return;
  }
  ui.step(`+ installing ${entry.repoName} ${listVersion}`);
  ui.progress(label, 0, { label: `${entry.repoName} ${listVersion}` });
  try {
    if (action == 'download') {
      await logic.download(entry.org, entry.repoName, version, folder);
    }
    else {
      await _exec(_cloneCommand(entry.org, entry.repoName, version, label), config.folders.libraries);
    }
    ui.progress(label, 60);
    await _build(folder, label);
  } finally {
    // runs on the early returns above too, so no row is ever stranded
    ui.progressDone(label);
  }
};

const logic = {
  // imports content type from zip archive file in the .h5p format
  import: (folder: string, archive?: string): string => {
    const target = `${config.folders.temp}/${folder}`;
    new admZip(archive).extractAllTo(target);
    fs.renameSync(`${target}/content`, `content/${folder}`);
    fs.renameSync(`${target}/h5p.json`, `content/${folder}/h5p.json`);
    fs.rmSync(target, { recursive: true, force: true });
    return folder;
  },
  // creates zip archive export file in the .h5p format
  export: async (library: string, folder?: string): Promise<string> => {
    const registry = await logic.getRegistry();
    const libraryDirs = await logic.parseLibraryFolders();
    const libFolder = libraryDirs[registry.regular[library].id];
    const target = `${config.folders.temp}/${folder}`;
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target);
    fs.cpSync(`content/${folder}`, `${target}/content`, { recursive: true });
    fs.renameSync(`${target}/content/h5p.json`, `${target}/h5p.json`);
    fs.rmSync(`${target}/content/sessions`, { recursive: true, force: true });
    let libs = await logic.computeDependencies(library, 'view', null, libFolder);
    const editLibs = await logic.computeDependencies(library, 'edit', null, libFolder);
    libs = {...libs, ...editLibs};
    for (let item in libs) {
      const folder = libraryDirs[libs[item].id];
      fs.cpSync(`${config.folders.libraries}/${folder}`, `${target}/${folder}`, { recursive: true });
    }
    const files = getFileList(target);
    const zip = new admZip();
    for (let item of files) {
      const file = item;
      item = item.replace(target, '');
      const pathParts = item.split('/');
      const name = pathParts.pop();
      if (config.files.patterns.ignored.test(name) || !config.files.patterns.allowed.test(name)) {
        continue;
      }
      const pathStr = pathParts.join('/');
      zip.addLocalFile(file, pathStr);
    }
    const zipped = `${target}.h5p`;
    zip.writeZip(zipped);
    fs.rmSync(target, { recursive: true, force: true });
    return zipped;
  },
  /* retrieves list of h5p librarie
  ignoreFile - if true file is overwritten with online data */
  getRegistry: async (ignoreFile?: boolean): Promise<Registry> => {
    let list;
    if (!ignoreFile && fs.existsSync(config.registry)) {
      list = JSON.parse(fs.readFileSync(config.registry, 'utf-8'));
    }
    else {
      list = await getFile(config.urls.registry, true);
    }
    const output = normalizeRegistry(list) as Registry;
    if (ignoreFile) {
      fs.writeFileSync(config.registry, JSON.stringify(list));
    }
    return output;
  },
  /* computes list of library dependencies in their correct load order
  mode - 'view' or 'edit' to compute non-editor or editor dependencies
  version - optional version to compute; defaults to 'master'
  folder - optional local library folder to use instead of git repo; use "" to ignore */
  computeDependencies: (library: string, mode?: 'view' | 'edit', version?: string | null, folder?: string): Promise<DependencyMap> => {
    return _computeDependencies(library, mode ?? 'view', version, folder, new DefaultComputeDependenciesPort());
  },
  // list tags for library, straight off the remote
  tags: (org: string, repo: string): string[] => {
    const url = fromTemplate(config.urls.library.clone, { org, repo });
    // --refs drops the ^{} peeled duplicates annotated tags would otherwise add
    const output = _execSync(`git ls-remote --tags --refs ${url}`)
      .split('\n')
      .map(line => line.split('refs/tags/')[1]?.trim())
      .filter((tag): tag is string => Boolean(tag));
    output.sort((a, b) => {
      const aParts = a.split('.');
      const bParts = b.split('.');
      return (
        Number(bParts[0]) - Number(aParts[0]) ||
        Number(bParts[1]) - Number(aParts[1]) ||
        Number(bParts[2]) - Number(aParts[2])
      );
    });
    return output;
  },
  // download & unzip repository
  download: async (org: string, repo: string, version: string, target: string): Promise<void> => {
    const blob = (await superAgent.get(fromTemplate(config.urls.library.zip, { org, repo, ref: _archiveRef(version) })))._body;
    const work = `${config.folders.temp}/dl_${repo}_${version}`;
    const zipFile = `${work}.zip`;
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(work);
    fs.rmSync(zipFile, { force: true });
    const [root] = fs.readdirSync(work);
    fs.renameSync(`${work}/${root}`, target);
    fs.rmSync(work, { recursive: true, force: true });
  },
  // clone repository using git
  clone: (org: string, repo: string, branch: string, target: string): string => {
    return execSync(`git clone ${fromTemplate(config.urls.library.clone, {org, repo})} ${target} --branch ${branch}`, { cwd: config.folders.libraries }).toString();
  },
  /**
   * Installs an already-resolved dependency map into the libraries folder
   * @param action if dependencies should be installed with git or download
   * @param list a DependencyMap, as returned by computeDependencies
   * @param latest if true master branch versions of libraries are used
   * @param toSkip optional array of libraries to skip; after a library is parsed by the function it's auto-added to the array so it's skipped for efficiency 
   * @param concurrency how many workers to run the task of installing
   * @returns 
   */
  installDependencies: async (action: 'clone' | 'download', list: DependencyMap, latest?: boolean, toSkip: string[] = [], concurrency?: number): Promise<string[]> => {
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
      const version = latest ? 'master' : listVersion;
      const folder = `${config.folders.libraries}/${label}`;
      tasks.push(() => _install(action, entry, label, listVersion, version, folder, latest));
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
  },
  /* resolves a library's dependencies and installs them; kept as the public
  one-shot entry point, now a thin pairing of the two halves above
  mode - 'view' or 'edit' to fetch non-editor or editor libraries */
  getWithDependencies: async (action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip: string[] = [], concurrency?: number, version?: string): Promise<string[]> => {
    const list = await logic.computeDependencies(library, mode ?? 'view', version);
    return logic.installDependencies(action, list, latest, toSkip, concurrency);
  },
  /* checks if dependencies are installed for a given library;
  returns a report with boolean statuses; the overall status is reflected under the "ok" attribute;*/
  verifySetup: async (library: string): Promise<VerifySetupResult> => {
    const registry = await logic.getRegistry();
    const libraryDirs = await logic.parseLibraryFolders();
    const libFolder = libraryDirs[registry.regular[library].id];
    const output: VerifySetupResult = {
      registry: registry.regular[library] ? true : false,
      libraries: {},
      ok: true,
    };
    if (!output.registry) {
      output.ok = false;
    }
    let list = await logic.computeDependencies(library, 'view', null, libFolder);
    list = {...list, ...(await logic.computeDependencies(library, 'edit', null, libFolder))};
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
  },
  // generates h5p.json file with info describing the library in the specified folder
  generateInfo: async (folder: string, library: string): Promise<void> => {
    const registry = await logic.getRegistry();
    const libraryDirs = await logic.parseLibraryFolders();
    const libFolder = libraryDirs[registry.regular[library].id];
    const target = `content/${folder}`;
    let libs = await logic.computeDependencies(library, 'view', null, libFolder);
    const editLibs = await logic.computeDependencies(library, 'edit', null, libFolder);
    libs = {...libs, ...editLibs};
    const map: Record<string, boolean> = {};
    const preloadedDependencies: LibraryDependency[] = [];
    for (let item in libs) {
      for (let predep of libs[item].preloadedDependencies ?? []) {
        if (map[predep.machineName]) {
          continue;
        }
        map[predep.machineName] = true;
        preloadedDependencies.push(predep);
      }
    }
    preloadedDependencies.push({
      machineName: libs[library].id,
      minorVersion: libs[library].version!.minor,
      majorVersion: libs[library].version!.major,
    });
    const info = {
      title: folder,
      language: 'en',
      mainLibrary: libs[library].id,
      license: 'U',
      defaultLanguage: 'en',
      embedTypes: ['div'],
      preloadedDependencies
    };
    fs.writeFileSync(`${target}/h5p.json`, JSON.stringify(info));
  },
  // upgrades content via current main library upgrades.js scripts
  upgrade: async (folder: string, library: string): Promise<void> => {
    const registry = await logic.getRegistry();
    const libraryDirs = await logic.parseLibraryFolders();
    const libFolder = libraryDirs[registry.regular[library].id];
    const lib = (await logic.computeDependencies(library, 'view', null, libFolder))[library];
    const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
    /*
     * Content upgrade scripts are only supposed to be able to upgrade metadata attributed, @see https://github.com/h5p/h5p-php-library/blob/master/js/h5p-content-upgrade-process.js#L130-L132
     * and does not store all of them in h5p.json @see https://github.com/h5p/h5p-php-library/blob/d496868189f6bdb37a54138754cc31ac9cffc0ba/h5p.classes.php#L681
     * so we only need these.
     */
    const metadataAttributesInH5PJSON = [
      'title',
      'authors',
      'changes',
      'source',
      'license',
      'licenseVersion',
      'licenseExtras',
      'authorComments',
      'yearsFrom',
      'yearsTo',
    ];
    const metadata: Record<string, unknown> = {};
    for (let item of metadataAttributesInH5PJSON) {
      metadata[item] = info[item];
    }
    let mainLib: LibraryDependency = {
      machineName: '',
      majorVersion: 0,
      minorVersion: 0,
    };
    for (let item of info.preloadedDependencies) {
      if (item.machineName == lib.id) {
        mainLib = item;
        break;
      }
    }
    mainLib.majorVersion = Number(mainLib.majorVersion);
    mainLib.minorVersion = Number(mainLib.minorVersion);
    lib.version!.major = Number(lib.version!.major);
    lib.version!.minor = Number(lib.version!.minor);
    if (
      lib.version!.major <= mainLib.majorVersion &&
      lib.version!.minor <= mainLib.minorVersion
    ) {
      return;
    }
    const getUpgradesScript = (machineName: string) => {
      const upgradesFile = `${config.folders.libraries}/${libraryDirs[machineName]}/upgrades.js`;
      if (!fs.existsSync(upgradesFile)) {
        return;
      }
      return eval(fs.readFileSync(upgradesFile, 'utf-8'));
    };
    const getLatestLibraryVersion = (machineName: string) => {
      const libraryJson = `${config.folders.libraries}/${libraryDirs[machineName]}/library.json`;
      if (!fs.existsSync(libraryJson)) {
        return;
      }
      const version = JSON.parse(fs.readFileSync(libraryJson, 'utf-8'));
      return {
        major: parseInt(version.majorVersion),
        minor: parseInt(version.minorVersion),
      };
    };
    const contentFile = `content/${folder}/content.json`;
    let content: string | object = fs.readFileSync(contentFile, 'utf-8');
    const backupContent = content;
    content = JSON.parse(content);
    // Incorporate H5P.json info into general params structure to avoid extra handling
    const input = {
      params: content,
      metadata: metadata,
      library: `${info.mainLibrary} ${mainLib.majorVersion}.${mainLib.minorVersion}`,
    };
    const { params: upgradedParams, metadata: upgradedMetadata } =
      upgradeContent(input, getUpgradesScript, getLatestLibraryVersion) as {
        params: unknown;
        metadata: Record<string, unknown>;
      };
    for (let attribute in metadata) {
      if (
        upgradedMetadata[attribute] !== undefined &&
        upgradedMetadata[attribute] !== null
      ) {
        info[attribute] = upgradedMetadata[attribute];
      }
    }
    const label = `${mainLib.majorVersion}.${mainLib.minorVersion}`;
    fs.writeFileSync(`content/${folder}/${label}_content.json`, backupContent);
    fs.writeFileSync(
      `content/${folder}/${label}_h5p.json`,
      JSON.stringify(info),
    );
    fs.writeFileSync(contentFile, JSON.stringify(upgradedParams));
    logic.generateInfo(folder, library);
  },
  parseLibraryFolders: async (): Promise<LibraryFolderMap> => {
    const registry = await logic.getRegistry();
    const output: LibraryFolderMap = {};
    const dirs = fs.readdirSync(config.folders.libraries);
    for (let folder of dirs) {
      const libraryFile = `${config.folders.libraries}/${folder}/library.json`;
      if (!fs.existsSync(libraryFile)) {
        continue;
      }
      const info = (await getFile(libraryFile, true)) as any;
      const id = info.machineName;
      output[id] = folder;
      if (!registry.reversed[id]) {
        registry.reversed[id] = {
          id: id,
          title: info.title,
          author: info.author,
          runnable: info.runnable,
          shortName: machineToShort(id),
          org: '',
          repoName: '',
        };
        fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
        ui.info(`registered local library ${id}`);
      }
    }
    return output;
  },
  registryEntryFromRepoUrl: function (
    gitUrl: string,
  ): Record<string, LibraryEntry> {
    const { host, org, repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
    const list = getRepoFile(gitUrl, 'library.json', 'master', true) as any;
    const shortName = machineToShort(list.machineName);
    const type = host.split('.')[0];
    const output: Record<string, LibraryEntry> = {};
    output[list.machineName] = {
      id: list.machineName,
      title: list.title,
      repo: {
        type: type,
        url: `https://${host}/${org}/${repoName}`,
      },
      author: list.author,
      runnable: list.runnable,
      shortName,
      repoName,
      org,
    };
    return output;
  },
  getFile,
  getFileList,
};
export default logic;
