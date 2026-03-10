import { Command } from 'commander';
import statusCmd from '../../../assets/utils/commands/status';

export function statusCommand(): Command {
  return new Command('status')
    .description('Show the status for the given or all libraries')
    .argument('[libraries...]', 'Library names')
    .option('-f', 'Display which branch each library is on')
    .action((libraries: string[], options: { f?: boolean }) => {
      const args: string[] = [];
      if (options.f) args.push('-f');
      args.push(...libraries);
      statusCmd(...args);
    });
}
