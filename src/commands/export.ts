import { Command } from 'commander';
import { z } from 'zod';
import { ExportAdapter, IExportAdapter } from '../adapters/export-adapter';

const exportArgsSchema = z.object({
  library: z.string(),
  folder: z.string().optional(),
});

export function exportCommand(adapter?: IExportAdapter): Command {
  const a = adapter ?? new ExportAdapter();
  return new Command('export')
    .description('Exports content type as .h5p zipped file')
    .argument('<library>', 'Library name')
    .argument('[folder]', 'Output folder')
    .action(async (library: string, folder: string | undefined) => {
      const args = exportArgsSchema.parse({ library, folder });
      try {
        const file = await a.export(args.library, args.folder);
        console.log(file);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
