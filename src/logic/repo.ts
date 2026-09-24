import fs from 'fs';
import path from 'path';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import config from '../../configLoader.ts';
import { fromTemplate, parseGitUrl, isPinnedRelease, sanitizeRefForPath } from '../lib/h5p-utils.ts';
import type { ParsedGitUrl } from '../lib/h5p-utils.ts';
import { ui } from '../lib/ui.ts';
import { _execSync } from './exec.ts';

// clone repo and retrieve file
export const getRepoFile = (gitUrl: string, path: string, branch = 'master', parseJson?: boolean, cleanStart?: boolean, shallow?: boolean): string | object => {
  const { repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
  const target = `${config.folders.temp}/${repoName}_${sanitizeRefForPath(branch)}`;
  const filePath = `${target}/${path}`;
  if (cleanStart) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(target)) {
    const depth = shallow ? ' --depth 1 --single-branch' : '';
    /* same non-interactive contract as _exec: this is the clone transport's
    fallback, and a private repo whose credentials are not cached would
    otherwise sit on a prompt the progress area has already painted over. */
    _execSync(`git clone ${gitUrl} ${target} --branch ${branch}${depth}`);
  }
  if (!fs.existsSync(filePath)) {
    return '';
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return parseJson ? JSON.parse(data) : data;
};

// Repos whose branch checkout in temp/ this process has already dealt with.
const _refreshed = new Set<string>();

export const _refreshClone = (repoName: string, version: string): void => {
  if (isPinnedRelease(version)) {
    return;
  }
  const target = path.resolve(`${config.folders.temp}/${repoName}_${sanitizeRefForPath(version)}`);
  if (_refreshed.has(target)) {
    return;
  }
  _refreshed.add(target);

  if (!fs.existsSync(`${target}/.git`)) {
    return;
  }

  /* The low-speed bound covers the one failure git does not end on its own. A dead
  resolver or a refused connection exits in seconds; a socket that opens and
  then stops delivering bytes stays alive, and git waits on it indefinitely.
  _execSync is spawnSync, so that wait blocks the whole process - the progress
  area stops repainting and the CLI reads as wedged - until the ten-minute exec
  budget fires. Ten seconds under a kilobyte a second ends it instead. Tripping
  the bound on a merely slow fetch costs nothing: the catch below falls back to
  the checkout already on disk. */
  const depth = fs.existsSync(`${target}/.git/shallow`) ? ' --depth 1' : '';
  try {
    _execSync(`git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 fetch --no-tags${depth} origin ${version}`, target);
    _execSync('git reset --hard FETCH_HEAD', target);
  }
  catch (error) {
    // the fetch failed or the branch is gone: the checkout on disk is still
    // the best answer available, so say so rather than failing the resolution
    ui.debug(`could not refresh ${target}: ${(error as Error).message}`);
  }
};

/* superagent's own message for a 404 is the bare "Not Found", with no clue which
repository or ref was asked for. Keep its status on the error so the caller can
still tell a missing ref from a genuine failure. */
const _downloadFailed = (url: string, error: unknown): Error => {
  const status = (error as { status?: number })?.status;
  const reason = status ?? (error instanceof Error ? error.message : String(error));
  const failure = new Error(`cannot download ${url} (${reason})`);
  (failure as { status?: number }).status = status;
  return failure;
};

// GitHub files branches and tags under different ref namespaces.
const _archiveRef = (version: string): string =>
  isPinnedRelease(version) ? `refs/tags/${version}` : `refs/heads/${version}`;

// list tags for library, straight off the remote
export const tags = (org: string, repo: string): string[] => {
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
};

// download & unzip repository
export const download = async (org: string, repo: string, version: string, target: string): Promise<void> => {
  const url = fromTemplate(config.urls.library.zip, { org, repo, ref: _archiveRef(version) });
  let blob;
  try {
    blob = (await superAgent.get(url))._body;
  }
  catch (error) {
    throw _downloadFailed(url, error);
  }
  const work = `${config.folders.temp}/dl_${repo}_${sanitizeRefForPath(version)}`;
  const zipFile = `${work}.zip`;
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  try {
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(work);
    fs.rmSync(zipFile, { force: true });
    const [root] = fs.readdirSync(work);
    fs.renameSync(`${work}/${root}`, target);
  }
  finally {
    fs.rmSync(zipFile, { force: true });
    fs.rmSync(work, { recursive: true, force: true });
  }
};

// clone repository using git
export const clone = (org: string, repo: string, branch: string, target: string): string => {
  return _execSync(`git clone ${fromTemplate(config.urls.library.clone, {org, repo})} ${target} --branch ${branch}`, config.folders.libraries);
};
