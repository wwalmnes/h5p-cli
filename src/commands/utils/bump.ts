import { Command } from 'commander';
import { z } from 'zod';

const bumpOptionsSchema = z.object({
  yes: z.boolean().optional(),
});

export function bumpCommand(): Command {
  return new Command('bump')
    .description('Bump version of specified library or current library')
    .argument('[library]', 'Library name (defaults to current directory)')
    .option('-y, --yes', 'Skip all prompts')
    .action(async (library: string | undefined, options: { yes?: boolean }) => {
      const opts = bumpOptionsSchema.parse(options);
      const bump = require('../../../assets/utils/commands/bump.js') as any;
      const inputList: string[] = [];
      if (library) inputList.push(library);
      if (opts.yes) inputList.push('--yes');
      await bump(...inputList);
    });
}
