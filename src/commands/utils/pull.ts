import { Command } from 'commander';
import { GitAdapter, IGitAdapter } from '../../adapters/git-adapter';
import { processRepos } from '../../lib/process-repos';
import * as output from '../../utils/utility/output';

export function pullCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('pull')
    .description('Pull the given or all repos')
    .argument('[libraries...]', 'Library names')
    .action(async (libraries: string[]) => {
      const repos = libraries.length ? libraries : ['*'];
      const repoCount = libraries.length ? libraries.length : 'all';
      const repoLabel = libraries.length === 1 ? 'repository' : 'repositories';
      const spinner = new (output.Spinner as any)(`Pulling ${repoCount} ${repoLabel}`);

      try {
        const results = await processRepos(repos, repo => git.pull(repo));
        spinner.succeeded('Finished pulling repositories');
        output.printPulled(results as any);
      } catch (error: any) {
        spinner.failed(error.message);
      }
    });
}
