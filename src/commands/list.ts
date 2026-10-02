import { Command } from 'commander';
import { z } from 'zod';
import { getRegistry } from '../logic/registry.ts';
import { ui } from '../lib/ui.ts';

const listArgsSchema = z.object({
  // @todo: string currently and backwards compatible to accept 1. Should be a boolean.
  reversed: z.string().optional(),
  ignoreFile: z.string().optional(),
});

export function listCommand(): Command {
  return new Command('list')
    .description('Lists h5p libraries from the registry')
    .argument('[reversed]', 'Pass 1 to show reversed list')
    .argument('[ignoreFile]', 'Pass 1 to ignore local registry file')
    .action(async (reversed: string | undefined, ignoreFile: string | undefined) => {
      try {
        const args = listArgsSchema.parse({ reversed, ignoreFile });
        ui.info('fetching h5p library registry');
        const result = await getRegistry(args.ignoreFile === '1');
        const machineNames = args.reversed === '1';
        const rows = Object.keys(result.regular).map((item) => [
          machineNames ? result.regular[item].id : item,
          result.regular[item].org ?? '',
        ]);
        ui.table(rows, { head: [machineNames ? 'MACHINE NAME' : 'NAME', 'ORG'] });
      } catch (error) {
        ui.fail(error);
      }
    });
}
