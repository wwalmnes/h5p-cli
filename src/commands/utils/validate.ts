import { Command } from 'commander';
import validate from '../../utils/commands/validate';

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate H5P libraries')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      const result = await validate(...libraries);
      const notValid = result.some((item: any) => item.status !== 'ok');
      if (notValid) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
}
