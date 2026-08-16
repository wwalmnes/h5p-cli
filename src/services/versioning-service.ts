import { processRepos, type RepoResult } from '../lib/process-repos.ts';
import { VersioningAdapter, type IVersioningAdapter } from '../adapters/versioning-adapter.ts';

export interface VersioningResult {
  name: string;
  skipped?: boolean;
  failed?: boolean;
  msg?: string | { version?: string; changes?: string; error?: string; output?: string };
}

export class VersioningService {
  private adapter: IVersioningAdapter;

  constructor(adapter: IVersioningAdapter = new VersioningAdapter()) {
    this.adapter = adapter;
  }

  async increasePatchVersion(repos: string[], force: boolean): Promise<RepoResult<VersioningResult>[]> {
    return processRepos(repos, async (repo) => {
      let library: any;
      try {
        library = await this.adapter.readLibraryJson(repo);
      } catch (err: any) {
        return { name: repo, skipped: true, msg: String(err.message ?? err) };
      }

      let detached: boolean;
      try {
        detached = await this.adapter.isHeadDetached(repo);
      } catch (err: any) {
        return { name: repo, skipped: true, msg: String(err.message ?? err) };
      }

      if (detached) {
        return { name: repo, skipped: true, msg: 'detached HEAD' };
      }

      if (!force) {
        const range = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}..HEAD`;
        const { stdout, stderr } = await this.adapter.gitDiff(repo, range);
        if (stderr && !stderr.includes('fatal: ambiguous argument')) {
          return { name: repo, failed: true, msg: stderr };
        }
        const hasChanges = stdout || stderr.includes('fatal: ambiguous argument');
        if (!hasChanges) {
          return { name: repo, skipped: true };
        }
      }

      library.patchVersion++;
      await this.adapter.writeLibraryJson(repo, library);
      return {
        name: repo,
        msg: `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`,
      };
    }, { skipCheck: true });
  }

  async changesSince(repos: string[], versions: number): Promise<RepoResult<VersioningResult>[]> {
    return processRepos(repos, async (repo) => {
      let detached: boolean;
      try {
        detached = await this.adapter.isHeadDetached(repo);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }
      if (detached) {
        return { name: repo, skipped: true, msg: 'detached HEAD' };
      }

      const { versionRef, isFirstCommit } = await this.resolveVersionRef(repo, versions);

      const { stdout, stderr } = await this.adapter.gitDiffStat(repo, versionRef);
      if (stderr) {
        return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
      }
      return {
        name: repo,
        msg: { version: isFirstCommit ? 'Initial Commit' : versionRef, changes: stdout },
      };
    }, { skipCheck: true });
  }

  async changesSinceRelease(repos: string[]): Promise<RepoResult<VersioningResult>[]> {
    return processRepos(repos, async (repo) => {
      const { stdout, stderr } = await this.adapter.gitDiffStatBranches(repo);
      if (stderr) {
        return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
      }
      return { name: repo, msg: { changes: stdout } };
    });
  }

  async commitsSince(repos: string[], versions: number): Promise<RepoResult<VersioningResult>[]> {
    return processRepos(repos, async (repo) => {
      let detached: boolean;
      try {
        detached = await this.adapter.isHeadDetached(repo);
      } catch (err: any) {
        return { name: repo, failed: true, msg: String(err.message ?? err) };
      }
      if (detached) {
        return { name: repo, skipped: true, msg: 'detached HEAD' };
      }

      const { versionRef, isFirstCommit } = await this.resolveVersionRef(repo, versions);

      const { stdout, stderr } = await this.adapter.gitLogOneline(repo, versionRef);
      if (stderr) {
        return { name: repo, failed: true, msg: { error: stderr, output: stdout } };
      }
      return {
        name: repo,
        msg: { version: isFirstCommit ? 'Initial Commit' : versionRef, changes: stdout },
      };
    }, { skipCheck: true });
  }

  async compareTagsWithRelease(repos: string[]): Promise<RepoResult<VersioningResult>[]> {
    return processRepos(repos, async (repo) => {
      let library: any;
      try {
        library = await this.adapter.readLibraryJson(repo);
      } catch (err: any) {
        return { name: repo, skipped: true, msg: String(err.message ?? err) };
      }

      const libraryVersion = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
      const { stdout, stderr } = await this.adapter.gitDescribeTag(repo);
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

  private async resolveVersionRef(
    repo: string,
    versions: number
  ): Promise<{ versionRef: string; isFirstCommit: boolean }> {
    const tags = await this.adapter.gitTagList(repo);
    let numValid = 0;

    for (let i = tags.length - 1; i >= 0; i--) {
      if (/(\d+)\.(\d+)\.(\d+)/.test(tags[i])) {
        numValid++;
        if (numValid === versions) {
          return { versionRef: tags[i], isFirstCommit: false };
        }
      }
    }

    const firstCommit = await this.adapter.gitFirstCommit(repo);
    return { versionRef: firstCommit, isFirstCommit: true };
  }
}
