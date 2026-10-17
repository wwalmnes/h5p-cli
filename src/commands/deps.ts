import { Command } from 'commander';
import { z } from 'zod';
import { computeDependencies } from '../install/dependencies.ts';
import { ui } from '../ui/ui.ts';

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
    .argument('<library>', 'Repo name, e.g. h5p-accordion')
    .argument('[mode]', 'Mode (view or edit)')
    .argument('[version]', 'Version or branch, e.g. 1.0 (default: master)')
    .argument('[folder]', 'Read from libraries/<folder> instead of the remote, e.g. H5P.Accordion-1.0')
    .addHelpText('after', `
Examples:
  $ h5p deps h5p-accordion
  $ h5p deps h5p-accordion edit 1.0
  $ h5p deps h5p-accordion edit master H5P.Accordion-1.0`)
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
