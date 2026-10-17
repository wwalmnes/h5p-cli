import { Command } from 'commander';
import { z } from 'zod';
import { setup } from '../install/setup.ts';
import { ui } from '../ui/ui.ts';

const setupArgsSchema = z.object({
  library: z.string(),
  ref: z.string().optional(),
  download: z.boolean().optional(),
  concurrency: z.coerce.number().int().positive().optional(),
});

export function setupCommand(): Command {
  return new Command('setup')
    .description('Computes & installs dependencies for h5p library')
    .argument('<library>', 'Repo name, e.g. h5p-accordion, or a git URL')
    .argument('[ref]', 'Git tag or branch for the library')
    .option('--download', 'Download instead of clone repositories')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .addHelpText('after', `
Examples:
  $ h5p setup h5p-accordion
  $ h5p setup h5p-accordion 1.0.0
  $ h5p setup h5p-accordion feat/example
  $ h5p setup h5p-accordion master --download
  $ h5p setup git@github.com:h5p/h5p-accordion.git`)
    .action(async (library: string, ref: string | undefined, options: { download?: boolean, concurrency?: string }) => {
      try {
        const args = setupArgsSchema.parse({ library, ref, download: options?.download, concurrency: options?.concurrency });
        await setup(args.library, args.ref, args.download, args.concurrency);
      } catch (error) {
        ui.fail(error);
      }
    });
}
