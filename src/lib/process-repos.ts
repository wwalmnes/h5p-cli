import fs from 'fs';
import type { RepoOpResult } from './repo-types.ts';

const ignoredRepos = process.env.H5P_IGNORE_REPOS ? process.env.H5P_IGNORE_REPOS.split(',') : [];
const semiIgnoredRepos = process.env.H5P_SEMI_IGNORE_REPOS ? process.env.H5P_SEMI_IGNORE_REPOS.split(',') : [];

export type RepoSkipped = RepoOpResult & { skipped: true; msg: string };

export type RepoResult<T> = RepoSkipped | ({ name: string } & T);

/** Find all git repositories in the current working directory. */
export async function findRepos(dir = '.'): Promise<string[]> {
  const entries = fs.readdirSync(dir);
  return entries.filter(entry => fs.existsSync(`${dir === '.' ? '' : dir + '/'}${entry}/.git/config`));
}

/**
 * Run a function on each of the given repositories, in parallel (default) or serial.
 * Repos is a list of directory names, or `['*']` to process all repos found in cwd.
 * The result array preserves order; skipped repos get `{ name, skipped: true, msg }`.
 */
export async function processRepos<T extends object>(
  repos: string[],
  fn: (repo: string) => Promise<{ name: string } & T>,
  options: { serial?: boolean; skipCheck?: boolean } = {}
): Promise<RepoResult<T>[]> {
  const validRepos = options.skipCheck ? [] : await findRepos();
  const all = !repos.length || (repos.length === 1 && repos[0] === '*');
  const toProcess: string[] = all ? (options.skipCheck ? fs.readdirSync('.') : validRepos) : repos;

  const run = async (repo: string): Promise<RepoResult<T>> => {
    if (ignoredRepos.includes(repo) || (!options.skipCheck && semiIgnoredRepos.includes(repo))) {
      return { name: repo, skipped: true, msg: 'ignored' };
    }
    if (!all && !options.skipCheck && !validRepos.includes(repo)) {
      return { name: repo, skipped: true, msg: 'no git repository found' };
    }
    return fn(repo);
  };

  if (options.serial) {
    const results: RepoResult<T>[] = [];
    for (const repo of toProcess) {
      results.push(await run(repo));
    }
    return results;
  }

  return Promise.all(toProcess.map(run));
}

/** Resolve a repos argument: if empty or ['*'], find all repos; otherwise return as-is. */
export async function resolveRepos(repos: string[]): Promise<string[]> {
  const all = !repos.length || (repos.length === 1 && repos[0] === '*');
  return all ? findRepos() : repos;
}
