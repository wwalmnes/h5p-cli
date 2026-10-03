import { Command } from 'commander';
import { z } from 'zod';
import { tags } from '../h5p/repo.ts';
import { ui } from '../ui/ui.ts';

const tagsArgsSchema = z.object({
  org: z.string(),
  library: z.string(),
});

export function tagsCommand(): Command {
  return new Command('tags')
    .description('List tags for a library')
    .argument('<org>', 'GitHub organization, e.g. h5p')
    .argument('<library>', 'Repo name, e.g. h5p-accordion')
    .addHelpText('after', `
Examples:
  $ h5p tags h5p h5p-accordion`)
    .action((org: string, library: string) => {
      try {
        const args = tagsArgsSchema.parse({ org, library });
        ui.info('fetching h5p library tags');
        for (const tag of tags(args.org, args.library)) {
          ui.data(tag);
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
