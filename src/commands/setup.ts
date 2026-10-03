import { Command } from 'commander';
import { z } from 'zod';
import { setup } from '../install/setup.ts';
import { ui } from '../ui/ui.ts';

const setupArgsSchema = z.object({
  library: z.string(),
  ref: z.string().optional(),
  download: z.string().optional(),
  concurrency: z.coerce.number().int().positive().optional(),
});

export function setupCommand(): Command {
  return new Command('setup')
    .description('Computes & installs dependencies for h5p library')
    .argument('<library>', 'Repo name, e.g. h5p-accordion (not H5P.Accordion), or a git URL')
    .argument('[ref]', 'Git tag or branch for the library')
    .argument('[download]', 'Pass 1 to download instead of clone')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .addHelpText('after', `
Examples:
  $ h5p setup h5p-accordion
  $ h5p setup h5p-accordion 1.0.0
  $ h5p setup h5p-accordion feat/example
  $ h5p setup h5p-accordion master 1          # download instead of clone
  $ h5p setup git@github.com:h5p/h5p-accordion.git`)
    .action(async (library: string, ref: string | undefined, download: string | undefined, options: { concurrency?: string }) => {
      try {
        const args = setupArgsSchema.parse({ library, ref, download, concurrency: options?.concurrency });
        await setup(args.library, args.ref, args.download, args.concurrency);
      } catch (error) {
        ui.fail(error);
      }
    });
}
