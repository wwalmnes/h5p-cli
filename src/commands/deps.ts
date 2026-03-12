import { Command } from 'commander';
import { z } from 'zod';
import { DepsAdapter } from '../adapters/deps-adapter';
import { DepsService } from '../services/deps-service';

const depsArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
  version: z.string().optional(),
  folder: z.string().optional(),
});

export function depsCommand(service?: DepsService): Command {
  const svc = service ?? new DepsService(new DepsAdapter());
  return new Command('deps')
    .description('Computes dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .argument('[version]', 'Version')
    .argument('[folder]', 'Folder')
    .action(async (library: string, mode: 'view' | 'edit' | undefined, version: string | undefined, folder: string | undefined) => {
      const result = depsArgsSchema.safeParse({ library, mode, version, folder });

      if (!result.success) {
        for (const issue of result.error.issues) {
          console.error(issue.message);
        }
        return;
      }

      const args = result.data;

      try {
        await svc.deps(args.library, args.mode, args.version, args.folder);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
