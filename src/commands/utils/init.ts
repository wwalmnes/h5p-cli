import { Command } from 'commander';
import { z } from 'zod';
import init from '../../packaging/init.ts';

const initArgsSchema = z.object({
  library: z.string(),
});

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new h5p library')
    .argument('<library>', 'Name without the H5P. prefix, e.g. MyLibrary')
    .addHelpText('after', `
Examples:
  $ h5p utils init MyLibrary                  # creates MyLibrary/ for H5P.MyLibrary`)
    .action((library: string) => {
      const args = initArgsSchema.parse({ library });
      init(args.library);
    });
}
