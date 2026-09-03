import { Command } from 'commander';
import { z } from 'zod';
import bump from '../../utils/commands/bump.ts';
import { ui } from '../../lib/ui.ts';

const bumpOptionsSchema = z.object({
  yes: z.boolean().optional(),
});

export function bumpCommand(): Command {
  return new Command('bump')
    .description('Bump the patch version of a library, then commit, tag and push it')
    .argument('<library>', 'Library folder name (run from inside the libraries folder)')
    .option('-y, --yes', 'Skip all prompts')
    .action(async (library: string, options: { yes?: boolean }) => {
      try {
        const opts = bumpOptionsSchema.parse(options);
        await bump(library, { yes: opts.yes });
      } catch (error) {
        ui.fail(error);
      }
    });
}
