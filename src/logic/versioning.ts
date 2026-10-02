import fs from 'fs';
import { processRepos, type RepoResult } from '../lib/process-repos.ts';
import type { RepoOpResult } from '../lib/repo-types.ts';
import { spawnGit } from './git.ts';

export type VersioningResult = RepoOpResult<
  string | { version?: string; changes?: string; error?: string; output?: string }
>;

function readLibraryJson(repo: string): any {
  try {
    return JSON.parse(fs.readFileSync(`${repo}/library.json`).toString());
  } catch (err: any) {
    const msg = err.toString();
    throw new Error(msg.includes('no such file') || msg.includes('not a directory') ? 'not a library' : msg);
  }
}

function isHeadDetached(repo: string): boolean {
  const content = fs.readFileSync(`${repo}/.git/HEAD`).toString();
  return content.substr(0, 3) !== 'ref';
}

export async function increasePatchVersion(repos: string[], force: boolean): Promise<RepoResult<VersioningResult>[]> {
  return processRepos(repos, async (repo) => {
    let library: any;
    try {
      library = readLibraryJson(repo);
    } catch (err: any) {
      return { name: repo, skipped: true, msg: String(err.message ?? err) };
    }

    let detached: boolean;
    try {
      detached = isHeadDetached(repo);
    } catch (err: any) {
      return { name: repo, skipped: true, msg: String(err.message ?? err) };
    }

    if (detached) {
      return { name: repo, skipped: true, msg: 'detached HEAD' };
    }

    if (!force) {
      const range = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}..HEAD`;
      const { stdout, stderr } = await spawnGit(repo, ['diff', range]);
      if (stderr && !stderr.includes('fatal: ambiguous argument')) {
        return { name: repo, failed: true, msg: stderr };
      }
      const hasChanges = stdout || stderr.includes('fatal: ambiguous argument');
      if (!hasChanges) {
        return { name: repo, skipped: true };
      }
    }

    library.patchVersion++;
    fs.writeFileSync(`${repo}/library.json`, JSON.stringify(library, null, 2));
    return {
      name: repo,
      msg: `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`,
    };
  }, { skipCheck: true });
}

export async function changesSince(repos: string[], versions: number): Promise<RepoResult<VersioningResult>[]> {
  return processRepos(repos, async (repo) => {
    let detached: boolean;
    try {
      detached = isHeadDetached(repo);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }
    if (detached) {
      return { name: repo, skipped: true, msg: 'detached HEAD' };
    }

    const { versionRef, isFirstCommit } = await resolveVersionRef(repo, versions);

    const { stdout, stderr } = await spawnGit(repo, ['diff', '--stat', `${versionRef}..HEAD`]);
    if (stderr) {
      return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
    }
    return {
      name: repo,
      msg: { version: isFirstCommit ? 'Initial Commit' : versionRef, changes: stdout },
    };
  }, { skipCheck: true });
}

export async function changesSinceRelease(repos: string[]): Promise<RepoResult<VersioningResult>[]> {
  return processRepos(repos, async (repo) => {
    const { stdout, stderr } = await spawnGit(repo, ['diff', '--stat', 'master..release']);
    if (stderr) {
      return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
    }
    return { name: repo, msg: { changes: stdout } };
  });
}

export async function commitsSince(repos: string[], versions: number): Promise<RepoResult<VersioningResult>[]> {
  return processRepos(repos, async (repo) => {
    let detached: boolean;
    try {
      detached = isHeadDetached(repo);
    } catch (err: any) {
      return { name: repo, failed: true, msg: String(err.message ?? err) };
    }
    if (detached) {
      return { name: repo, skipped: true, msg: 'detached HEAD' };
    }

    const { versionRef, isFirstCommit } = await resolveVersionRef(repo, versions);

    const { stdout, stderr } = await spawnGit(repo, ['log', '--oneline', `${versionRef}..HEAD`]);
    if (stderr) {
      return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
    }
    return {
      name: repo,
      msg: { version: isFirstCommit ? 'Initial Commit' : versionRef, changes: stdout },
    };
  }, { skipCheck: true });
}

export async function compareTagsWithRelease(repos: string[]): Promise<RepoResult<VersioningResult>[]> {
  return processRepos(repos, async (repo) => {
    let library: any;
    try {
      library = readLibraryJson(repo);
    } catch (err: any) {
      return { name: repo, skipped: true, msg: String(err.message ?? err) };
    }

    const libraryVersion = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
    const { stdout, stderr } = await spawnGit(repo, ['describe', '--abbrev=0', '--tags']);
    if (stderr) {
      return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
    }

    const latestTag = stdout.trim();
    if (libraryVersion !== latestTag) {
      return { name: repo, msg: { changes: `changed from ${latestTag} to ${libraryVersion}` } };
    }
    return { name: repo, skipped: true, msg: `${libraryVersion} - no changes` };
  });
}

async function resolveVersionRef(
  repo: string,
  versions: number
): Promise<{ versionRef: string; isFirstCommit: boolean }> {
  const { stdout: tagList } = await spawnGit(repo, ['tag', '-l', '--sort=version:refname']);
  const tags = tagList.split('\n').filter(Boolean);
  let numValid = 0;

  for (let i = tags.length - 1; i >= 0; i--) {
    if (/(\d+)\.(\d+)\.(\d+)/.test(tags[i])) {
      numValid++;
      if (numValid === versions) {
        return { versionRef: tags[i], isFirstCommit: false };
      }
    }
  }

  const { stdout: firstCommit } = await spawnGit(repo, ['rev-list', '--max-parents=0', 'HEAD']);
  return { versionRef: firstCommit.split('\n')[0], isFirstCommit: true };
}
