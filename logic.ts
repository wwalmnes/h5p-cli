// We're using this as a public entry point, kept for plugins and the dev server.
import { getFile, getFileList } from './src/logic/files.ts';
import { tags, download, clone } from './src/logic/repo.ts';
import { getRegistry, parseLibraryFolders, registryEntryFromRepoUrl } from './src/logic/registry.ts';
import { computeDependencies } from './src/logic/dependencies.ts';
import { installCore, installDependencies, getWithDependencies, verifySetup } from './src/logic/install.ts';
import { importContent, exportContent, generateInfo, upgrade } from './src/logic/content.ts';

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
