import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { findRepos } from '../../repos/process-repos.ts';
import { ui } from '../../ui/ui.ts';

export function diffCommand(): Command {
  return new Command('diff')
    .description('Prints combined diff for all repos')
    .action(async () => {
      try {
        const repos = await findRepos();
        const diffs = await Promise.all(repos.map(repo => git.diff(repo)));
        const combined = diffs.join('');
        // The one data channel in `h5p git`: patch text, pipeable and uncolored.
        // ui.data appends the newline, so drop the trailing one the diff carries.
        if (combined) ui.data(combined.replace(/\n$/, ''));
      } catch (error) {
        ui.fail(error);
      }
    });
}
