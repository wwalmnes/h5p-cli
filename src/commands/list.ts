import { Command } from 'commander';
import { z } from 'zod';
import logic from '../../logic';

const listArgsSchema = z.object({
  reversed: z.string().optional(),
  ignoreFile: z.string().optional(),
});

export function listCommand(): Command {
  return new Command('list')
    .description('Lists h5p libraries from the registry')
    .argument('[reversed]', 'Pass 1 to show reversed list')
    .argument('[ignoreFile]', 'Pass 1 to ignore local registry file')
    .action(async (reversed: string | undefined, ignoreFile: string | undefined) => {
      const args = listArgsSchema.parse({ reversed, ignoreFile });
      try {
        console.log('> fetching h5p library registry');
        const result = await logic.getRegistry(parseInt(args.ignoreFile ?? '0'));
        for (const item in result.regular) {
          console.log(`${parseInt(args.reversed ?? '0') ? result.regular[item].id : item} (${result.regular[item].org})`);
        }
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
