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
    .argument('<library>', 'Library name')
    .argument('[folder]', 'Output folder')
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
