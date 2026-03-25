import { Command } from 'commander';
import { z } from 'zod';
import { ImportAdapter, IImportAdapter } from '../adapters/import-adapter';

const importArgsSchema = z.object({
  folder: z.string(),
  archive: z.string().optional(),
});

export function importCommand(adapter?: IImportAdapter): Command {
  const a = adapter ?? new ImportAdapter();
  return new Command('import')
    .description('Imports content type from .h5p zipped file')
    .argument('<folder>', 'Target folder')
    .argument('[archive]', 'Archive path')
    .action((folder: string, archive: string | undefined) => {
      const args = importArgsSchema.parse({ folder, archive });
      try {
        const output = a.import(args.folder, args.archive);
        console.log(`content/${output}`);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
