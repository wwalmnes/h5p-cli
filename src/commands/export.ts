import { Command } from 'commander';
import { z } from 'zod';
import { ExportAdapter } from '../adapters/export-adapter';
import { ExportService } from '../services/export-service';

const exportArgsSchema = z.object({
  library: z.string(),
  folder: z.string().optional(),
});

export function exportCommand(service?: ExportService): Command {
  const svc = service ?? new ExportService(new ExportAdapter());
  return new Command('export')
    .description('Exports content type as .h5p zipped file')
    .argument('<library>', 'Library name')
    .argument('[folder]', 'Output folder')
    .action(async (library: string, folder: string | undefined) => {
      const args = exportArgsSchema.parse({ library, folder });
      try {
        await svc.export(args.library, args.folder);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
