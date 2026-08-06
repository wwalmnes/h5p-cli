import { Command } from 'commander';
import { ui } from '../lib/ui.ts';

export function serverCommand(): Command {
  return new Command('server')
    .description('Run the dev server')
    .action(async () => {
      // logic/* is shared with the CLI; suppress its progress chrome so it
      // never animates into the server log. Replaces the old
      // `process.argv[2] !== 'server'` checks in compute-dependencies.
      ui.setLevel('quiet');
      await import('../server/server.ts');
    });
}
