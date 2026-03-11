import { Command } from 'commander';
import { z } from 'zod';
import { TagsAdapter } from '../adapters/tags-adapter';
import { TagsService } from '../services/tags-service';

const tagsArgsSchema = z.object({
  org: z.string(),
  library: z.string(),
  mainBranch: z.string(),
});

export function tagsCommand(service?: TagsService): Command {
  const svc = service ?? new TagsService(new TagsAdapter());
  return new Command('tags')
    .description('List tags for a library')
    .argument('<org>', 'GitHub organization')
    .argument('<library>', 'Library name')
    .argument('<mainBranch>', 'Main branch name')
    .action((org: string, library: string, mainBranch: string) => {
      const args = tagsArgsSchema.parse({ org, library, mainBranch });
      try {
        svc.tags(args.org, args.library, args.mainBranch);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
