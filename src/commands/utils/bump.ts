import { Command } from 'commander';
import { z } from 'zod';
import bump from '../../utils/commands/bump.ts';

const bumpOptionsSchema = z.object({
  yes: z.boolean().optional(),
});

export function bumpCommand(): Command {
  return new Command('bump')
    .description('Bump the patch version of a library, then commit, tag and push it')
    .argument('<library>', 'Library folder name (run from inside the libraries folder)')
    .option('-y, --yes', 'Skip all prompts')
    .action(async (library: string | undefined, options: { yes?: boolean }) => {
      const opts = bumpOptionsSchema.parse(options);
      const inputList: string[] = [];
      if (library) inputList.push(library);
      if (opts.yes) inputList.push('--yes');
      await bump(...inputList);
    });
}
