import { Command } from 'commander';

export function statusCommand(): Command {
  return new Command('status')
    .description('Show the status for the given or all libraries')
    .argument('[libraries...]', 'Library names')
    .option('-f', 'Display which branch each library is on')
    .action((libraries: string[], options: { f?: boolean }) => {
      const statusCmd = require('../../../assets/utils/commands/status.js') as any;
      const args: string[] = [];
      if (options.f) args.push('-f');
      args.push(...libraries);
      statusCmd.apply(null, args);
    });
}
