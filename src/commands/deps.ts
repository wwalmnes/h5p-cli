import { Command } from 'commander';
import { z } from 'zod';
import { computeDependencies } from '../logic/dependencies.ts';
import { ui } from '../lib/ui.ts';

const depsArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
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
    .action(async (library: string, mode: 'view' | 'edit' | undefined, version: string | undefined, folder: string | undefined) => {
      const result = depsArgsSchema.safeParse({ library, mode, version, folder });

      if (!result.success) {
        for (const issue of result.error.issues) {
          ui.error(issue.message);
        }
        process.exitCode = 1;
        return;
      }

      const args = result.data;

      try {
        const deps = await computeDependencies(args.library, args.mode, args.version, args.folder);
        for (const item in deps) {
          if (deps[item].id) {
            ui.data(item);
          } else {
            ui.warn(`unregistered ${deps[item].optional ? 'optional' : 'required'} ${item} library`);
          }
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
