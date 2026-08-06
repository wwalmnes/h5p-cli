import { Command } from 'commander';
import { z } from 'zod';
import { ListAdapter, type IListAdapter } from '../adapters/list-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const listArgsSchema = z.object({
  // @todo: string currently and backwards compatible to accept 1. Should be a boolean.
  reversed: z.string().optional(),
  ignoreFile: z.string().optional(),
});

export function listCommand(adapter?: IListAdapter): Command {
  return new Command('list')
    .description('Lists h5p libraries from the registry')
    .argument('[reversed]', 'Pass 1 to show reversed list')
    .argument('[ignoreFile]', 'Pass 1 to ignore local registry file')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (reversed: string | undefined, ignoreFile: string | undefined, options) => {
      const a = adapter ?? adapterRegistry.resolve<IListAdapter>(options.adapter ?? 'list') ?? new ListAdapter();
      const args = listArgsSchema.parse({ reversed, ignoreFile });
      try {
        ui.info('fetching h5p library registry');
        const result = await a.getRegistry(args.ignoreFile === '1');
        const machineNames = args.reversed === '1';
        const rows = Object.keys(result.regular).map((item) => [
          machineNames ? result.regular[item].id : item,
          result.regular[item].org ?? '',
        ]);
        ui.table(rows, { head: [machineNames ? 'MACHINE NAME' : 'NAME', 'ORG'] });
      } catch (error) {
        ui.error(error);
      }
    });
}
