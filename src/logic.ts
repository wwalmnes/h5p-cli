// We're using this as a public entry point, kept for plugins and the dev server.
import { getFile, getFileList } from './h5p/files.ts';
import { tags, download, clone } from './h5p/repo.ts';
import { getRegistry, parseLibraryFolders, registryEntryFromRepoUrl } from './h5p/registry.ts';
import { computeDependencies } from './install/dependencies.ts';
import { installCore, installDependencies, getWithDependencies, verifySetup } from './install/install.ts';
import { importContent, exportContent, generateInfo, upgrade } from './content/content.ts';

const logic = {
  import: importContent,
  export: exportContent,
  getRegistry,
  computeDependencies,
  tags,
  download,
  clone,
  installCore,
  installDependencies,
  getWithDependencies,
  verifySetup,
  generateInfo,
  upgrade,
  parseLibraryFolders,
  registryEntryFromRepoUrl,
  getFile,
  getFileList,
};

export default logic;
