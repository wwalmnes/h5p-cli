import { Command } from 'commander';
import { z } from 'zod';
import { ListAdapter } from '../adapters/list-adapter';
import { ListService } from '../services/list-service';

const listArgsSchema = z.object({
  // @todo: string currently and backwards compatible to accept 1. Should be a boolean.
  reversed: z.string().optional(),
  ignoreFile: z.string().optional(),
});

export function listCommand(service?: ListService): Command {
  const svc = service ?? new ListService(new ListAdapter());
  return new Command('list')
    .description('Lists h5p libraries from the registry')
    .argument('[reversed]', 'Pass 1 to show reversed list')
    .argument('[ignoreFile]', 'Pass 1 to ignore local registry file')
    .action(async (reversed: string | undefined, ignoreFile: string | undefined) => {
      const args = listArgsSchema.parse({ reversed, ignoreFile });
      try {
        await svc.list(args.reversed === '1', args.ignoreFile === '1');
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
