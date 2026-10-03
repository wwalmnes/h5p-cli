import { Command } from 'commander';
import { z } from 'zod';
import { getWithDependencies } from '../install/install.ts';
import config from '../config/loader.ts';
import { ui } from '../ui/ui.ts';

const installArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
});

export function installCommand(): Command {
  return new Command('install')
    .description('Installs dependencies for h5p library')
    .argument('<library>', 'Repo name, e.g. h5p-accordion (not H5P.Accordion)')
    .argument('[mode]', 'Mode (view or edit)')
    .addHelpText('after', `
Examples:
  $ h5p install h5p-accordion
  $ h5p install h5p-accordion edit`)
    .action(async (library: string, mode: 'view' | 'edit' | undefined) => {
      const result = installArgsSchema.safeParse({ library, mode });
      if (!result.success) {
        for (const issue of result.error.issues) {
          ui.error(issue.message);
        }
        process.exitCode = 1;
        return;
      }

      const args = result.data;

      try {
        ui.info(`downloading ${args.library} library and dependencies into "${config.folders.libraries}" folder`);
        await getWithDependencies('download', args.library, args.mode, false);
        ui.success(`done installing ${args.library}`);
      } catch (error) {
        ui.fail(error);
      }
    });
}
