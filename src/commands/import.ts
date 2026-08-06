import { Command } from 'commander';
import { z } from 'zod';
import { ImportAdapter, type IImportAdapter } from '../adapters/import-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const importArgsSchema = z.object({
  folder: z.string(),
  archive: z.string().optional(),
});

export function importCommand(adapter?: IImportAdapter): Command {
  return new Command('import')
    .description('Imports content type from .h5p zipped file')
    .argument('<folder>', 'Target folder')
    .argument('[archive]', 'Archive path')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action((folder: string, archive: string | undefined, options) => {
      const a = adapter ?? adapterRegistry.resolve<IImportAdapter>(options.adapter ?? 'import') ?? new ImportAdapter();
      const args = importArgsSchema.parse({ folder, archive });
      try {
        const output = a.import(args.folder, args.archive);
        console.log(`content/${output}`);
      } catch (error) {
        ui.error(error);
      }
    });
}
