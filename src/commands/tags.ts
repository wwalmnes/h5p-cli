import { Command } from 'commander';
import { z } from 'zod';
import { TagsAdapter, type ITagsAdapter } from '../adapters/tags-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';

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
        console.log('> fetching h5p library tags');
        const result = a.tags(args.org, args.library, args.mainBranch);
        console.log(result);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
