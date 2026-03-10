import { Command } from 'commander';
import { z } from 'zod';

const cloneArgsSchema = z.object({
  library: z.string(),
  mode: z.string().optional(),
});

export function cloneCommand(): Command {
  return new Command('clone')
    .description('Clones dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .action(async (library: string, mode: string | undefined) => {
      const args = cloneArgsSchema.parse({ library, mode });
      const logic = require('../../logic.js') as any;
      const config = require('../../configLoader.js') as any;
      try {
        console.log(`> cloning ${args.library} library and dependencies into "${config.folders.libraries}" folder`);
        await logic.getWithDependencies('clone', args.library, args.mode);
        console.log(`> done installing ${args.library}`);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
