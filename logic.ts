import { execSync } from 'child_process';
import fs from 'fs';
import superAgent from 'superagent';
import admZip from 'adm-zip';
import config from './configLoader';
import { upgradeContent } from './logic-content-upgrade.js';

interface ParsedGitUrl {
  host: string;
  org: string;
  repoName: string;
}

interface LibraryVersion {
  major: number;
  minor: number;
  patch: number;
}

interface LibraryDependencyRef {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
}

interface LibraryEntry {
  id: string;
  title: string;
  author?: string;
  runnable?: number;
  fullscreen?: number;
  shortName: string;
  repoName: string; // @todo: can this be optional?
  org: string; // @todo: can this be optional?
  parent?: string;
  repo?: { type: string; url: string };
  requiredBy?: string[];
  optional?: boolean;
  // version is added by computeDependencies, not present in raw registry
  version?: LibraryVersion;
  preloadedJs?: Array<{ path: string }>;
  preloadedCss?: Array<{ path: string }>;
  preloadedDependencies?: LibraryDependencyRef[];
  editorDependencies?: LibraryDependencyRef[];
  metadataSettings?: any; // TODO: unknown structure from library.json
  level?: number;
}

interface Registry {
  regular: Record<string, LibraryEntry>;
  reversed: Record<string, LibraryEntry>;
}

/** Map from machineName (or folder key) to folder name string */
type LibraryFolderMap = Record<string, string>;

/** Result of computeDependencies: keyed by short library name */
type DependencyMap = Record<string, LibraryEntry>;

interface VerifySetupResult {
  registry: boolean;
  libraries: Record<string, { optional: boolean; present: boolean }>;
  ok: boolean;
}

interface SemanticLibraryEntry {
  name: string;
  version: string;
}

