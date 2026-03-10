import { Command } from 'commander';
import { z } from 'zod';

const initArgsSchema = z.object({
  library: z.string(),
});

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new h5p library')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const args = initArgsSchema.parse({ library });
      const init = require('../../../assets/utils/commands/init.js') as any;
      await init(args.library);
    });
}
