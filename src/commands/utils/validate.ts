import { Command } from 'commander';

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate H5P libraries')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      const validate = require('../../../assets/utils/commands/validate.js') as any;
      const result = await validate.apply(null, libraries);
      const notValid = result.some((item: any) => item.status !== 'ok');
      if (notValid) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
}
