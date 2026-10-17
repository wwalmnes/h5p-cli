import { Command } from 'commander';
import { z } from 'zod';
import { installCore } from '../install/install.ts';
import config from '../config/loader.ts';
import type { CoreLibrary } from '../config/defaults.ts';
import { setupFolders } from '../cli/setup-folders.ts';
import { ui } from '../ui/ui.ts';

const coreArgsSchema = z.object({
  concurrency: z.coerce.number().int().positive().optional(),
});

export function coreCommand(): Command {
  return new Command('core')
    .description('Installs core h5p libraries')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .action(async (options: { concurrency?: string }) => {
      setupFolders();
      try {
        const args = coreArgsSchema.parse({ concurrency: options?.concurrency });

        await installCore([
          ...config.core.clone.map((repo: string) => ({ org: 'h5p', repo, target: repo })),
          ...config.core.setup.map(({ repo, machineName }: CoreLibrary) => ({ org: 'h5p', repo, machineName })),
        ], true, args.concurrency);
        ui.info('done setting up core libraries');
      } catch (error) {
        ui.fail(error);
      }
    });
}
