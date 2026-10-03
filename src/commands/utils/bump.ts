import { Command } from 'commander';
import { z } from 'zod';
import bump from '../../versioning/bump.ts';
import { ui } from '../../ui/ui.ts';

const bumpOptionsSchema = z.object({
  yes: z.boolean().optional(),
});

export function bumpCommand(): Command {
  return new Command('bump')
    .description('Bump the patch version of a library, then commit, tag and push it')
    .argument('<library>', 'Library folder, e.g. h5p-accordion or H5P.Accordion-1.0')
    .option('-y, --yes', 'Skip all prompts')
    .addHelpText('after', `
Examples:
  $ h5p utils bump h5p-accordion`)
    .action(async (library: string, options: { yes?: boolean }) => {
      try {
        const opts = bumpOptionsSchema.parse(options);
        await bump(library, { yes: opts.yes });
      } catch (error) {
        ui.fail(error);
      }
    });
}
