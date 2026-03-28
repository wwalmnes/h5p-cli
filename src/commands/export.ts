import { Command } from 'commander';
import { z } from 'zod';
import { ExportAdapter, IExportAdapter } from '../adapters/export-adapter';
import { adapterRegistry } from '../lib/adapter-registry';

const exportArgsSchema = z.object({
  library: z.string(),
  folder: z.string().optional(),
});

export function exportCommand(adapter?: IExportAdapter): Command {
  return new Command('export')
    .description('Exports content type as .h5p zipped file')
    .argument('<library>', 'Library name')
    .argument('[folder]', 'Output folder')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (library: string, folder: string | undefined, options) => {
      const a = adapter ?? adapterRegistry.resolve<IExportAdapter>(options.adapter ?? 'export') ?? new ExportAdapter();
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
