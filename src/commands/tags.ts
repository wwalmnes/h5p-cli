import { Command } from 'commander';
import { z } from 'zod';
import { TagsAdapter, ITagsAdapter } from '../adapters/tags-adapter';

const tagsArgsSchema = z.object({
  org: z.string(),
  library: z.string(),
  mainBranch: z.string(),
});

export function tagsCommand(adapter?: ITagsAdapter): Command {
  const a = adapter ?? new TagsAdapter();
  return new Command('tags')
    .description('List tags for a library')
    .argument('<org>', 'GitHub organization')
    .argument('<library>', 'Library name')
    .argument('<mainBranch>', 'Main branch name')
    .action((org: string, library: string, mainBranch: string) => {
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
