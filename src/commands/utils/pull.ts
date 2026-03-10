import { Command } from 'commander';

export function pullCommand(): Command {
  return new Command('pull')
    .description('Pull the given or all repos')
    .argument('[libraries...]', 'Library names')
    .action((...args: any[]) => {
      const pull = require('../../../assets/utils/commands/pull.js') as any;
      const libraries: string[] = args[0];
      pull.apply(null, libraries);
    });
}
