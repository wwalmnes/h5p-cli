import { Command } from 'commander';
import validate from '../../packaging/validate.ts';
import { ui } from '../../ui/ui.ts';

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate H5P libraries')
    .argument('<libraries...>', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0')
    .addHelpText('after', `
Examples:
  $ h5p utils validate h5p-accordion h5p-blanks`)
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
