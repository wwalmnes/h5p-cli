import { Command } from 'commander';
import { z } from 'zod';

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
      const args = exportArgsSchema.parse({ library, folder });
      const logic = require('../../logic.js') as any;
      try {
        const file = await logic.export(args.library, args.folder);
        console.log(file);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
