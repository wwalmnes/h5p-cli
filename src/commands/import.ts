import { Command } from 'commander';
import { z } from 'zod';
import { ImportAdapter } from '../adapters/import-adapter';
import { ImportService } from '../services/import-service';

const importArgsSchema = z.object({
  folder: z.string(),
  archive: z.string().optional(),
});

export function importCommand(service?: ImportService): Command {
  const svc = service ?? new ImportService(new ImportAdapter());
  return new Command('import')
    .description('Imports content type from .h5p zipped file')
    .argument('<folder>', 'Target folder')
    .argument('[archive]', 'Archive path')
    .action((folder: string, archive: string | undefined) => {
      const args = importArgsSchema.parse({ folder, archive });
      try {
        svc.import(args.folder, args.archive);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
