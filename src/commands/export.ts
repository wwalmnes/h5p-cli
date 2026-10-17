import { Command } from 'commander';
import { z } from 'zod';
import { exportContent } from '../content/content.ts';
import { ui } from '../ui/ui.ts';

const exportArgsSchema = z.object({
  library: z.string(),
  folder: z.string().optional(),
});

export function exportCommand(): Command {
  return new Command('export')
    .description('Exports content type as .h5p zipped file')
    .argument('<library>', 'Repo name, e.g. h5p-accordion')
    .argument('[folder]', 'Content folder inside content/, e.g. my-accordion')
    .addHelpText('after', `
Examples:
  $ h5p export h5p-accordion my-accordion      # packs content/my-accordion`)
    .action(async (library: string, folder: string | undefined) => {
      try {
        const args = exportArgsSchema.parse({ library, folder });
        const file = await exportContent(args.library, args.folder);
        ui.data(file);
      } catch (error) {
        ui.fail(error);
      }
    });
}
