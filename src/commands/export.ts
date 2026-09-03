import { Command } from 'commander';
import { z } from 'zod';
import { ExportAdapter, type IExportAdapter } from '../adapters/export-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

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
      try {
        const args = exportArgsSchema.parse({ library, folder });
        const file = await a.export(args.library, args.folder);
        ui.data(file);
      } catch (error) {
        ui.fail(error);
      }
    });
}
