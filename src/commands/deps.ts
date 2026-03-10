import { Command } from 'commander';
import { z } from 'zod';
import logic from '../../logic';

const depsArgsSchema = z.object({
  library: z.string(),
  mode: z.string().optional(),
  version: z.string().optional(),
  folder: z.string().optional(),
});

export function depsCommand(): Command {
  return new Command('deps')
    .description('Computes dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .argument('[version]', 'Version')
    .argument('[folder]', 'Folder')
    .action(async (library: string, mode: string | undefined, version: string | undefined, folder: string | undefined) => {
      const args = depsArgsSchema.parse({ library, mode, version, folder });
      try {
        const result = await logic.computeDependencies(args.library, args.mode, args.version, args.folder);
        for (const item in result) {
          console.log(result[item].id ? item : `!!! unregistered ${result[item].optional ? 'optional' : 'required'} ${item} library`);
        }
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
