import { Command } from 'commander';
import { z } from 'zod';
import init from '../../utils/commands/init';

const initArgsSchema = z.object({
  library: z.string(),
});

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new h5p library')
    .argument('<library>', 'Library name')
    .action((library: string) => {
      const args = initArgsSchema.parse({ library });
      init();
    });
}
