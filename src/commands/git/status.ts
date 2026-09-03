import { Command } from 'commander';
import { z } from 'zod';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';
import { reportChanges } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

const statusArgsSchema = z.object({
  libraries: z.array(z.string().min(1, 'Library names cannot be empty')),
  f: z.boolean().optional(),
});

export function statusCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('status')
    .description('Show the status for the given or all libraries')
    .argument('[libraries...]', 'Library names')
    .option('-f', 'Display which branch each library is on')
    .action(async (libraries: string[], options: { f?: boolean }) => {
      const result = statusArgsSchema.safeParse({ libraries, f: options.f });

      if (!result.success) {
        for (const issue of result.error.issues) {
          ui.error(issue.message);
        }
        process.exitCode = 1;
        return;
      }

      const args = result.data;

      try {
        const named = args.libraries.length > 0;
        const results = await processRepos(named ? args.libraries : ['*'], repo => git.status(repo));

        results
          // A skipped repo carries its reason in `msg`, which reportChanges does
          // not render; surface it as the error line instead. Only when the user
          // named the library explicitly, so ignored repos stay quiet under `*`.
          .map(repo => (repo.skipped && named ? { name: repo.name, error: repo.msg } : repo))
          .filter(repo => repo.error || repo.changes || args.f)
          .forEach(repo => reportChanges(repo));
      } catch (error) {
        ui.fail(error);
      }
    });
}
