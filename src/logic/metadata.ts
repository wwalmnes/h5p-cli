import fs from 'fs';
import path from 'path';
import config from '../../configLoader.ts';
import { fromTemplate, isPinnedRelease, sanitizeRefForPath } from '../lib/h5p-utils.ts';
import { getRemoteFile } from './files.ts';
import { getRepoFile, _refreshClone } from './repo.ts';

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
  if (!isPinnedRelease(version)) {
    return undefined;
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
  if (!isPinnedRelease(version)) {
    return value;
  }
  try {
    fs.mkdirSync(_metaCacheDir(), { recursive: true });
    fs.writeFileSync(_metaCacheFile(org, repoName, version, file), value === '' ? '' : JSON.stringify(value));
  }
  catch {
    // an unwritable temp/ degrades to the in-memory memo, it is not an error
  }
  return value;
};

export const getMetadataFile = async (org: string, repoName: string, version: string, file: string): Promise<any> => {
  const memo = readMetaCache(org, repoName, version, file);
  if (memo !== undefined) {
    return memo;
  }

  const gitUrl = fromTemplate(config.urls.library.clone, { org, repo: repoName });
  const cloned = `${config.folders.temp}/${repoName}_${sanitizeRefForPath(version)}`;

  if (isPinnedRelease(version) && fs.existsSync(cloned)) {
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
  _refreshClone(repoName, version);
  return writeMetaCache(org, repoName, version, file, getRepoFile(gitUrl, file, version, true, false, true));
};
