import { processRepos, findRepos, RepoResult } from '../lib/process-repos';
import { VersioningAdapter, IVersioningAdapter } from '../adapters/versioning-adapter';

export interface VersioningResult {
  name: string;
  skipped?: boolean;
  failed?: boolean;
  msg?: string | { version?: string; changes?: string; error?: string; output?: string };
}

export class VersioningService {
  constructor(private adapter: IVersioningAdapter = new VersioningAdapter()) {}

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

  /** Bumps minor version of repos and all dependents recursively. Emits progress to stdout. */
  async recursiveMinorBump(repos: string[], skipWriting: boolean): Promise<void> {
    const visited = new Set<string>();
    await this._minorBump(repos, skipWriting, visited);
  }

  private async _minorBump(repos: string[], skipWriting: boolean, visited: Set<string>): Promise<void> {
    const allRepos = repos.length ? repos : await findRepos();
    for (const repo of allRepos) {
      let library: any;
      try {
        library = await this.adapter.readLibraryJson(repo);
      } catch {
        continue;
      }

      library.minorVersion++;
      library.patchVersion = 0;
      if (!skipWriting) {
        await this.adapter.writeLibraryJson(repo, library);
      }
      const version = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
      process.stdout.write(
        `\x1B[1m${repo}\x1B[0m \x1B[32mOK\x1B[0m ${version}\u000A`
      );

      await this._bumpDependents(library.machineName, library.minorVersion, skipWriting, visited);
    }
  }

  private async _bumpDependents(
    target: string,
    minorVersion: number,
    skipWriting: boolean,
    visited: Set<string>
  ): Promise<void> {
    const allRepos = await findRepos();

    await Promise.all(allRepos.map(async (repo) => {
      let library: any;
      try {
        library = await this.adapter.readLibraryJson(repo);
      } catch {
        return;
      }

      let libModified = false;

      for (const dep of (library.preloadedDependencies ?? [])) {
        if (dep.machineName === target) {
          dep.minorVersion = minorVersion;
          libModified = true;
          process.stdout.write(
            `Preloaded dependency \x1B[1m${target}\x1B[0m ` +
            `${skipWriting ? 'found' : 'updated'} in \x1B[1m${repo}\x1B[0m` +
            ` \x1B[32mOK\x1B[0m ${dep.majorVersion}.${minorVersion}\u000A`
          );
        }
      }

      for (const dep of (library.editorDependencies ?? [])) {
        if (dep.machineName === target) {
          dep.minorVersion = minorVersion;
          libModified = true;
          process.stdout.write(
            `Editor dependency \x1B[1m${target}\x1B[0m ` +
            `updated in \x1B[1m${repo}\x1B[0m` +
            ` \x1B[32mOK\x1B[0m ${dep.majorVersion}.${minorVersion}\u000A`
          );
        }
      }

      if (libModified && !skipWriting) {
        await this.adapter.writeLibraryJson(repo, library);
      }

      let semanticsModified = false;
      try {
        const semantics = await this.adapter.readSemanticsJson(repo);
        const foundFields = semanticBump(semantics, minorVersion, target);
        if (foundFields.length) {
          for (const majorVer of foundFields) {
            process.stdout.write(
              `Semantics dependency \x1B[1m${target}\x1B[0m ` +
              `updated in \x1B[1m${repo}\x1B[0m` +
              ` \x1B[32mOK\x1B[0m ${majorVer}.${minorVersion}\u000A`
            );
          }
          if (!skipWriting) {
            await this.adapter.writeSemanticsJson(repo, semantics);
          }
          semanticsModified = true;
        }
      } catch { /* no semantics.json — skip */ }

      if ((libModified || semanticsModified) && !visited.has(repo)) {
        visited.add(repo);
        await this._minorBump([repo], skipWriting, visited);
      }
    }));
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

/** Bump instances of machineName in semantics to minorVersion. Returns major versions found. */
function semanticBump(semantics: any, minorVersion: number, machineName: string): string[] {
  const found: string[] = [];
  if (!semantics) return found;

  for (const field of semantics) {
    if (field.type === 'library') {
      field.options?.forEach((option: string, index: number) => {
        if (option.split(' ')[0] === machineName) {
          const major = option.split(' ')[1].split('.')[0];
          field.options[index] = `${machineName} ${major}.${minorVersion}`;
          found.push(major);
        }
      });
    } else if (field.fields) {
      found.push(...semanticBump(field.fields, minorVersion, machineName));
    } else if (field.field) {
      found.push(...semanticBump([field.field], minorVersion, machineName));
    }
  }

  return found;
}
