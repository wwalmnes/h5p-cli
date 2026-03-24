import { Command } from 'commander';
import h5p from '../../utils/h5p';

export function commitCommand(): Command {
  return new Command('commit')
    .description('Commit to repos with given message')
    .argument('<message>', 'Commit message')
    .argument('[libraries...]', 'Library names')
    .action((message: string, libraries: string[]) => {
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

      function commitResults(error: any, results: any[]) {
        if (error) return process.stdout.write(error + lf);
        let first = true;
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (!result.error && !result.changes) continue;
          if (first) { process.stdout.write(lf); first = false; }
          process.stdout.write(color.emphasize + result.name + color.default);
          if (result.branch && result.commit) {
            process.stdout.write(' (' + result.branch + ' ' + result.commit + ')');
          }
          process.stdout.write(lf);
          if (result.error) process.stdout.write(error + lf);
          else process.stdout.write(result.changes.join(lf) + lf);
          process.stdout.write(lf);
        }
      }

      h5p.commitRepos(message, libraries, commitResults);
    });
}
