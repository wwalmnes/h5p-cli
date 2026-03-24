import { Command } from 'commander';
import pull from '../../utils/commands/pull';

export function pullCommand(): Command {
  return new Command('pull')
    .description('Pull the given or all repos')
    .argument('[libraries...]', 'Library names')
    .action((...args: any[]) => {
      const libraries: string[] = args[0];
      pull(...libraries);
    });
}
