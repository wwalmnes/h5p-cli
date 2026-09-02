import { Command } from 'commander';
import { z } from 'zod';
import { TagsAdapter, type ITagsAdapter } from '../adapters/tags-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const tagsArgsSchema = z.object({
  org: z.string(),
  library: z.string(),
  mainBranch: z.string(),
});

export function tagsCommand(adapter?: ITagsAdapter): Command {
  return new Command('tags')
    .description('List tags for a library')
    .argument('<org>', 'GitHub organization')
    .argument('<library>', 'Library name')
    .argument('<mainBranch>', 'Main branch name')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action((org: string, library: string, mainBranch: string, options) => {
      const a = adapter ?? adapterRegistry.resolve<ITagsAdapter>(options.adapter ?? 'tags') ?? new TagsAdapter();
      const args = tagsArgsSchema.parse({ org, library, mainBranch });
      try {
        ui.info('fetching h5p library tags');
        const result = a.tags(args.org, args.library, args.mainBranch);
        for (const tag of result) {
          ui.data(tag);
        }
      } catch (error) {
        ui.error(error);
      }
    });
}
