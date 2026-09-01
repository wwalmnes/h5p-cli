import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';

export function commitCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('commit')
    .description('Commit to repos with given message')
    .argument('<message>', 'Commit message')
    .argument('[libraries...]', 'Library names')
    .action(async (message: string, libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m' };

      if (!message) {
        process.stdout.write('No message means no commit.' + lf);
        return;
      }
      if (message.split(' ', 2).length < 2) {
        process.stdout.write('Commit message to short.' + lf);
        return;
      }

      try {
        const results = await processRepos(libraries, repo => git.commit(repo, message));
        let first = true;
        for (const result of results) {
          if (!('error' in result) && !('changes' in result)) continue;
          if (first) { process.stdout.write(lf); first = false; }
          process.stdout.write(color.emphasize + result.name + color.default);
          if ('branch' in result && result.branch && result.commit) {
            process.stdout.write(' (' + result.branch + ' ' + result.commit + ')');
          }
          process.stdout.write(lf);
          if ('error' in result && result.error) process.stdout.write(result.error + lf);
          else if ('changes' in result && result.changes) process.stdout.write(result.changes.join(lf) + lf);
          process.stdout.write(lf);
        }
      } catch (error: any) {
        process.stdout.write(error.message + lf);
      }
    });
}
