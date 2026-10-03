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
    .argument('<library>', 'Library name or URL')
    .argument('[ref]', 'Git tag or branch for the library')
    .argument('[download]', 'Pass 1 to download instead of clone')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .action(async (library: string, ref: string | undefined, download: string | undefined, options: { concurrency?: string }) => {
      try {
        const args = setupArgsSchema.parse({ library, ref, download, concurrency: options?.concurrency });
        await setup(args.library, args.ref, args.download, args.concurrency);
      } catch (error) {
        ui.fail(error);
      }
    });
}
