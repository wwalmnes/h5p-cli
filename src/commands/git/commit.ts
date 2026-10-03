import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportChanges } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function commitCommand(): Command {
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
