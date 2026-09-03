import { Command } from 'commander';
import validate from '../../utils/commands/validate.ts';
import { ui } from '../../lib/ui.ts';

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate H5P libraries')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        const result = await validate(libraries);
        if (result.some((item: any) => item.status !== 'ok')) {
          process.exitCode = 1;
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
