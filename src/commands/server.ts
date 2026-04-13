import { Command } from 'commander';

export function serverCommand(): Command {
  return new Command('server')
    .description('Run the dev server')
    .action(async () => {
      await import('../server/server.ts');
    });
}
