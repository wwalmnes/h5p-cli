import { Command } from 'commander';
import { z } from 'zod';
import { importContent } from '../content/content.ts';
import { ui } from '../ui/ui.ts';

const importArgsSchema = z.object({
  folder: z.string(),
  archive: z.string().optional(),
});

export function importCommand(): Command {
  return new Command('import')
    .description('Imports content type from .h5p zipped file')
    .argument('<folder>', 'Content folder to create inside content/, e.g. my-accordion')
    .argument('[archive]', 'Path to the .h5p file')
    .addHelpText('after', `
Examples:
  $ h5p import my-accordion ~/Downloads/accordion.h5p`)
    .action((folder: string, archive: string | undefined) => {
      try {
        const args = importArgsSchema.parse({ folder, archive });
        const output = importContent(args.folder, args.archive);
        ui.data(`content/${output}`);
      } catch (error) {
        ui.fail(error);
      }
    });
}
