import { Command } from 'commander';
import { z } from 'zod';
import { CoreAdapter, type ICoreAdapter } from '../adapters/core-adapter.ts';
import { CoreService } from '../services/core-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import config from '../../configLoader.ts';
import { setupFolders } from '../lib/setup-folders.ts';
import { ui } from '../lib/ui.ts';

const coreArgsSchema = z.object({
  concurrency: z.coerce.number().int().positive().optional(),
});

export function coreCommand(service?: CoreService): Command {
  return new Command('core')
    .description('Installs core h5p libraries')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .action(async (options: { concurrency?: string }) => {
      setupFolders();
      const svc = service ?? new CoreService(
        adapterRegistry.resolve<ICoreAdapter>('core') ?? new CoreAdapter(),
        config.core.clone,
        config.core.setup
      );
      try {
        const args = coreArgsSchema.parse({ concurrency: options?.concurrency });
        await svc.core(args.concurrency);
      } catch (error) {
        ui.fail(error);
      }
    });
}
