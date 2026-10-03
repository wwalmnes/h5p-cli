import { Command } from 'commander';
import { z } from 'zod';
import { computeDependencies } from '../install/dependencies.ts';
import { getRegistry, parseLibraryFolders } from '../h5p/registry.ts';
import { ui } from '../ui/ui.ts';

const missingArgsSchema = z.object({
  library: z.string(),
});

export function missingCommand(): Command {
  return new Command('missing')
    .description('Computes missing dependencies for h5p library')
    .argument('<library>', 'Repo name, e.g. h5p-accordion')
    .addHelpText('after', `
Examples:
  $ h5p missing h5p-accordion`)
    .action(async (library: string) => {
      try {
        const args = missingArgsSchema.parse({ library });
        const libraryDirs = await parseLibraryFolders();
        const registry = await getRegistry();
        const folder = libraryDirs[registry.regular[args.library]?.id];
        // One edit resolution, from the installed folder, covers the whole graph.
        const result = await computeDependencies(args.library, 'edit', null, folder);

        // entries without an id are the ones the registry does not know about
        const missing = Object.keys(result).filter(item => !result[item].id);
        if (!missing.length) {
          ui.info(`${args.library} has no unregistered dependencies`);
          return;
        }

        ui.info(`unregistered dependencies for ${args.library}`);
        for (const item of missing) {
          ui.data(`${item} (${result[item].optional ? 'optional' : 'required'})`);
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
