import { Command } from 'commander';
import { z } from 'zod';

const missingArgsSchema = z.object({
  library: z.string(),
});

export function missingCommand(): Command {
  return new Command('missing')
    .description('Computes missing dependencies for h5p library')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const args = missingArgsSchema.parse({ library });
      const logic = require('../../logic.js') as any;
      try {
        const libraryDirs = await logic.parseLibraryFolders();
        const registry = await logic.getRegistry();
        const missing: Record<string, boolean> = {};
        const parseMissing = (result: any, item: string) => {
          if (!registry.regular[item] && (typeof missing[item] === 'undefined' || missing[item])) {
            missing[item] = result[item].optional;
          }
        };
        let result = await logic.computeDependencies(args.library, 'view', null, libraryDirs[registry.regular[args.library].id]);
        for (const item in result) {
          parseMissing(result, item);
          if (registry.regular[item]) {
            const list = await logic.computeDependencies(item, 'edit', null, libraryDirs[registry.regular[item].id]);
            for (const elem in list) {
              parseMissing(list, elem);
            }
          }
        }
        result = await logic.computeDependencies(args.library, 'edit', null, libraryDirs[registry.regular[args.library].id]);
        for (const item in result) {
          parseMissing(result, item);
        }
        if (!Object.keys(missing).length) {
          console.log(`> ${args.library} has no unregistered dependencies`);
          return;
        }
        console.log(`> unregistered dependencies for ${args.library}`);
        for (const item in missing) {
          console.log(`${item} (${missing[item] ? 'optional' : 'required'})`);
        }
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
