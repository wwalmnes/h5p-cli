import fs from 'fs';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import config from '../../configLoader.ts';
import { upgradeContent } from '../../logic-content-upgrade.ts';
import type { LibraryDependency } from '../lib/compute-dependencies.ts';
import { getFileList } from './files.ts';
import { getRegistry, parseLibraryFolders } from './registry.ts';
import { computeDependencies } from './dependencies.ts';

// imports content type from zip archive file in the .h5p format
export const importContent = (folder: string, archive?: string): string => {
  const target = `${config.folders.temp}/${folder}`;
  new admZip(archive).extractAllTo(target);
  fs.renameSync(`${target}/content`, `content/${folder}`);
  fs.renameSync(`${target}/h5p.json`, `content/${folder}/h5p.json`);
  fs.rmSync(target, { recursive: true, force: true });
  return folder;
};

// creates zip archive export file in the .h5p format
export const exportContent = async (library: string, folder?: string): Promise<string> => {
  const registry = await getRegistry();
  const libraryDirs = await parseLibraryFolders();
  const libFolder = libraryDirs[registry.regular[library].id];
  const target = `${config.folders.temp}/${folder}`;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target);
  fs.cpSync(`content/${folder}`, `${target}/content`, { recursive: true });
  fs.renameSync(`${target}/content/h5p.json`, `${target}/h5p.json`);
  fs.rmSync(`${target}/content/sessions`, { recursive: true, force: true });
  const libs = await computeDependencies(library, 'edit', null, libFolder);
  for (let item in libs) {
    if (!libs[item].id) {
      // unregistered dependency: reported by `h5p missing`, nothing on disk to pack
      continue;
    }
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
};

// generates h5p.json file with info describing the library in the specified folder
export const generateInfo = async (folder: string, library: string): Promise<void> => {
  const registry = await getRegistry();
  const libraryDirs = await parseLibraryFolders();
  const libFolder = libraryDirs[registry.regular[library].id];
  const target = `content/${folder}`;
  const libs = await computeDependencies(library, 'edit', null, libFolder);
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
};

// upgrades content via current main library upgrades.js scripts
export const upgrade = async (folder: string, library: string): Promise<void> => {
  const registry = await getRegistry();
  const libraryDirs = await parseLibraryFolders();
  const libFolder = libraryDirs[registry.regular[library].id];
  const lib = (await computeDependencies(library, 'view', null, libFolder))[library];
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
  generateInfo(folder, library);
};
