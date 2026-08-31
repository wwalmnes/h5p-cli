import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import config from './configLoader.ts';
import { upgradeContent } from './logic-content-upgrade.cjs';
import { fromTemplate, parseGitUrl, machineToShort, normalizeRegistry } from './src/lib/h5p-utils.ts';
import { computeDependencies as _computeDependencies } from './src/lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, LibraryEntry, LibraryDependency, Registry, DependencyMap } from './src/lib/compute-dependencies.ts';
import { ui } from './src/lib/ui.ts';
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
const getRepoFile = (gitUrl: string, path: string, branch = 'master', parseJson?: boolean, cleanStart?: boolean): string | object => {
  const { repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
  const target = `${config.folders.temp}/${repoName}_${branch}`;
  const filePath = `${target}/${path}`;
  if (cleanStart) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(target)) {
    execSync(`git clone ${gitUrl} ${target} --branch ${branch}`, { stdio : 'pipe' }).toString();
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
class DefaultComputeDependenciesPort implements IComputeDependenciesPort {
  getRegistry() { return logic.getRegistry(); }
  parseLibraryFolders() { return logic.parseLibraryFolders(); }
  getLibraryJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/library.json`, true) as Promise<any>;
    return Promise.resolve(getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'library.json', version, true));
  }
  getSemanticsJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/semantics.json`, true) as Promise<any>;
    return Promise.resolve(getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'semantics.json', version, true));
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

Only for callers that cannot be async: logic.tags and logic.clone are reached
synchronously from computeDependencies via IComputeDependenciesPort.getTags,
and logic.clone is part of the public h5p-cli/logic surface. */
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

/* Same contract, but yields to the event loop so the live progress area keeps
animating through git and npm. Awaited in a for-loop, so execution order is
still strictly sequential — nothing overlaps. */
const _exec = (command: string, cwd?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, cwd });
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
    child.on('error', reject);
    child.on('close', (status) => {
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

const _cloneCommand = (
  org: string,
  repo: string,
  branch: string,
  target: string,
): string =>
  `git clone ${fromTemplate(config.urls.library.clone, { org, repo })} ${target} --branch ${branch}`;

const logic = {
  log: function (message: string): void {
    ui.info(message);
  },
  write: function (message: string): void {
    ui.info(message);
  },
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
  // list tags for library using git
  tags: (org: string, repo: string, mainBranch = 'master'): string[] => {
    getRepoFile(fromTemplate(config.urls.library.clone, { org, repo }), 'library.json', mainBranch, true);
    const label = `${repo}_${mainBranch}`;
    const folder = `${config.folders.temp}/${label}`;
    if (!fs.existsSync(folder)) {
      logic.clone(org, repo, mainBranch, label);
    }
    execSync(`git checkout ${mainBranch}`, { cwd: folder, stdio: 'pipe' });
    execSync(`git pull origin ${mainBranch}`, { cwd: folder, stdio: 'pipe' });
    const tags = _execSync('git tag', folder).split('\n');
    const output: string[] = [];
    for (let item of tags) {
      if (!item) {
        continue;
      }
      output.push(item);
    }
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
    const blob = (await superAgent.get(fromTemplate(config.urls.library.zip, { org, repo, version })))._body;
    const zipFile = `${config.folders.temp}/temp.zip`;
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(config.folders.libraries);
    fs.rmSync(zipFile);
    fs.renameSync(`${config.folders.libraries}/${repo}-master`, target);
  },
  // clone repository using git
  clone: (org: string, repo: string, branch: string, target: string): string => {
    return execSync(`git clone ${fromTemplate(config.urls.library.clone, {org, repo})} ${target} --branch ${branch}`, { cwd: config.folders.libraries }).toString();
  },
  /* clones/downloads dependencies to libraries folder using git and runs relevant npm commands
  mode - 'view' or 'edit' to fetch non-editor or editor libraries
  latest - if true master branch versions of libraries are used
  toSkip - optional array of libraries to skip; after a library is parsed by the function it's auto-added to the array so it's skipped for efficiency */
  getWithDependencies: async (action: 'clone' | 'download', library: string, mode?: 'view' | 'edit', latest?: boolean, toSkip: string[] = []): Promise<string[]> => {
    const list = await logic.computeDependencies(library, mode ?? 'view');
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
      const label = `${list[item].id}-${list[item].version!.major}.${list[item].version!.minor}`;
      const listVersion = `${list[item].version!.major}.${list[item].version!.minor}.${list[item].version!.patch}`;
      const version = latest ? 'master' : listVersion;
      const folder = `${config.folders.libraries}/${label}`;
      if (fs.existsSync(folder)) {
        if (latest && !process.env.H5P_NO_UPDATES) {
          ui.step(`~ updating to ${list[item].repoName} ${listVersion}`);
          await _exec('git checkout master', folder);
          await _exec('git pull origin', folder);
        }
        else {
          ui.step(
            `~ skipping updates for ${list[item].repoName} ${listVersion}`,
          );
        }
        continue;
      }
      ui.step(`+ installing ${list[item].repoName} ${listVersion}`);
      /* the percentages are milestones, not measurements: the zip archives
      carry no content-length, so there is nothing real to divide by */
      ui.progress(label, 0, { label: `${list[item].repoName} ${listVersion}` });
      try {
        if (action == 'download') {
          await logic.download(list[item].org, list[item].repoName, version, folder);
        }
        else {
          await _exec(
            _cloneCommand(list[item].org, list[item].repoName, 'master', label),
            config.folders.libraries,
          );
        }
        ui.progress(label, 60);
        const packageFile = `${folder}/package.json`;
        if (!fs.existsSync(packageFile)) {
          continue;
        }
        const info = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
        if (!info?.scripts?.build) {
          continue;
        }
        ui.debug('npm install --ignore-scripts');
        await _exec('npm install --ignore-scripts', folder);
        ui.progress(label, 85);
        ui.debug('npm run build');
        await _exec('npm run build', folder);
        ui.progress(label, 100);
        fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
      } finally {
        // runs on the `continue`s above too, so no row is ever stranded
        ui.progressDone(label);
      }
    }
    return toSkip;
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
