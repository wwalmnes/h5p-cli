import type { Registry } from './library-types.ts';
export type ParsedGitUrl = {
  host: string;
  org: string;
  repoName: string;
};

export type SemanticLibraryEntry = {
  name: string;
  version: string;
};

// builds content from template and input
export const fromTemplate = (template: string, input: Record<string, string>): string => {
  for (let item in input) {
    template = template.replaceAll(`{${item}}`, input[item]);
  }
  return template;
}

// retrieves org & repoName from git url
export const parseGitUrl = (gitUrl: string): ParsedGitUrl | undefined => {
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

// determines if provided path has duplicate entries; entries are separated by '/';
export const pathHasDuplicates = (path: string): boolean => {
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
export const parseSemanticLibraries = (entries: unknown): Record<string, SemanticLibraryEntry> => {
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

export const machineToShort = (machineName: string): string => {
  machineName = machineName.replace('H5PEditor', 'H5P-Editor');
  return machineName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace('.', '-');
}

// normalizes raw registry JSON into { regular, reversed } lookup maps
export const normalizeRegistry = (rawList: Record<string, any>): Registry => {
  const output = { regular: {} as Record<string, any>, reversed: {} as Record<string, any> };
  for (const item in rawList) {
    if (rawList[item].repo) {
      if (!rawList[item].repoName) {
        rawList[item].repoName = rawList[item].repo.url.split('/').slice(-1)[0];
      }
      if (!rawList[item].org) {
        rawList[item].org = rawList[item].repo.url.split('/').slice(3, 4)[0];
      }
    }
    if (!rawList[item].shortName) {
      rawList[item].shortName = rawList[item].repoName;
    }
    delete rawList[item].resume;
    delete rawList[item].fullscreen;
    delete rawList[item].xapiVerbs;
    output.reversed[rawList[item].id] = rawList[item];
    output.regular[rawList[item].shortName] = rawList[item];
  }
  return output;
}
