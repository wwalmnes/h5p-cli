import { Command } from 'commander';
import { z } from 'zod';
import { SetupAdapter } from '../adapters/setup-adapter.ts';
import { RegisterAdapter } from '../adapters/register-adapter.ts';
import { RegisterService } from '../services/register-service.ts';
import { SetupService } from '../services/setup-service.ts';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const setupArgsSchema = z.object({
  library: z.string(),
  version: z.string().optional(),
  download: z.string().optional(),
  concurrency: z.coerce.number().int().positive().optional(),
});

export async function runSetup(library: string, version?: string, download?: string, concurrency?: number): Promise<void> {
  const svc = new SetupService(
    new SetupAdapter(),
    new RegisterService(new RegisterAdapter(), config.registry),
    config.folders.libraries
  );
  await svc.setup(library, version, download, concurrency);
}

export function setupCommand(service?: SetupService): Command {
  const svc = service ?? new SetupService(
    new SetupAdapter(),
    new RegisterService(new RegisterAdapter(), config.registry),
    config.folders.libraries
  );
  return new Command('setup')
    .description('Computes & installs dependencies for h5p library')
    .argument('<library>', 'Library name or URL')
    .argument('[version]', 'Version')
    .argument('[download]', 'Pass 1 to download instead of clone')
    .option('-c, --concurrency <n>', 'How many libraries to install at once (default 4)')
    .action(async (library: string, version: string | undefined, download: string | undefined, options: { concurrency?: string }) => {
      try {
        const args = setupArgsSchema.parse({ library, version, download, concurrency: options?.concurrency });
        await svc.setup(args.library, args.version, args.download, args.concurrency);
      } catch (error) {
        ui.fail(error);
      }
    });
}
