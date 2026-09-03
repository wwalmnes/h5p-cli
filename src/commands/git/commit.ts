import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';
import { reportChanges } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function commitCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('commit')
    .description('Commit to repos with given message')
    .argument('<message>', 'Commit message')
    .argument('[libraries...]', 'Library names')
    .action(async (message: string, libraries: string[]) => {
      if (!message) {
        ui.warn('No message means no commit.');
        return;
      }
      if (message.split(' ', 2).length < 2) {
        ui.warn('Commit message to short.');
        return;
      }

      try {
        const results = await processRepos(libraries, repo => git.commit(repo, message));
        for (const result of results) {
          // Repos with nothing to say are silent, as before.
          if (!('error' in result) && !('changes' in result)) continue;
          reportChanges(result);
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
