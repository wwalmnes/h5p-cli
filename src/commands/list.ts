import { Command } from 'commander';
import { z } from 'zod';
import { ListAdapter, IListAdapter } from '../adapters/list-adapter';

const listArgsSchema = z.object({
  // @todo: string currently and backwards compatible to accept 1. Should be a boolean.
  reversed: z.string().optional(),
  ignoreFile: z.string().optional(),
});

export function listCommand(adapter?: IListAdapter): Command {
  const a = adapter ?? new ListAdapter();
  return new Command('list')
    .description('Lists h5p libraries from the registry')
    .argument('[reversed]', 'Pass 1 to show reversed list')
    .argument('[ignoreFile]', 'Pass 1 to ignore local registry file')
    .action(async (reversed: string | undefined, ignoreFile: string | undefined) => {
      const args = listArgsSchema.parse({ reversed, ignoreFile });
      try {
        console.log('> fetching h5p library registry');
        const result = await a.getRegistry(args.ignoreFile === '1');
        for (const item in result.regular) {
          console.log(`${args.reversed === '1' ? result.regular[item].id : item} (${result.regular[item].org})`);
        }
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