// builds content from template and input
const fromTemplate = (template: string, input: Record<string, string>): string => {
  for (let item in input) {
    template = template.replaceAll(`{${item}}`, input[item]);
  }
  return template;
}
// retrieves org & repoName from git url
const parseGitUrl = (gitUrl: string): ParsedGitUrl | undefined => {
  const type = gitUrl.slice(0, 4);
  switch (type) {
    case 'git@': {
      gitUrl = gitUrl.replace('git@', '');
      gitUrl = gitUrl.replace('.git', '');
      let pieces = gitUrl.split(':');
      const host = pieces[0];
      pieces = pieces[1].split('/');
      return {
        host,
        org: pieces[0],
        repoName: pieces[1]
      }
      break;
    }
    case 'http': {
      gitUrl = gitUrl.replace('https://', '');
      gitUrl = gitUrl.replace('.git', '');
      const pieces = gitUrl.split('/');
      return {
        host: pieces[0],
        org: pieces[1],
        repoName: pieces[2]
      }
      break;
    }
  }
}
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
}
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
}
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
  }
  while (toDo.length) {
    list = toDo;
    toDo = [];
    compute();
  }
  return output;
}
const logic = {
  // debug console log
  log: function (message: string): void {
    if (process.argv[2] === 'server') {
      return;
    }
    console.log(message);
  },
  // debug process.stdout.write
  write: function (message: string): void {
    if (process.argv[2] === 'server') {
      return;
    }
    process.stdout.write(message);
  },
  // imports content type from zip archive file in the .h5p format
  import: (folder: string, archive: string): string => {
    const target = `${config.folders.temp}/${folder}`;
    new admZip(archive).extractAllTo(target);
    fs.renameSync(`${target}/content`, `content/${folder}`);
    fs.renameSync(`${target}/h5p.json`, `content/${folder}/h5p.json`);
    fs.rmSync(target, { recursive: true, force: true });
    return folder;
  },
  // creates zip archive export file in the .h5p format
  export: async (library: string, folder: string): Promise<string> => {
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
    const output: Registry = {
      regular: {},
      reversed: {}
    }
    for (let item in list) {
      if (list[item].repo) {
        if (!list[item].repoName) {
          list[item].repoName = list[item].repo.url.split('/').slice(-1)[0];
        }
        if (!list[item].org) {
          list[item].org = list[item].repo.url.split('/').slice(3, 4)[0];
        }
      }
      if (!list[item].shortName) {
        list[item].shortName = list[item].repoName;
      }
      delete list[item].resume;
      delete list[item].fullscreen;
      delete list[item].xapiVerbs;
      output.reversed[list[item].id] = list[item];
      output.regular[list[item].shortName] = list[item];
    }
    if (ignoreFile) {
      fs.writeFileSync(config.registry, JSON.stringify(list));
    }
    return output;
  },
  /* computes list of library dependencies in their correct load order
  mode - 'view' or 'edit' to compute non-editor or editor dependencies
  version - optional version to compute; defaults to 'master'
  folder - optional local library folder to use instead of git repo; use "" to ignore */
  computeDependencies: async (library: string, mode: 'view' | 'edit', version?: string | null, folder?: string): Promise<DependencyMap> => {
    logic.log(`> ${library} deps ${mode}`);
    version = version || 'master';
    let level = -1;
    let registry: Registry = { regular: {}, reversed: {} };
    const toDo: Record<string, { parent: string; version: string; folder: string | undefined }> = {};
    const cache: Record<string, any> = {}; // TODO: complex mutable object with mixed library.json and computed fields
    const done: Record<number, DependencyMap> = {};
    const weights: Record<string, number> = {};
    toDo[library] = {
      parent: '',
      version,
      folder
    };
    const libraryDirs = await logic.parseLibraryFolders();
    const getOptionals = async (dep: string, org: string, repoName: string, version: string, dir: string | null | undefined) => {
      if (cache[dep].optionals) {
        return cache[dep].optionals;
      }
      cache[dep].semantics = dir ? await getFile(`${config.folders.libraries}/${dir}/semantics.json`, true)
        : getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'semantics.json', version, true);
      cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
      return cache[dep].optionals;
    }
    const latestPatch = (org: string, repo: string, version: string) => {
      const tags = logic.tags(org, repo);
      let patch = -1;
      for (let item of tags) {
        if (item.indexOf(version) != 0) {
          continue;
        }
        const numbers = item.split('.');
        if (numbers.length < 3) {
          continue;
        }
        if (parseInt(numbers[2]) > patch) {
          patch = parseInt(numbers[2]);
          break;
        }
      }
      return patch > -1 ? `${version}.${patch}` : version;
    }
    // determine if dependency needs to be processed
    const handleDepListEntry = (machineName: string, parent: string, ver: string, dir: string | null | undefined) => {
      const lib = registry.reversed[machineName];
      const entry = lib?.shortName;
      if (!entry) {
        const optional = isOptional(cache[parent], machineName);
        if (!done[level][machineName] || done[level][machineName].optional) {
          done[level][machineName] = { optional, parent } as any as LibraryEntry;
        }
        const parentVersion = `${done[level][parent].version.major}.${done[level][parent].version.minor}.${done[level][parent].version.patch}`;
        process.stdout.write(`\n!!! ${optional ? 'optional' : 'required'} library ${machineName} ${ver} not found in registry; required by ${parent} (${parentVersion}) `);
        return;
      }
      const version = ver == 'master' ? ver : latestPatch(lib.org, entry, ver);
      if (!done[level][entry]?.id && !toDo[entry]?.parent) {
        toDo[entry] = { parent, version, folder: dir };
      }
      weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
      return;
    }
    // determine if a library is a soft dependency of its parent
    const isOptional = (parent: LibraryEntry | undefined, machineName: string) => {
      if (!parent) {
        return false;
      }
      if (parent && parent.optional) {
        return true;
      }
      const finder = (element: LibraryDependencyRef) => element.machineName === machineName;
      if (parent?.preloadedDependencies?.find(finder) !== undefined || parent?.editorDependencies?.find(finder) !== undefined) {
        return false;
      }
      return true;
    }
    const compute = async (org: string, dep: string, version: string) => {
      const parent = toDo[dep].parent ? `/${toDo[dep].parent}` : '';
      const lastParent = registry.regular[toDo[dep].parent]?.requiredBy[registry.regular[toDo[dep].parent]?.requiredBy.length - 1] || '';
      const requiredByPath = lastParent + parent;
      if (pathHasDuplicates(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      if (registry.regular[dep].requiredBy && registry.regular[dep].requiredBy.includes(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      done[level][dep] = registry.regular[dep];
      let list;
      const { repoName } = registry.regular[dep]?.repo?.url ? parseGitUrl(registry.regular[dep].repo.url) as ParsedGitUrl : { repoName: dep };
      if (cache[dep]) {
        list = cache[dep];
      }
      else {
        list = toDo[dep].folder ? await getFile(`${config.folders.libraries}/${toDo[dep].folder}/library.json`, true)
          : getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'library.json', version, true);
        cache[dep] = list;
      }
      if (!list.title) {
        throw new Error(`missing library.json for ${toDo[dep].folder || dep}`);
      }
      done[level][dep].title = list.title;
      done[level][dep].version = {
        major: list.majorVersion,
        minor: list.minorVersion,
        patch: list.patchVersion
      }
      done[level][dep].runnable = list.runnable;
      done[level][dep].fullscreen = list.fullscreen;
      done[level][dep].optional = registry.regular[dep].optional === false ? false : isOptional(cache[toDo[dep].parent], list.machineName);
      cache[dep].optional = done[level][dep].optional;
      logic.write(`>> ${dep} required by ${toDo[dep].parent} (${done[level][dep].optional ? 'optional' : 'required'}) ... `);
      done[level][dep].preloadedJs = list.preloadedJs || [];
      done[level][dep].preloadedCss = list.preloadedCss || [];
      done[level][dep].preloadedDependencies = list.preloadedDependencies || [];
      done[level][dep].editorDependencies = list.editorDependencies || [];
      done[level][dep].metadataSettings = list.metadataSettings;
      if (!done[level][dep].requiredBy) {
        done[level][dep].requiredBy = [];
      }
      done[level][dep].requiredBy.push(requiredByPath);
      done[level][dep].level = level;
      let ver = version == 'master' ? version : `${done[level][dep].version.major}.${done[level][dep].version.minor}.${done[level][dep].version.patch}`;
      const optionals = await getOptionals(dep, org, repoName, ver, toDo[dep].folder);
      if (list.preloadedDependencies) {
        for (let item of list.preloadedDependencies) {
          ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
          const dir = folder ? libraryDirs[item.machineName] : null;
          handleDepListEntry(item.machineName, dep, ver, dir);
        }
      }
      for (let item in optionals) {
        ver = version == 'master' ? version : optionals[item].version;
        const dir = folder ? libraryDirs[item] : null;
        handleDepListEntry(item, dep, ver, dir);
      }
      if (mode == 'edit' && list.editorDependencies) {
        for (let item of list.editorDependencies) {
          ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
          const dir = folder ? libraryDirs[item.machineName] : null;
          handleDepListEntry(item.machineName, dep, ver, dir);
        }
      }
      delete toDo[dep];
      logic.log('done');
    }
    registry = await logic.getRegistry();
    if (!folder && !registry.regular[library]) {
      throw new Error(`unregistered ${library} library`);
    }
    while (Object.keys(toDo).length) {
      level++;
      logic.log(`>> on level ${level}`);
      done[level] = {};
      for (let item in toDo) {
        await compute(registry.regular[item].org, item, toDo[item].version);
      }
    }
    let output: DependencyMap = {};
    for (let i = level; i >= 0; i--) {
      const keys = Object.keys(done[i]);
      keys.sort((a, b) => {
        return weights[b] - weights[a];
      });
      for (let key of keys) {
        if (!output[key] || output[key]?.optional) {
          output[key] = done[i][key];
        }
        if (!done[i][key].id) {
          continue;
        }
      }
    }
    logic.write('\n');
    return output;
  },
  // list tags for library using git
  tags: (org: string, repo: string, mainBranch = 'master'): string[] => {
    const library = getRepoFile(fromTemplate(config.urls.library.clone, { org, repo }), 'library.json', mainBranch, true);
    const label = `${repo}_${mainBranch}`;
    const folder = `${config.folders.temp}/${label}`;
    if (!fs.existsSync(folder)) {
      logic.clone(org, repo, mainBranch, label);
    }
    execSync(`git checkout ${mainBranch}`, { cwd: folder, stdio : 'pipe' });
    execSync(`git pull origin ${mainBranch}`, { cwd: folder, stdio : 'pipe' });
    const tags = execSync('git tag', { cwd: folder }).toString().split('\n');
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
      return Number(bParts[0]) - Number(aParts[0]) || Number(bParts[1]) - Number(aParts[1]) || Number(bParts[2]) - Number(aParts[2]);
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
  getWithDependencies: async (action: 'clone' | 'download', library: string, mode: 'view' | 'edit', latest: boolean, toSkip: string[] = []): Promise<string[]> => {
    const list = await logic.computeDependencies(library, mode);
    for (let item in list) {
      if (toSkip.indexOf(item) != -1) {
        continue;
      }
      toSkip.push(item);
      if (!list[item].id) {
        if (list[item].optional) {
          console.log(`> skipping optional unregistered ${item} library`);
          continue;
        }
        else {
          throw new Error(`unregistered ${item} library`);
        }
      }
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      const listVersion = `${list[item].version.major}.${list[item].version.minor}.${list[item].version.patch}`;
      const version = latest ? 'master' : listVersion;
      const folder = `${config.folders.libraries}/${label}`;
      if (fs.existsSync(folder)) {
        if (latest && !process.env.H5P_NO_UPDATES) {
          console.log(`>> ~ updating to ${list[item].repoName} ${listVersion}`);
          execSync(`git checkout master`, { cwd: folder, stdio : 'pipe' });
          console.log(execSync('git pull origin', { cwd: folder }).toString());
        }
        else {
          console.log(`>> ~ skipping updates for ${list[item].repoName} ${listVersion}`);
        }
        continue;
      }
      console.log(`>> + installing ${list[item].repoName} ${listVersion}`);
      if (action == 'download') {
        await logic.download(list[item].org, list[item].repoName, version, folder);
      }
      else {
        console.log(logic.clone(list[item].org, list[item].repoName, version, label));
      }
      const packageFile = `${folder}/package.json`;
      if (!fs.existsSync(packageFile)) {
        continue;
      }
      const info = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
      if (!info?.scripts?.build) {
        continue;
      }
      console.log('>>> npm install --ignore-scripts');
      console.log(execSync('npm install --ignore-scripts', {cwd: folder}).toString());
      console.log('>>> npm run build');
      console.log(execSync('npm run build', {cwd: folder}).toString());
      fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
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
      ok: true
    }
    if (!output.registry) {
      output.ok = false;
    }
    let list = await logic.computeDependencies(library, 'view', null, libFolder);
    list = {...list, ...await logic.computeDependencies(library, 'edit', null, libFolder)};
    for (let item in list) {
      if (!list[item]?.id) {
        output.libraries[item] = {
          optional: list[item].optional,
          present: false
        }
        if (!list[item].optional) {
          output.ok = false;
        }
        continue;
      }
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      output.libraries[label] = {
        optional: list[item].optional,
        present: fs.existsSync(`${config.folders.libraries}/${libraryDirs[list[item].id]}`)
      }
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
    const preloadedDependencies: LibraryDependencyRef[] = [];
    for (let item in libs) {
      for (let predep of libs[item].preloadedDependencies) {
        if (map[predep.machineName]) {
          continue;
        }
        map[predep.machineName] = true;
        preloadedDependencies.push(predep);
      }
    }
    preloadedDependencies.push({
      machineName: libs[library].id,
      minorVersion: libs[library].version.minor,
      majorVersion: libs[library].version.major,
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
      'title', 'authors', 'changes', 'source', 'license', 'licenseVersion', 'licenseExtras', 'authorComments',
      'yearsFrom', 'yearsTo'
    ];
    const metadata: Record<string, unknown> = {};
    for (let item of metadataAttributesInH5PJSON) {
      metadata[item] = info[item];
    }
    let mainLib: LibraryDependencyRef & { machineName: string } = { machineName: '', majorVersion: 0, minorVersion: 0 };
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
    if (lib.version.major <= mainLib.majorVersion && lib.version.minor <= mainLib.minorVersion) {
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
        minor: parseInt(version.minorVersion)
      };
    }
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
      upgradeContent(input, getUpgradesScript, getLatestLibraryVersion);
    for (let attribute in metadata) {
      if (upgradedMetadata[attribute] !== undefined && upgradedMetadata[attribute] !== null) {
        info[attribute] = upgradedMetadata[attribute];
      }
    }
    const label = `${mainLib.majorVersion}.${mainLib.minorVersion}`;
    fs.writeFileSync(`content/${folder}/${label}_content.json`, backupContent);
    fs.writeFileSync(`content/${folder}/${label}_h5p.json`, JSON.stringify(info));
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
      const info = await logic.getFile(libraryFile, true) as any;
      const id = info.machineName;
      output[id] = folder;
      if (!registry.reversed[id]) {
        registry.reversed[id] =
        {
          "id": id,
          "title": info.title,
          "author": info.author,
          "runnable": info.runnable,
          "shortName": logic.machineToShort(id),
          "org": "",
          "repoName": ""
        }
        fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
        console.log(`> registered local library ${id}`);
      }
    }
    return output;
  },
  machineToShort: (machineName: string): string => {
    machineName = machineName.replace('H5PEditor', 'H5P-Editor');
    return machineName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace('.', '-');
  },
  registryEntryFromRepoUrl: function(gitUrl: string): Record<string, LibraryEntry> {
    const { host, org, repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
    const list = getRepoFile(gitUrl, 'library.json', 'master', true) as any;
    const shortName = logic.machineToShort(list.machineName);
    const type = host.split('.')[0];
    const output: Record<string, LibraryEntry> = {};
    output[list.machineName] = {
      id: list.machineName,
      title: list.title,
      repo: {
        type: type,
        url: `https://${host}/${org}/${repoName}`
      },
      author: list.author,
      runnable: list.runnable,
      shortName,
      repoName,
      org
    }
    return output;
  },
  fromTemplate,
  parseGitUrl,
  getFile,
  getFileList
}
// determines if provided path has duplicate entries; entries are separated by '/';
const pathHasDuplicates = (path: string): boolean => {
  const ledger: Record<string, boolean> = {};
  const list = path.split('/');
  for (let item of list) {
    if (ledger[item]) {
      return true;
    }
    else {
      ledger[item] = true;
    }
  }
  return false;
}
// parses semantics array of objects for entries of library type
const parseSemanticLibraries = (entries: unknown): Record<string, SemanticLibraryEntry> => {
  if (!Array.isArray(entries)) {
    return {};
  }
  let toDo: unknown[] = [];
  let list: unknown[] = [];
  const output: Record<string, SemanticLibraryEntry> = {};
  const parseList = () => {
    toDo = [];
    for (const objRaw of list) { // go through semantics array entries
      const obj = objRaw as any;
      if (obj?.type === 'library' && Array.isArray(obj?.options)) {
        for (let lib of obj.options) {
          const parts = lib.split(' ');
          output[parts[0]] = {
            name: parts[0],
            version: parts[1]
          };
        }
        continue;
      }
      for (let attr in obj) { // go through entry attributes
        if (attr === 'fields' && Array.isArray(obj[attr])) {
          for (let item of obj[attr]) {
            if (item?.type === 'library' && Array.isArray(item?.options)) {
              for (let lib of item.options) {
                const parts = lib.split(' ');
                output[parts[0]] = {
                  name: parts[0],
                  version: parts[1]
                };
              }
            }
            else {
              toDo.push(item);
            }
          }
        }
        if (typeof obj[attr] === 'object' && !Array.isArray(obj[attr])) {
          toDo.push(obj[attr]);
        }
      }
    }
    list = toDo;
  }
  list = entries;
  while (list.length) {
    parseList();
  }
  return output;
}
export default logic;
