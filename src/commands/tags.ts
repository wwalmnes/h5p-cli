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
    .argument('<org>', 'GitHub organization')
    .argument('<library>', 'Library name')
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
